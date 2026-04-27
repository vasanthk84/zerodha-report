#!/usr/bin/env python3
"""
fetch_ohlc.py — Download Nifty 1-min OHLC for a date range (concurrent threads).

Usage:
    pip install kiteconnect tqdm
    python fetch_ohlc.py --api_key YOUR_API_KEY --access_token YOUR_ACCESS_TOKEN

Optional:
    --output   path to save JSON        (default: ohlc_data.json)
    --workers  parallel threads         (default: 6)
    --rps      max requests per second  (default: 3  — Kite hard limit)
"""

import argparse
import json
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

# ── CLI args ──────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Fetch Nifty 1-min OHLC from Kite (concurrent)")
parser.add_argument("--api_key",      required=True)
parser.add_argument("--access_token", required=True)
parser.add_argument("--output",  default="ohlc_data.json")
parser.add_argument("--workers", default=6,  type=int, help="Parallel threads (default: 6)")
parser.add_argument("--rps",     default=3,  type=int, help="Max requests/sec  (default: 3)")
args = parser.parse_args()

# ── kiteconnect ───────────────────────────────────────────────────────────────
try:
    from kiteconnect import KiteConnect
except ImportError:
    print("ERROR: kiteconnect not installed.  pip install kiteconnect")
    sys.exit(1)

# ── tqdm (optional pretty progress bar) ──────────────────────────────────────
try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# ── Connect ───────────────────────────────────────────────────────────────────
kite = KiteConnect(api_key=args.api_key)
kite.set_access_token(args.access_token)
print("✓ Connected to Kite API")

# ── Helper: prompt a valid DD-MM-YYYY date ────────────────────────────────────
def prompt_date(label: str) -> datetime:
    while True:
        raw = input(f"  {label} (DD-MM-YYYY): ").strip()
        try:
            return datetime.strptime(raw, "%d-%m-%Y")
        except ValueError:
            print("    ✗ Invalid — use DD-MM-YYYY (e.g. 01-01-2025)")

# ── Prompt for date range ─────────────────────────────────────────────────────
print("\n─── Enter the date range for OHLC download ───────────────────────────────")
while True:
    from_dt = prompt_date("From date")
    to_dt   = prompt_date("To   date")
    if to_dt < from_dt:
        print("    ✗ 'To date' must be on or after 'From date'. Try again.\n")
        continue
    delta = (to_dt - from_dt).days + 1
    print(f"\n  ✓ {from_dt.strftime('%d-%m-%Y')}  ->  {to_dt.strftime('%d-%m-%Y')}  ({delta} calendar days)")
    break

# ── Build weekday list ────────────────────────────────────────────────────────
all_days = []
cursor = from_dt
while cursor <= to_dt:
    if cursor.weekday() < 5:        # 0=Mon ... 4=Fri
        all_days.append(cursor)
    cursor += timedelta(days=1)

total = len(all_days)
print(f"  ✓ Trading days to fetch : {total}")
print(f"  ✓ Parallel workers      : {args.workers}")
print(f"  ✓ Rate limit            : {args.rps} req/sec\n")

# ── Rate-limiter  (token-bucket, thread-safe) ─────────────────────────────────
# Guarantees we never exceed args.rps Kite API calls per second across all threads.
_rate_lock       = threading.Lock()
_rate_allowance  = float(args.rps)
_rate_last_check = time.monotonic()

def _acquire_token():
    """Block the calling thread until a request slot is available."""
    global _rate_allowance, _rate_last_check
    while True:
        with _rate_lock:
            now      = time.monotonic()
            elapsed  = now - _rate_last_check
            _rate_last_check = now
            # Refill bucket proportional to elapsed time, capped at burst size
            _rate_allowance = min(float(args.rps), _rate_allowance + elapsed * args.rps)
            if _rate_allowance >= 1.0:
                _rate_allowance -= 1.0
                return
        # Wait outside the lock so other threads can also check
        time.sleep(1.0 / args.rps)

# ── Kite instrument token for NIFTY 50 spot ──────────────────────────────────
# NSE:NIFTY 50 = 256265
NIFTY_TOKEN = 256265

# ── Worker function ───────────────────────────────────────────────────────────
def fetch_day(dt: datetime):
    """
    Fetch 1-min OHLC for a single trading day.
    Returns (date_key, records_list, error_str_or_None).
    """
    date_key  = dt.strftime("%Y-%m-%d")
    date_from = date_key + " 09:15:00"
    date_to   = date_key + " 15:30:00"

    _acquire_token()        # honour rate limit before hitting the API

    try:
        candles = kite.historical_data(
            instrument_token = NIFTY_TOKEN,
            from_date        = date_from,
            to_date          = date_to,
            interval         = "minute",
            continuous       = False,
            oi               = False,
        )
        records = [
            {
                "time":   c["date"].strftime("%Y-%m-%dT%H:%M:%S")
                          if hasattr(c["date"], "strftime") else str(c["date"]),
                "open":   round(c["open"],  2),
                "high":   round(c["high"],  2),
                "low":    round(c["low"],   2),
                "close":  round(c["close"], 2),
                "volume": int(c["volume"]),
            }
            for c in candles
        ]
        return date_key, records, None

    except Exception as exc:
        return date_key, [], str(exc)

# ── Concurrent fetch + live progress ─────────────────────────────────────────
ohlc_data   = {}
errors      = []
_print_lock = threading.Lock()
completed   = 0

progress = tqdm(total=total, unit="day", ncols=72) if HAS_TQDM else None

with ThreadPoolExecutor(max_workers=args.workers) as pool:
    futures = {pool.submit(fetch_day, dt): dt for dt in all_days}

    for future in as_completed(futures):
        date_key, records, err = future.result()
        ohlc_data[date_key] = records

        if progress:
            label = f"{len(records)} candles" if not err else "FAILED"
            progress.set_postfix_str(f"{date_key} -> {label}")
            progress.update(1)
        else:
            with _print_lock:
                completed += 1
                if err:
                    print(f"  [{completed:3}/{total}] {date_key}  FAILED — {err}", flush=True)
                else:
                    print(f"  [{completed:3}/{total}] {date_key}  {len(records)} candles OK", flush=True)

        if err:
            errors.append((date_key, err))

if progress:
    progress.close()

# ── Sort keys chronologically before saving ───────────────────────────────────
ohlc_data = dict(sorted(ohlc_data.items()))

# ── Save ──────────────────────────────────────────────────────────────────────
output_payload = {
    "generated_at": datetime.now().isoformat(),
    "instrument":   "NSE:NIFTY 50",
    "interval":     "minute",
    "from_date":    from_dt.strftime("%Y-%m-%d"),
    "to_date":      to_dt.strftime("%Y-%m-%d"),
    "candles":      ohlc_data,
}

with open(args.output, "w") as f:
    json.dump(output_payload, f, separators=(",", ":"))

size_kb = len(json.dumps(output_payload)) / 1024
success  = sum(1 for v in ohlc_data.values() if v)

print(f"\n✓ Saved  ->  {args.output}  ({size_kb:.0f} KB)")
print(f"  Dates with data   : {success} / {total}")
print(f"  Dates with errors : {len(errors)}")
if errors:
    print("  Failed dates:")
    for d, e in errors:
        print(f"    {d}: {e}")

print("\nNext step: open trade_dashboard_v2.html and load ohlc_data.json when prompted.")
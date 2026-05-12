/* ===== CSV import — parses Zerodha tradebook + P&L CSV and updates SEED ===== */
/* FIXES applied:
   1. Equity timestamp: falls back to trade_date when order_execution_time is missing/NaN
   2. trade_type: normalised to lowercase for matching
   3. Symbol matching: tries direct match then case-insensitive; logs diagnostics
   4. eqT populated even when only P&L is available (position-level fallback)
*/
(() => {
  const MMAP = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const LOT_SIZES = { NIFTY: 75, SENSEX: 10, INFY: 400, BEL: 1425, HAL: 150, OFSS: 75, CAMS: 150, HCLTECH: 350, BANKEX: 15, BANKNIFTY: 25 };

  const state = { foRaw: null, eqRaw: null, foPnl: null, eqPnl: null, niftyOhlc: null };

  // ---------- PARSERS ----------
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj = {}; headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    }).filter(r => r[headers[0]]);
  }

  function parsePnlCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).map(l => l.trim());
    let charges = 0;
    for (const line of lines) {
      const parts = line.split(',');
      if (parts[0] === 'Charges' && !isNaN(parseFloat(parts[1]))) { charges = parseFloat(parts[1]); break; }
    }
    // Support both "Symbol,ISIN," and just "Symbol," header patterns
    const headerIdx = lines.findIndex(l => l.startsWith('Symbol,'));
    const positions = {};
    if (headerIdx !== -1) {
      const headers = lines[headerIdx].split(',').map(h => h.trim());
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i]; if (!line || line.startsWith(',')) continue;
        const vals = line.split(',');
        const o = {}; headers.forEach((h, j) => o[h] = (vals[j] || '').trim());
        if (!o['Symbol']) continue;
        positions[o['Symbol']] = {
          quantity: parseFloat(o['Quantity']) || 0,
          buy_value: parseFloat(o['Buy Value']) || 0,
          sell_value: parseFloat(o['Sell Value']) || 0,
          realized_pnl: parseFloat(o['Realized P&L']) || 0,
          realized_pct: parseFloat(o['Realized P&L Pct.']) || 0
        };
      }
    }
    return { charges, positions };
  }

  function parseNiftyOhlc(text) {
    const raw = JSON.parse(text);
    const candles = raw.candles;
    if (!candles || typeof candles !== 'object')
      throw new Error('Expected { candles: { "YYYY-MM-DD": [...] } }');

    const dates = Object.keys(candles).sort();
    const out = {}; let prev = 0;

    dates.forEach(dt => {
      const mins = candles[dt];
      if (!Array.isArray(mins) || !mins.length) return;

      const sorted = [...mins].sort((a, b) => (a.time < b.time ? -1 : 1));

      // Build minute map: "HH:MM" → candle object
      const minuteMap = {};
      sorted.forEach(m => {
        const hhmm = m.time.slice(11, 16); // "09:15"
        minuteMap[hhmm] = { open: +m.open, high: +m.high, low: +m.low, close: +m.close };
      });

      // Daily aggregates
      const open = +sorted[0].open;
      const high = Math.max(...sorted.map(m => m.high));
      const low = Math.min(...sorted.map(m => m.low));
      const close = +sorted[sorted.length - 1].close;

      // First-15-min: 9:15 open → 9:29 close (candle at 9:29 is last of first 15)
      const f15Candles = sorted.filter(m => m.time >= `${dt}T09:15` && m.time <= `${dt}T09:29`);
      const f15Open = f15Candles.length ? +f15Candles[0].open : open;
      const f15Close = f15Candles.length ? +f15Candles[f15Candles.length - 1].close : open;
      const f15 = f15Open ? +((f15Close - f15Open) / f15Open * 100).toFixed(3) : 0;
      const f15Dir = f15 > 0 ? 'bull' : f15 < 0 ? 'bear' : 'flat';

      const range = +(high - low).toFixed(2);
      const ret = prev ? +((close - prev) / prev * 100).toFixed(3) : 0;
      // More precise gap: prev close vs TODAY's first candle open
      const gap = prev ? +((open - prev) / prev * 100).toFixed(3) : 0;

      out[dt] = { open, high, low, close, range, ret, gap, f15, f15Dir, minuteMap };
      prev = close;
    });

    return out;
  }

  function enrichWithNifty(trades, nifty) {
    const dates = Object.keys(nifty).sort();
    const nearest = d => dates.find(x => x >= d) || dates[dates.length - 1];
    const zone = p => p < 23000 ? 'below_23k' : p < 24000 ? '23k_24k' : p < 25000 ? '24k_25k' : p < 26000 ? '25k_26k' : 'above_26k';
    const ctx = g => g > 1 ? 'big_gap_up' : g > 0.3 ? 'gap_up' : g < -1 ? 'big_gap_down' : g < -0.3 ? 'gap_down' : 'neutral_open';

    return trades.map(t => {
      const od = nifty[nearest(t.open_date)] || {};
      const cd = nifty[nearest(t.close || t.open_date)] || {};
      const span = dates.filter(d => d >= t.open_date && d <= (t.close || t.open_date));
      const avgRange = span.length
        ? +(span.reduce((a, d) => a + (nifty[d].range || 0), 0) / span.length).toFixed(1)
        : od.range || 0;
      const retDuring = od.open ? +((cd.close - od.open) / od.open * 100).toFixed(2) : 0;

      // --- Minute-level correlation using order_execution_time ---
      let entry_nifty_open = null, entry_nifty_close = null, entry_nifty_ret = null;
      if (t.open_time && od.minuteMap) {
        // open_time should be "HH:MM" extracted from order_execution_time
        const candle = od.minuteMap[t.open_time];
        if (candle) {
          entry_nifty_open = candle.open;
          entry_nifty_close = candle.close;
          entry_nifty_ret = +((candle.close - candle.open) / candle.open * 100).toFixed(3);
        }
      }

      return {
        ...t,
        od_nifty_ret: od.ret || 0,
        od_nifty_gap: od.gap || 0,
        od_nifty_f15: od.f15 || 0,   // ← now real value, not hardcoded 0
        od_nifty_f15dir: od.f15Dir || 'flat',
        od_nifty_range: od.range || 0,
        od_nifty_open: od.open || 0,
        od_nifty_dir: (od.ret || 0) > 0 ? 'bull' : 'bear',
        cd_nifty_ret: cd.ret || 0,
        nifty_ret_during: retDuring,
        avg_range_during: avgRange,
        market_ctx: ctx(od.gap || 0),
        nifty_zone: zone(od.open || 0),
        // New minute-level fields:
        entry_nifty_open,
        entry_nifty_close,
        entry_nifty_ret   // NIFTY return in the exact minute of trade entry
      };
    });
  }

  function parseFoSymbol(sym) {
    const m = sym.match(/^([A-Z&]+?)(\d{2})([A-Z]{3})(\d+)(CE|PE|FUT)$/);
    if (m) return { stock: m[1], year: '20' + m[2], month: m[3], month_num: MMAP[m[3]] || 0, strike: parseInt(m[4]), opt_type: m[5] };
    return { stock: sym, year: '', month: '', month_num: 0, strike: null, opt_type: 'UNKNOWN' };
  }

  // FIX: safe date parser with fallback
  function safeDate(primary, fallback) {
    let d = new Date(primary);
    if (isNaN(d.getTime())) d = new Date(fallback);
    if (isNaN(d.getTime())) d = new Date();
    return d;
  }

  // ---------- BUILD SEED FROM CSV ----------
  // silent=true: skip modal close / redraw / Redis save (used during multi-year batch loading)
  function computeAndApply(silent) {
    const foReady = !!(state.foRaw && state.foPnl);
    const eqReady = !!(state.eqRaw && state.eqPnl) || !!(state.eqPnl);
    if (!foReady && !state.eqPnl) { if (!silent) alert('Upload at least one complete pair: tradebook + P&L CSV for F&O or Equity.'); return; }

    const foRows = foReady ? state.foRaw : [];
    const eqRows = state.eqRaw ? state.eqRaw : [];
    const foPnl = foReady ? state.foPnl : { charges: 0, positions: {} };
    const eqPnl = state.eqPnl ? state.eqPnl : { charges: 0, positions: {} };

    foRows.forEach(r => {
      r._ts = safeDate(r.order_execution_time, r.trade_date);
      r._dt = new Date(r.trade_date);
    });
    // FIX: Equity rows — normalise trade_type to lowercase, safe timestamp
    eqRows.forEach(r => {
      r.trade_type = (r.trade_type || r.transaction_type || '').toLowerCase().trim();
      r._ts = safeDate(r.order_execution_time, r.trade_date);
      r._dt = new Date(r.trade_date);
    });

    const group = rows => rows.reduce((g, r) => {
      // group by symbol, also build case-insensitive lookup
      const key = (r.symbol || r.tradingsymbol || '').trim();
      r._sym = key;
      (g[key] = g[key] || []).push(r);
      return g;
    }, {});

    const foGroups = group(foRows);
    // FIX: build case-insensitive equity groups map
    const eqGroupsRaw = group(eqRows);
    const eqGroupsUpper = {};
    Object.keys(eqGroupsRaw).forEach(k => { eqGroupsUpper[k.toUpperCase()] = eqGroupsRaw[k]; });

    // Build F&O trades
    const foT = [];
    Object.entries(foPnl.positions).forEach(([sym, pos]) => {
      const trades = (foGroups[sym] || []).sort((a, b) => a._ts - b._ts);
      if (!trades.length) return;
      const first = trades[0], last = trades[trades.length - 1];
      const days = Math.max(0, Math.round((last._dt - first._dt) / 86400000));
      const p = parseFoSymbol(sym);
      const qty = pos.quantity;
      const entry = qty > 0 ? pos.buy_value / qty : 0;
      const exit = qty > 0 ? pos.sell_value / qty : 0;
      const pnl = pos.realized_pnl;
      const month_label = p.month && p.year ? `${p.month} ${p.year.slice(-2)}` : 'OTHER';
      const hold_bucket = days === 0 ? 'Intraday' : days <= 2 ? '1–2 days' : days <= 7 ? '3–7 days' : days <= 14 ? '8–14 d' : days <= 30 ? '15–30 d' : '30 d +';
      const price_bucket = entry < 5 ? 'Deep OTM' : entry < 20 ? 'OTM' : entry < 50 ? 'Near ATM' : entry < 150 ? 'ATM' : 'ITM';
      const price_sub = entry < 5 ? '< ₹5' : entry < 20 ? '₹5 – ₹20' : entry < 50 ? '₹20 – ₹50' : entry < 150 ? '₹50 – ₹150' : '> ₹150';
      foT.push({
        sym, stk: p.stock, type: p.opt_type, entry: +entry.toFixed(2), exit: +exit.toFixed(2),
        pnl: +pnl.toFixed(2), pct: +pos.realized_pct.toFixed(1),
        d: days, k: days === 0 ? 'intra' : 'pos', win: pnl > 0,
        close: last.trade_date || last._ts.toISOString().slice(0, 10),
        open_time: first._ts instanceof Date && !isNaN(first._ts)
          ? `${String(first._ts.getHours()).padStart(2, '0')}:${String(first._ts.getMinutes()).padStart(2, '0')}`
          : null,
        open_date: first.trade_date || first._ts.toISOString().slice(0, 10),
        open_hour: first._ts.getHours(),
        lots: LOT_SIZES[p.stock] ? +(pos.quantity / LOT_SIZES[p.stock]).toFixed(1) : null,
        month_label, hold_bucket, price_bucket, price_sub
      });
    });
    foT.sort((a, b) => a.close.localeCompare(b.close));

    // Build equity trades
    // FIX: symbol matching — try exact, then uppercase, then P&L-symbol-lookup in tradebook
    const eqT = [];
    console.log('[eq] pnl positions:', Object.keys(eqPnl.positions).length);
    console.log('[eq] tradebook symbols:', Object.keys(eqGroupsRaw).length);

    Object.entries(eqPnl.positions).forEach(([sym, pos]) => {
      // FIX: find matching tradebook rows with symbol normalisation
      let trades = eqGroupsRaw[sym]
        || eqGroupsUpper[sym.toUpperCase()]
        || eqGroupsRaw[sym.replace(/-/g, '')]
        || [];

      const buys = trades.filter(t => t.trade_type === 'buy' || t.trade_type === 'b');
      const sells = trades.filter(t => t.trade_type === 'sell' || t.trade_type === 's');

      // Even if no tradebook rows matched, we can still build a position from P&L data alone
      let days = 0;
      if (buys.length && sells.length) {
        const firstBuy = buys.reduce((a, b) => a._dt < b._dt ? a : b);
        const lastSell = sells.reduce((a, b) => a._dt > b._dt ? a : b);
        days = Math.max(0, Math.round((lastSell._dt - firstBuy._dt) / 86400000));
      }

      const qty = pos.quantity;
      const pnl = pos.realized_pnl;
      if (pnl === 0 && qty === 0 && pos.buy_value === 0) return; // skip empty rows

      eqT.push({
        sym,
        qty,
        entry: +(qty > 0 ? pos.buy_value / qty : 0).toFixed(2),
        exit: +(qty > 0 ? pos.sell_value / qty : 0).toFixed(2),
        pnl: +pnl.toFixed(2),
        pct: +pos.realized_pct.toFixed(1),
        d: days,
        close: sells.length ? (sells.reduce((a, b) => a._dt > b._dt ? a : b).trade_date || '') : '',
        win: pnl > 0
      });
    });
    console.log('[eq] built trades:', eqT.length);

    // ---- Accumulate across FY imports: symbol-level merge ----
    // New CSV is authoritative for every symbol it contains.
    // Old trades whose symbols are NOT in the new CSV are kept (different FY/period).
    // Charges are prorated: old charges kept only for the old trades that survive.
    window.SEED_MASTER = null;
    if (window.TA) window.TA._fyActive = '';
    const prev = window.SEED;

    const prevFoTrades = (prev && prev.trades) || [];
    const newFoSyms = new Set(foT.map(t => t.sym));
    const prevFoKept = prevFoTrades.filter(t => !newFoSyms.has(t.sym));
    const mergedFoT = [...prevFoKept, ...foT].sort((a, b) => a.close.localeCompare(b.close));

    const prevEqTrades = (prev && prev.equity && prev.equity.trades) || [];
    // Key: sym|FY_start_year so the same stock traded in different fiscal years is kept separately.
    // FY starts in April: close date in Apr–Dec → FY = that year; Jan–Mar → FY = prev year.
    function eqKey(t) {
      const d = new Date(t.close || '');
      if (isNaN(d.getTime())) return t.sym;
      const y = d.getFullYear(), m = d.getMonth() + 1;
      return t.sym + '|' + (m >= 4 ? y : y - 1);
    }
    const newEqKeys = new Set(eqT.map(eqKey));
    const prevEqKept = prevEqTrades.filter(t => !newEqKeys.has(eqKey(t)));
    const mergedEqT = [...prevEqKept, ...eqT];

    // Charges: new CSV covers its symbols; old charges kept proportionally for surviving old trades
    const prevFoCharges = (prev && prev.hero && prev.hero.fo_charges) || 0;
    const foKeptRatio = prevFoTrades.length > 0 ? prevFoKept.length / prevFoTrades.length : 0;
    const charges_fo = Math.round(foKeptRatio * prevFoCharges) + (foPnl.charges || 0);

    const prevEqCharges = (prev && prev.hero && prev.hero.eq_charges) || 0;
    const eqKeptRatio = prevEqTrades.length > 0 ? prevEqKept.length / prevEqTrades.length : 0;
    const charges_eq = Math.round(eqKeptRatio * prevEqCharges) + (eqPnl.charges || 0);

    // Aggregations
    const by = (rows, key) => {
      const m = {};
      rows.forEach(r => {
        const k = String(r[key] || '');
        if (!m[k]) m[k] = { n: 0, pnl: 0, wins: 0, items: [] };
        m[k].n++; m[k].pnl += r.pnl; if (r.win) m[k].wins++; m[k].items.push(r);
      });
      return Object.entries(m).map(([k, v]) => ({
        key: k, n: v.n, pnl: Math.round(v.pnl), wins: v.wins,
        wr: Math.round(v.wins / Math.max(v.n, 1) * 1000) / 10,
        avgD: +(v.items.reduce((a, t) => a + t.d, 0) / Math.max(v.n, 1)).toFixed(1)
      }));
    };

    const foGross = mergedFoT.reduce((a, t) => a + t.pnl, 0);
    const eqGross = mergedEqT.reduce((a, t) => a + t.pnl, 0);
    const foNet = foGross - charges_fo;
    const eqNet = eqGross - charges_eq;
    const combined = foNet + eqNet;
    const wins = mergedFoT.filter(t => t.win).length, losses = mergedFoT.length - wins;

    const monthOrd = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
    const monthly = by(mergedFoT, 'month_label').map(m => {
      const [mn, yr] = m.key.split(' ');
      return { m: m.key, pnl: m.pnl, _ord: (parseInt(yr) || 0) * 100 + (monthOrd[mn] || 0) };
    }).sort((a, b) => a._ord - b._ord);

    let cum = 0;
    const cumulative = mergedFoT.map(t => (cum += t.pnl, Math.round(cum)));
    if (!cumulative.length) cumulative.push(0);

    const byStock = by(mergedFoT, 'stk').map(s => ({ sym: s.key, pnl: s.pnl, wr: s.wr, n: s.n, wins: s.wins, avgD: s.avgD }))
      .sort((a, b) => b.pnl - a.pnl);

    const holdOrd = { 'Intraday': 0, '1–2 days': 1, '3–7 days': 2, '8–14 d': 3, '15–30 d': 4, '30 d +': 5 };
    const byHold = by(mergedFoT, 'hold_bucket').map(h => ({
      k: h.key, n: h.n, wr: h.wr, pnl: h.pnl,
      rating: h.pnl < 0 ? 'bad' : h.wr >= 85 ? 'good' : 'mid'
    })).sort((a, b) => (holdOrd[a.k] ?? 9) - (holdOrd[b.k] ?? 9));

    const byHour = by(mergedFoT, 'open_hour').map(h => ({
      h: String(h.key).padStart(2, '0') + ':00', n: h.n, wr: h.wr, _ord: parseInt(h.key)
    })).sort((a, b) => a._ord - b._ord);

    const pbOrd = { 'Deep OTM': 0, 'OTM': 1, 'Near ATM': 2, 'ATM': 3, 'ITM': 4 };
    const byBucket = by(mergedFoT, 'price_bucket').map(b => {
      const item = mergedFoT.find(t => t.price_bucket === b.key);
      return { k: b.key, sub: item ? item.price_sub : '', n: b.n, pnl: b.pnl, wr: b.wr };
    }).sort((a, b) => (pbOrd[a.k] ?? 9) - (pbOrd[b.k] ?? 9));

    const cepe = by(mergedFoT, 'type').filter(t => t.key === 'CE' || t.key === 'PE')
      .map(t => ({ t: t.key, n: t.n, pnl: t.pnl, wr: t.wr, avg: Math.round(t.pnl / Math.max(t.n, 1)) }));

    const best = mergedFoT.length ? mergedFoT.reduce((a, b) => b.pnl > a.pnl ? b : a) : null;
    const worst = mergedFoT.length ? mergedFoT.reduce((a, b) => b.pnl < a.pnl ? b : a) : null;

    // Equity aggregation: by symbol
    const eqByStock = {};
    mergedEqT.forEach(t => {
      if (!eqByStock[t.sym]) eqByStock[t.sym] = { sym: t.sym, pnl: 0, n: 0, wins: 0 };
      eqByStock[t.sym].pnl += t.pnl; eqByStock[t.sym].n++; if (t.win) eqByStock[t.sym].wins++;
    });
    const eqStocks = Object.values(eqByStock).map(s => ({
      sym: s.sym, pnl: Math.round(s.pnl), n: s.n,
      wr: Math.round(s.wins / Math.max(s.n, 1) * 1000) / 10
    })).sort((a, b) => b.pnl - a.pnl);
    const eqWins = mergedEqT.filter(t => t.win).length;
    const eqLosses = mergedEqT.length - eqWins;
    const eqAvgHold = mergedEqT.length ? +(mergedEqT.reduce((a, t) => a + t.d, 0) / mergedEqT.length).toFixed(1) : 0;

    // Enrich F&O trades with NIFTY OHLC if uploaded
    const enrichedTrades = (state.niftyOhlc && mergedFoT.length)
      ? enrichWithNifty(mergedFoT, state.niftyOhlc)
      : null;

    window.SEED = {
      meta: { client: 'Uploaded', period: 'Your data' },
      hero: { combined, combinedPct: 0, fo_net: foNet, fo_gross: foGross, fo_charges: charges_fo, eq_net: eqNet, eq_gross: eqGross, eq_charges: charges_eq },
      monthly, cumulative,
      stocks: byStock.slice(0, 12),
      byHold, byHour, byBucket, cepe,
      trades: mergedFoT,
      equity: {
        gross: Math.round(eqGross), net: Math.round(eqNet), charges: Math.round(charges_eq),
        wins: eqWins, losses: eqLosses,
        wr: Math.round(eqWins / Math.max(mergedEqT.length, 1) * 1000) / 10,
        avgHold: eqAvgHold, total: mergedEqT.length,
        stocks: eqStocks,
        trades: mergedEqT
      },
      extras: { best, worst, totalPositions: mergedFoT.length, wins, losses, winRate: Math.round(wins / Math.max(mergedFoT.length, 1) * 1000) / 10 },
      enrichedTrades: enrichedTrades || (prev && prev.enrichedTrades) || null,
      niftyDaily: state.niftyOhlc || (prev && prev.niftyDaily) || null
    };

    if (!silent) {
      if (window.DASHBOARD_REDRAW) window.DASHBOARD_REDRAW();
      if (window.TA && window.TA.buildFYOptions) window.TA.buildFYOptions();
      if (window.TA && window.TA.saveSeed) window.TA.saveSeed();
      document.getElementById('dataModal').hidden = true;
    }
  }

  // Clear all loaded data and reset dashboard
  function clearAllData() {
    window.SEED = null;
    window.SEED_MASTER = null;
    if (window.TA) window.TA._fyActive = '';
    const sel = document.getElementById('fySelect');
    if (sel) { sel.innerHTML = '<option value="">All years</option>'; sel.disabled = true; }
    Object.keys(state).forEach(k => state[k] = null);
    const drops = document.querySelectorAll('#dataModal .drop');
    drops.forEach(d => { d.classList.remove('loaded'); const s = d.querySelector('.drop-s'); if (s) s.textContent = 'Not detected · drop or click to override'; });
    const fd = document.getElementById('folderDrop');
    if (fd) { fd.classList.remove('drag'); const fds = fd.querySelector('.fd-sub'); if (fds) fds.textContent = 'Drop folder here · or click to browse · tradebook & P&L files matched by filename automatically'; }
    if (window.TA && window.TA.clearSeed) window.TA.clearSeed();
    // Re-show empty state by triggering boot empty state logic
    document.querySelector('.hero-num').style.opacity = '0.15';
    document.querySelector('.hero-sub').innerHTML = '<span class="serif">Upload your Zerodha CSVs to see your analytics.</span> Click <b>Data</b> in the top-right to get started.';
    document.querySelector('.kpi-row').style.opacity = '0.15';
    document.querySelector('.hero-curve').style.opacity = '0.15';
    document.querySelector('.hero-split').style.opacity = '0.15';
  }
  window.TA.clearAllData = clearAllData;

  // ---------- FILE INPUT WIRING ----------
  function wireDrop(idx, onData) {
    const drops = document.querySelectorAll('#dataModal .drop');
    const drop = drops[idx]; if (!drop) return;
    const input = drop.querySelector('input[type=file]');
    const tLbl = drop.querySelector('.drop-s');

    function handle(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = onData(ev.target.result, file);
          drop.classList.add('loaded');
          tLbl.textContent = `✓ ${file.name}` + (data ? ` · ${data}` : '');
          updateComputeEnabled();
        } catch (err) {
          tLbl.textContent = '✗ Parse error — check format';
          console.error(err);
        }
      };
      reader.readAsText(file);
    }

    input.addEventListener('change', e => handle(e.target.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag');
      handle(e.dataTransfer.files[0]);
    });
  }

  function updateComputeEnabled() {
    const btn = document.querySelector('#dataModal .btn-primary'); if (!btn) return;
    const foReady = !!(state.foRaw && state.foPnl);
    const eqReady = !!(state.eqPnl); // only P&L required; tradebook is optional
    btn.disabled = !(foReady || eqReady);
    btn.style.opacity = btn.disabled ? .5 : 1;
    btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
  }

  // ---------- FOLDER AUTO-DETECT (multi-year + CDS) ----------

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = () => reject(new Error('Failed to read ' + file.name));
      r.readAsText(file);
    });
  }

  // Collect files from a dragged directory entry, preserving relative paths as {file, relPath}
  function readDirEntry(entry, out, base) {
    base = base || '';
    return new Promise(resolve => {
      entry.createReader().readEntries(async entries => {
        for (const e of entries) {
          const p = base ? base + '/' + e.name : e.name;
          if (e.isFile) await new Promise(r => e.file(f => { out.push({ file: f, relPath: p }); r(); }));
          else if (e.isDirectory) await readDirEntry(e, out, p);
        }
        resolve();
      });
    });
  }

  // Update an individual drop-zone slot label
  function markDrop(idx, msg) {
    const drops = document.querySelectorAll('#dataModal .drop');
    const drop = drops[idx]; if (!drop) return;
    drop.classList.add('loaded');
    const s = drop.querySelector('.drop-s'); if (s) s.textContent = msg;
  }

  // Merge a CDS P&L into the FO P&L (CDS uses same CSV format, symbols don't collide)
  function mergeCdsPnl(foPnl, cdsPnl) {
    if (!foPnl) return cdsPnl;
    return { charges: foPnl.charges + cdsPnl.charges, positions: { ...foPnl.positions, ...cdsPnl.positions } };
  }

  // Main folder handler — supports both single-year and multi-year root folder
  async function handleFolderFiles(source) {
    const folderEl = document.getElementById('folderDrop');
    const statusEl = folderEl && folderEl.querySelector('.fd-sub');
    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

    // Normalise source to [{file, relPath}]
    let items;
    if (source && source[0] && source[0].relPath !== undefined) {
      items = Array.from(source); // already {file, relPath} from readDirEntry
    } else {
      items = Array.from(source || []).map(f => ({
        file: f,
        relPath: f.webkitRelativePath || f.name
      }));
    }

    // Group by fiscal year found in the path (e.g. "2021-2022")
    const byFy = {}, flat = [];
    items.forEach(({ file, relPath }) => {
      const m = relPath.match(/(\d{4}-\d{4})/);
      if (m) (byFy[m[1]] = byFy[m[1]] || []).push({ file, relPath });
      else   flat.push({ file, relPath });
    });

    const fyKeys = Object.keys(byFy).sort();

    // Helper: find file in a list by name pattern
    const pick = (list, re) => { const x = list.find(({ file }) => re.test(file.name.toLowerCase())); return x && x.file; };

    // ---- MULTI-YEAR ROOT FOLDER ----
    if (fyKeys.length > 0) {
      window.SEED = null;
      let loaded = 0;

      for (const fy of fyKeys) {
        setStatus(`Loading ${fy}… (${loaded + 1} of ${fyKeys.length})`);
        const fyItems = byFy[fy];

        state.foRaw = null; state.foPnl = null; state.eqRaw = null; state.eqPnl = null;

        const foTbF  = pick(fyItems, /tradebook.*-fo\.csv$/);
        const foPnlF = pick(fyItems, /pnl.*fno.*\.csv$/);
        const eqTbF  = pick(fyItems, /tradebook.*-eq\.csv$/);
        const eqPnlF = pick(fyItems, /pnl.*_eq.*\.csv$/);
        const cdsTbF = pick(fyItems, /tradebook.*-cds\.csv$/);
        const cdsPnlF= pick(fyItems, /pnl.*_cds.*\.csv$/);

        if (foTbF)  state.foRaw = parseCSV(await readFileText(foTbF));
        if (foPnlF) state.foPnl = parsePnlCSV(await readFileText(foPnlF));
        if (eqTbF)  state.eqRaw = parseCSV(await readFileText(eqTbF));
        if (eqPnlF) state.eqPnl = parsePnlCSV(await readFileText(eqPnlF));

        if (cdsTbF) {
          const rows = parseCSV(await readFileText(cdsTbF));
          state.foRaw = [...(state.foRaw || []), ...rows];
        }
        if (cdsPnlF) state.foPnl = mergeCdsPnl(state.foPnl, parsePnlCSV(await readFileText(cdsPnlF)));

        if (state.foPnl || state.eqPnl) { computeAndApply(true); loaded++; }
      }

      if (!loaded) { setStatus('No Zerodha CSV pairs found — check folder structure'); return; }

      const S = window.SEED;
      const foN = S && S.trades ? S.trades.length : 0;
      const eqN = S && S.equity ? S.equity.total : 0;
      markDrop(0, `✓ ${loaded} FY · ${foN} F&O positions`);
      markDrop(1, `✓ ${loaded} FY · ${foN} F&O positions`);
      if (eqN) { markDrop(2, `✓ ${loaded} FY · ${eqN} equity positions`); markDrop(3, `✓ ${loaded} FY · ${eqN} equity positions`); }
      setStatus(`✓ ${loaded} financial year${loaded > 1 ? 's' : ''} loaded (${fyKeys.slice(0, loaded).join(', ')})`);

      Object.keys(state).forEach(k => { if (k !== 'niftyOhlc') state[k] = null; });
      if (window.DASHBOARD_REDRAW) window.DASHBOARD_REDRAW();
      if (window.TA && window.TA.buildFYOptions) window.TA.buildFYOptions();
      if (window.TA && window.TA.saveSeed) window.TA.saveSeed();
      document.getElementById('dataModal').hidden = true;
      return;
    }

    // ---- SINGLE YEAR FOLDER (flat file list) ----
    const foTbF  = pick(flat, /tradebook.*-fo\.csv$/);
    const foPnlF = pick(flat, /pnl.*fno.*\.csv$/);
    const eqTbF  = pick(flat, /tradebook.*-eq\.csv$/);
    const eqPnlF = pick(flat, /pnl.*_eq.*\.csv$/);
    const cdsTbF = pick(flat, /tradebook.*-cds\.csv$/);
    const cdsPnlF= pick(flat, /pnl.*_cds.*\.csv$/);

    if (foTbF)  { state.foRaw = parseCSV(await readFileText(foTbF));    markDrop(0, `✓ ${foTbF.name} · ${state.foRaw.length} rows`); }
    if (foPnlF) { state.foPnl = parsePnlCSV(await readFileText(foPnlF)); markDrop(1, `✓ ${foPnlF.name} · ${Object.keys(state.foPnl.positions).length} symbols · ₹${Math.round(state.foPnl.charges)} charges`); }
    if (eqTbF)  { state.eqRaw = parseCSV(await readFileText(eqTbF));    markDrop(2, `✓ ${eqTbF.name} · ${state.eqRaw.length} rows`); }
    if (eqPnlF) { state.eqPnl = parsePnlCSV(await readFileText(eqPnlF)); markDrop(3, `✓ ${eqPnlF.name} · ${Object.keys(state.eqPnl.positions).length} symbols`); }

    if (cdsTbF) {
      const rows = parseCSV(await readFileText(cdsTbF));
      state.foRaw = [...(state.foRaw || []), ...rows];
      markDrop(0, `✓ FO+CDS · ${state.foRaw.length} rows`);
    }
    if (cdsPnlF) {
      state.foPnl = mergeCdsPnl(state.foPnl, parsePnlCSV(await readFileText(cdsPnlF)));
      markDrop(1, `✓ FO+CDS · ${Object.keys(state.foPnl.positions).length} symbols · ₹${Math.round(state.foPnl.charges)} charges`);
    }

    const anyFound = foTbF || foPnlF || eqTbF || eqPnlF || cdsTbF || cdsPnlF;
    if (!anyFound) { setStatus('No Zerodha CSV files recognised — check filenames'); return; }

    setStatus('Files matched — computing…');
    updateComputeEnabled();
    computeAndApply(false);
  }

  function wireFolderDrop() {
    const folderEl = document.getElementById('folderDrop');
    const folderInput = document.getElementById('folderInput');
    if (!folderEl || !folderInput) return;

    folderInput.addEventListener('change', e => handleFolderFiles(e.target.files).catch(console.error));

    folderEl.addEventListener('dragover', e => { e.preventDefault(); folderEl.classList.add('drag'); });
    folderEl.addEventListener('dragleave', () => folderEl.classList.remove('drag'));
    folderEl.addEventListener('drop', async e => {
      e.preventDefault(); folderEl.classList.remove('drag');
      const collected = [];
      for (const item of Array.from(e.dataTransfer.items || [])) {
        if (!item.webkitGetAsEntry) { const f = item.getAsFile && item.getAsFile(); if (f) collected.push({ file: f, relPath: f.name }); continue; }
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) await readDirEntry(entry, collected, entry.name);
        else if (entry && entry.isFile) { const f = item.getAsFile(); if (f) collected.push({ file: f, relPath: f.name }); }
      }
      handleFolderFiles(collected.length ? collected : e.dataTransfer.files).catch(console.error);
    });
  }

  function init() {
    wireDrop(0, text => { state.foRaw = parseCSV(text); return `${state.foRaw.length} rows`; });
    wireDrop(1, text => { state.foPnl = parsePnlCSV(text); return `${Object.keys(state.foPnl.positions).length} symbols · ₹${Math.round(state.foPnl.charges)} charges`; });
    wireDrop(2, text => { state.eqRaw = parseCSV(text); return `${state.eqRaw.length} rows`; });
    wireDrop(3, text => { state.eqPnl = parsePnlCSV(text); return `${Object.keys(state.eqPnl.positions).length} symbols`; });
    wireDrop(4, text => { try { state.niftyOhlc = parseNiftyOhlc(text); } catch (e) { throw new Error('Invalid JSON — ' + e.message); } return `${Object.keys(state.niftyOhlc).length} trading days`; });
    wireFolderDrop();
    const btn = document.querySelector('#dataModal .btn-primary');
    if (btn) { btn.addEventListener('click', () => computeAndApply(false)); btn.textContent = 'Compute & load'; }
    updateComputeEnabled();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
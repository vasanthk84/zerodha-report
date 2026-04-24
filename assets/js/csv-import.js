// ═══════════════════════════════════════════════════════════════
// CSV IMPORT FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════
let foRaw = null, eqRaw = null, foPnlRaw = null, eqPnlRaw = null;

// Parse a standard tradebook CSV (header row + data rows)
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    return obj;
  }).filter(r => r[headers[0]]);
}

// Parse Zerodha P&L CSV (has a multi-line header section before the symbol table)
function parsePnlCSV(text) {
  text = text.replace(/^﻿/, ''); // strip UTF-8 BOM
  const lines = text.split('\n').map(l => l.trim());

  // Extract summary charges from the "Charges,<number>" line
  let charges = 0;
  for (const line of lines) {
    const parts = line.split(',');
    if (parts[0] === 'Charges' && parts[1] && !isNaN(parseFloat(parts[1]))) {
      charges = parseFloat(parts[1]);
      break;
    }
  }

  // Find the symbol data table (starts with "Symbol,ISIN,...")
  const headerIdx = lines.findIndex(l => l.startsWith('Symbol,ISIN,'));
  const positions = {};
  if (headerIdx !== -1) {
    const headers = lines[headerIdx].split(',').map(h => h.trim());
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.startsWith(',')) continue;
      const vals = line.split(',');
      const obj = {};
      headers.forEach((h, j) => obj[h] = (vals[j] || '').trim());
      if (!obj['Symbol']) continue;
      positions[obj['Symbol']] = {
        quantity:         parseFloat(obj['Quantity'])           || 0,
        buy_value:        parseFloat(obj['Buy Value'])          || 0,
        sell_value:       parseFloat(obj['Sell Value'])         || 0,
        realized_pnl:     parseFloat(obj['Realized P&L'])       || 0,
        realized_pnl_pct: parseFloat(obj['Realized P&L Pct.']) || 0,
        unrealized_pnl:   parseFloat(obj['Unrealized P&L'])    || 0,
      };
    }
  }

  return { charges, positions };
}

function parseFoSymbol(sym) {
  const MMAP = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  const m = sym.match(/^([A-Z&]+?)(\d{2})([A-Z]{3})(\d+)(CE|PE|FUT)$/);
  if (m) return {stock:m[1],year:'20'+m[2],month:m[3],month_num:MMAP[m[3]]||0,strike:parseInt(m[4]),opt_type:m[5]};
  return {stock:sym,year:'',month:'',month_num:0,strike:null,opt_type:'UNKNOWN'};
}

const LOT_SIZES = {NIFTY:75,SENSEX:10,INFY:400,BEL:1425,HAL:150,OFSS:75,CAMS:150,HCLTECH:350,BANKEX:15};

function computeAnalytics(foRows, eqRows, foPnl, eqPnl) {
  // Enrich each tradebook row with parsed fields
  foRows.forEach(r => {
    r._dt  = new Date(r.trade_date);
    r._ts  = new Date(r.order_execution_time);
    r._qty = parseFloat(r.quantity) || 0;
    r._price = parseFloat(r.price) || 0;
    const p = parseFoSymbol(r.symbol);
    Object.assign(r, p);
    r._ls = LOT_SIZES[r.stock] || 50;
  });
  eqRows.forEach(r => {
    r._dt  = new Date(r.trade_date);
    r._ts  = new Date(r.order_execution_time);
    r._qty = parseFloat(r.quantity) || 0;
    r._price = parseFloat(r.price) || 0;
  });

  // Index tradebook rows by symbol for quick lookup
  function groupBySymbol(rows) {
    const g = {};
    rows.forEach(r => (g[r.symbol] = g[r.symbol] || []).push(r));
    return g;
  }
  const foGroups = groupBySymbol(foRows);
  const eqGroups = groupBySymbol(eqRows);

  // ── Build F&O positions ──────────────────────────────────────
  // Financial values come from P&L CSV; timing from tradebook.
  const foT = [];
  Object.entries(foPnl.positions).forEach(([sym, pos]) => {
    const trades = (foGroups[sym] || []).sort((a, b) => a._ts - b._ts);
    if (!trades.length) return;

    const firstTrade = trades[0];
    const lastTrade  = trades[trades.length - 1];
    const days_held  = Math.round((lastTrade._dt - firstTrade._dt) / 86400000);

    const parsed = parseFoSymbol(sym);
    const ls  = LOT_SIZES[parsed.stock] || 50;
    const qty = pos.quantity;
    // Average prices derived from P&L CSV values (correct FIFO accounting)
    const open_price  = qty > 0 ? pos.buy_value  / qty : 0;
    const close_price = qty > 0 ? pos.sell_value / qty : 0;
    const pnl = pos.realized_pnl;

    const month_label  = parsed.month && parsed.year
      ? `${parsed.month} ${parsed.year.slice(-2)}` : 'Other';
    const hold_bucket  = days_held === 0 ? '0 Intraday'
      : days_held <= 2  ? '1-2d'
      : days_held <= 7  ? '3-7d'
      : days_held <= 14 ? '8-14d'
      : days_held <= 30 ? '15-30d' : '30d+';
    const price_bucket = open_price < 5   ? 'A < ₹5 (Deep OTM)'
      : open_price < 20  ? 'B ₹5-20 (OTM)'
      : open_price < 50  ? 'C ₹20-50 (Near ATM)'
      : open_price < 150 ? 'D ₹50-150 (ATM)' : 'E > ₹150 (ITM)';

    foT.push({
      symbol: sym, stock: parsed.stock, opt_type: parsed.opt_type,
      strike: parsed.strike, year: parsed.year, month: parsed.month,
      month_num: parsed.month_num, expiry: firstTrade.expiry_date || '',
      quantity: qty, lots: Math.round(qty / ls * 10) / 10,
      open_price:  Math.round(open_price  * 100) / 100,
      close_price: Math.round(close_price * 100) / 100,
      buy_value: pos.buy_value, sell_value: pos.sell_value,
      open_date:  firstTrade.trade_date,
      close_date: lastTrade.trade_date,
      days_held, is_intraday: days_held === 0,
      pnl:        Math.round(pnl * 100) / 100,
      pnl_pct:    Math.round(pos.realized_pnl_pct * 100) / 100,
      pnl_per_lot: Math.round(pnl / Math.max(qty / ls, 0.5) * 100) / 100,
      win: pnl > 0,
      open_hour:   firstTrade._ts.getHours(),
      month_label, hold_bucket, price_bucket,
    });
  });
  foT.sort((a, b) => a.close_date.localeCompare(b.close_date));

  // ── Build EQ positions ───────────────────────────────────────
  const eqT = [];
  Object.entries(eqPnl.positions).forEach(([sym, pos]) => {
    const trades = (eqGroups[sym] || []).sort((a, b) => a._ts - b._ts);
    if (!trades.length) return;

    const buys  = trades.filter(t => t.trade_type === 'buy');
    const sells = trades.filter(t => t.trade_type === 'sell');
    if (!buys.length || !sells.length) return;

    const openDt  = buys[0]._dt;
    const closeDt = sells[sells.length - 1]._dt;
    const days_held = Math.round((closeDt - openDt) / 86400000);
    const qty = pos.quantity;
    const pnl = pos.realized_pnl;

    eqT.push({
      symbol: sym, quantity: qty,
      buy_price:  Math.round((qty > 0 ? pos.buy_value  / qty : 0) * 100) / 100,
      sell_price: Math.round((qty > 0 ? pos.sell_value / qty : 0) * 100) / 100,
      buy_value: pos.buy_value, sell_value: pos.sell_value,
      buy_date:  buys[0].trade_date,
      sell_date: sells[sells.length - 1].trade_date,
      days_held, is_intraday: days_held === 0,
      pnl:     Math.round(pnl * 100) / 100,
      pnl_pct: Math.round(pos.realized_pnl_pct * 100) / 100,
      win: pnl > 0,
    });
  });

  // Cumulative P&L curve
  let cum = 0;
  foT.forEach(t => { cum += t.pnl; t.cum_pnl = Math.round(cum * 100) / 100; });

  // Generic aggregation helper
  function agg(rows, key) {
    const map = {};
    rows.forEach(r => {
      const k = String(r[key] || '');
      if (!map[k]) map[k] = { count: 0, total_pnl: 0, wins: 0 };
      map[k].count++; map[k].total_pnl += r.pnl; if (r.win) map[k].wins++;
    });
    return Object.entries(map).map(([k, v]) => {
      const subset = rows.filter(r => String(r[key]) === k);
      return {
        [key]: k, ...v,
        win_rate: Math.round(v.wins / v.count * 1000) / 10,
        avg_pnl:  Math.round(v.total_pnl / v.count * 100) / 100,
        best:     Math.max(...subset.map(r => r.pnl)),
        worst:    Math.min(...subset.map(r => r.pnl)),
        avg_days: Math.round(subset.reduce((a, t) => a + t.days_held, 0) / Math.max(subset.length, 1) * 10) / 10,
      };
    });
  }

  const intra = foT.filter(t => t.is_intraday);
  const posi  = foT.filter(t => !t.is_intraday);
  const hbOrder = {'0 Intraday':0,'1-2d':1,'3-7d':2,'8-14d':3,'15-30d':4,'30d+':5};
  const charges_fo = foPnl.charges;
  const charges_eq = eqPnl.charges;

  const safeReduce = (arr, fn) => arr.length ? arr.reduce(fn, arr[0]) : { symbol: '-', pnl: 0 };

  DATA = {
    meta: { client: 'DV1182', period: 'Uploaded data', charges_fo, charges_eq },
    fo: {
      summary: {
        total:    foT.length,
        pnl:      Math.round(foT.reduce((a, t) => a + t.pnl, 0) * 100) / 100,
        net:      Math.round((foT.reduce((a, t) => a + t.pnl, 0) - charges_fo) * 100) / 100,
        wins:     foT.filter(t => t.win).length,
        losses:   foT.filter(t => !t.win).length,
        win_rate: Math.round(foT.filter(t => t.win).length / Math.max(foT.length, 1) * 1000) / 10,
        avg_pnl:  Math.round(foT.reduce((a, t) => a + t.pnl, 0) / Math.max(foT.length, 1) * 100) / 100,
        ce_pnl:   Math.round(foT.filter(t => t.opt_type === 'CE').reduce((a, t) => a + t.pnl, 0) * 100) / 100,
        pe_pnl:   Math.round(foT.filter(t => t.opt_type === 'PE').reduce((a, t) => a + t.pnl, 0) * 100) / 100,
        avg_days: Math.round(foT.reduce((a, t) => a + t.days_held, 0) / Math.max(foT.length, 1) * 10) / 10,
        best:  foT.length ? { sym: safeReduce(foT, (a, b) => b.pnl > a.pnl ? b : a).symbol, pnl: Math.max(...foT.map(t => t.pnl)) } : { sym: '-', pnl: 0 },
        worst: foT.length ? { sym: safeReduce(foT, (a, b) => b.pnl < a.pnl ? b : a).symbol, pnl: Math.min(...foT.map(t => t.pnl)) } : { sym: '-', pnl: 0 },
      },
      intraday: {
        count:    intra.length,
        pnl:      Math.round(intra.reduce((a, t) => a + t.pnl, 0) * 100) / 100,
        win_rate: Math.round(intra.filter(t => t.win).length / Math.max(intra.length, 1) * 1000) / 10,
        avg_pnl:  Math.round(intra.reduce((a, t) => a + t.pnl, 0) / Math.max(intra.length, 1) * 100) / 100,
        wins: intra.filter(t => t.win).length, losses: intra.filter(t => !t.win).length,
      },
      positional: {
        count:    posi.length,
        pnl:      Math.round(posi.reduce((a, t) => a + t.pnl, 0) * 100) / 100,
        win_rate: Math.round(posi.filter(t => t.win).length / Math.max(posi.length, 1) * 1000) / 10,
        avg_pnl:  Math.round(posi.reduce((a, t) => a + t.pnl, 0) / Math.max(posi.length, 1) * 100) / 100,
        wins: posi.filter(t => t.win).length, losses: posi.filter(t => !t.win).length,
      },
      by_stock:  agg(foT, 'stock').sort((a, b) => b.total_pnl - a.total_pnl),
      by_type:   agg(foT, 'opt_type'),
      by_month:  agg(foT, 'month_label'),
      by_hold:   agg(foT, 'hold_bucket').sort((a, b) => (hbOrder[a.hold_bucket] || 9) - (hbOrder[b.hold_bucket] || 9)),
      by_hour:   agg(foT, 'open_hour').sort((a, b) => parseInt(a.open_hour) - parseInt(b.open_hour)),
      by_price:  agg(foT, 'price_bucket').sort((a, b) => a.price_bucket.localeCompare(b.price_bucket)),
      trades:    foT,
      cumulative: foT.map(t => ({ close_date: t.close_date, pnl: t.pnl, cum_pnl: t.cum_pnl, symbol: t.symbol })),
    },
    eq: {
      summary: {
        total:    eqT.length,
        pnl:      Math.round(eqT.reduce((a, t) => a + t.pnl, 0) * 100) / 100,
        net:      Math.round((eqT.reduce((a, t) => a + t.pnl, 0) - charges_eq) * 100) / 100,
        wins:     eqT.filter(t => t.win).length,
        losses:   eqT.filter(t => !t.win).length,
        win_rate: Math.round(eqT.filter(t => t.win).length / Math.max(eqT.length, 1) * 1000) / 10,
        avg_days: Math.round(eqT.reduce((a, t) => a + t.days_held, 0) / Math.max(eqT.length, 1) * 10) / 10,
      },
      by_stock: agg(eqT, 'symbol').sort((a, b) => b.total_pnl - a.total_pnl),
      trades: eqT,
    }
  };

  render();
  document.getElementById('hdrSub').textContent = 'F&O + Equity · Uploaded data · Zerodha';
}

function checkAllReady() {
  const foReady = !!(foRaw && foPnlRaw);
  const eqReady = !!(eqRaw && eqPnlRaw);
  document.getElementById('computeBtn').disabled = !(foReady || eqReady);
}

function recomputeFromUploads() {
  const foReady = !!(foRaw && foPnlRaw);
  const eqReady = !!(eqRaw && eqPnlRaw);
  if (!foReady && !eqReady) {
    alert('Upload at least one complete pair: tradebook + P&L CSV for F&O or Equity.');
    return;
  }
  computeAnalytics(
    foReady ? foRaw    : [],
    eqReady ? eqRaw    : [],
    foReady ? foPnlRaw : { charges: 0, positions: {} },
    eqReady ? eqPnlRaw : { charges: 0, positions: {} }
  );
}

// ── File input wiring ─────────────────────────────────────────

document.getElementById('foFile').addEventListener('change', function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    foRaw = parseCSV(ev.target.result);
    document.getElementById('foStatus').innerHTML =
      `<span class="upload-ok">✓ ${file.name} (${foRaw.length} rows)</span>`;
    checkAllReady();
  };
  reader.readAsText(file);
});

document.getElementById('foPnlFile').addEventListener('change', function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    foPnlRaw = parsePnlCSV(ev.target.result);
    const count = Object.keys(foPnlRaw.positions).length;
    document.getElementById('foPnlStatus').innerHTML =
      `<span class="upload-ok">✓ ${file.name} (${count} symbols)</span>`;
    checkAllReady();
  };
  reader.readAsText(file);
});

document.getElementById('eqFile').addEventListener('change', function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    eqRaw = parseCSV(ev.target.result);
    document.getElementById('eqStatus').innerHTML =
      `<span class="upload-ok">✓ ${file.name} (${eqRaw.length} rows)</span>`;
    checkAllReady();
  };
  reader.readAsText(file);
});

document.getElementById('eqPnlFile').addEventListener('change', function(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    eqPnlRaw = parsePnlCSV(ev.target.result);
    const count = Object.keys(eqPnlRaw.positions).length;
    document.getElementById('eqPnlStatus').innerHTML =
      `<span class="upload-ok">✓ ${file.name} (${count} symbols)</span>`;
    checkAllReady();
  };
  reader.readAsText(file);
});

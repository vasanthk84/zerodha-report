/* ===== Financial Year filter (April 1 – March 31) ===== */
(() => {
  const MONTH_ORD = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 };
  const HOLD_ORD  = { 'Intraday':0,'1–2 days':1,'3–7 days':2,'8–14 d':3,'15–30 d':4,'30 d +':5 };
  const PB_ORD    = { 'Deep OTM':0,'OTM':1,'Near ATM':2,'ATM':3,'ITM':4 };

  function dateToFY(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const s = m >= 4 ? y : y - 1;
    return `${s}-${s + 1}`;
  }

  function fyLabel(fy) {
    const [s, e] = fy.split('-');
    return `FY ${s.slice(-2)}–${e.slice(-2)}`;
  }

  // Ensure aggregation fields exist on trades loaded from Redis (older format)
  function ensureFields(t) {
    if (t.month_label && t.hold_bucket && t.price_bucket) return t;
    const d = t.d || 0;
    const e = t.entry || 0;
    const m = t.sym && t.sym.match(/^[A-Z&]+(\d{2})([A-Z]{3})/);
    return {
      ...t,
      month_label: t.month_label || (m ? `${m[2]} ${m[1]}` : 'OTHER'),
      hold_bucket: t.hold_bucket || (d === 0 ? 'Intraday' : d <= 2 ? '1–2 days' : d <= 7 ? '3–7 days' : d <= 14 ? '8–14 d' : d <= 30 ? '15–30 d' : '30 d +'),
      price_bucket: t.price_bucket || (e < 5 ? 'Deep OTM' : e < 20 ? 'OTM' : e < 50 ? 'Near ATM' : e < 150 ? 'ATM' : 'ITM'),
      price_sub: t.price_sub || (e < 5 ? '< ₹5' : e < 20 ? '₹5 – ₹20' : e < 50 ? '₹20 – ₹50' : e < 150 ? '₹50 – ₹150' : '> ₹150')
    };
  }

  function by(rows, key) {
    const m = {};
    rows.forEach(r => {
      const k = String(r[key] || '');
      if (!m[k]) m[k] = { n: 0, pnl: 0, wins: 0, items: [] };
      m[k].n++; m[k].pnl += r.pnl; if (r.win) m[k].wins++; m[k].items.push(r);
    });
    return Object.entries(m).map(([k, v]) => ({
      key: k, n: v.n, pnl: Math.round(v.pnl), wins: v.wins,
      wr: Math.round(v.wins / Math.max(v.n, 1) * 1000) / 10,
      avgD: +(v.items.reduce((a, x) => a + x.d, 0) / Math.max(v.n, 1)).toFixed(1)
    }));
  }

  function recompute(foT, eqT, master) {
    // Proportional charges based on fraction of trades selected
    const foCharges = Math.round((foT.length / Math.max((master.trades || []).length, 1)) * (master.hero.fo_charges || 0));
    const eqCharges = Math.round((eqT.length / Math.max(((master.equity || {}).trades || []).length, 1)) * (master.hero.eq_charges || 0));

    const foGross = foT.reduce((a, t) => a + t.pnl, 0);
    const eqGross = eqT.reduce((a, t) => a + t.pnl, 0);
    const foNet = foGross - foCharges, eqNet = eqGross - eqCharges;
    const wins = foT.filter(t => t.win).length, losses = foT.length - wins;

    const monthly = by(foT, 'month_label').map(m => {
      const [mn, yr] = m.key.split(' ');
      return { m: m.key, pnl: m.pnl, _ord: (parseInt(yr) || 0) * 100 + (MONTH_ORD[mn] || 0) };
    }).sort((a, b) => a._ord - b._ord);

    let cum = 0;
    const cumulative = foT.map(t => (cum += t.pnl, Math.round(cum)));
    if (!cumulative.length) cumulative.push(0);

    const byStock = by(foT, 'stk').map(s => ({ sym: s.key, pnl: s.pnl, wr: s.wr, n: s.n, wins: s.wins, avgD: s.avgD })).sort((a, b) => b.pnl - a.pnl);
    const byHold   = by(foT, 'hold_bucket').map(h => ({ k: h.key, n: h.n, wr: h.wr, pnl: h.pnl, rating: h.pnl < 0 ? 'bad' : h.wr >= 85 ? 'good' : 'mid' })).sort((a, b) => (HOLD_ORD[a.k] ?? 9) - (HOLD_ORD[b.k] ?? 9));
    const byHour   = by(foT, 'open_hour').map(h => ({ h: String(h.key).padStart(2,'0')+':00', n: h.n, wr: h.wr, _ord: parseInt(h.key) })).sort((a, b) => a._ord - b._ord);
    const byBucket = by(foT, 'price_bucket').map(b => { const item = foT.find(t => t.price_bucket === b.key); return { k: b.key, sub: item ? item.price_sub : '', n: b.n, pnl: b.pnl, wr: b.wr }; }).sort((a, b) => (PB_ORD[a.k] ?? 9) - (PB_ORD[b.k] ?? 9));
    const cepe     = by(foT, 'type').filter(t => t.key === 'CE' || t.key === 'PE').map(t => ({ t: t.key, n: t.n, pnl: t.pnl, wr: t.wr, avg: Math.round(t.pnl / Math.max(t.n, 1)) }));
    const best     = foT.length ? foT.reduce((a, b) => b.pnl > a.pnl ? b : a) : null;
    const worst    = foT.length ? foT.reduce((a, b) => b.pnl < a.pnl ? b : a) : null;

    const eqByStock = {};
    eqT.forEach(t => { if (!eqByStock[t.sym]) eqByStock[t.sym] = { sym: t.sym, pnl: 0, n: 0, wins: 0 }; eqByStock[t.sym].pnl += t.pnl; eqByStock[t.sym].n++; if (t.win) eqByStock[t.sym].wins++; });
    const eqStocks = Object.values(eqByStock).map(s => ({ sym: s.sym, pnl: Math.round(s.pnl), n: s.n, wr: Math.round(s.wins / Math.max(s.n, 1) * 1000) / 10 })).sort((a, b) => b.pnl - a.pnl);
    const eqWins = eqT.filter(t => t.win).length, eqLosses = eqT.length - eqWins;
    const eqAvgHold = eqT.length ? +(eqT.reduce((a, t) => a + t.d, 0) / eqT.length).toFixed(1) : 0;

    return {
      ...master,
      hero: { combined: foNet + eqNet, combinedPct: 0, fo_net: foNet, fo_gross: Math.round(foGross), fo_charges: foCharges, eq_net: Math.round(eqNet), eq_gross: Math.round(eqGross), eq_charges: eqCharges },
      trades: foT, monthly, cumulative,
      stocks: byStock.slice(0, 12), byHold, byHour, byBucket, cepe,
      extras: { best, worst, totalPositions: foT.length, wins, losses, winRate: Math.round(wins / Math.max(foT.length, 1) * 1000) / 10 },
      equity: { ...master.equity, gross: Math.round(eqGross), net: Math.round(eqNet), charges: eqCharges, wins: eqWins, losses: eqLosses, wr: Math.round(eqWins / Math.max(eqT.length, 1) * 1000) / 10, avgHold: eqAvgHold, total: eqT.length, stocks: eqStocks, trades: eqT }
    };
  }

  // Populate the FY select with years found in trade data
  window.TA.buildFYOptions = function () {
    const sel = document.getElementById('fySelect');
    if (!sel || !window.SEED) return;
    const master = window.SEED_MASTER || window.SEED;
    const allTrades = [...(master.trades || []), ...((master.equity && master.equity.trades) || [])];
    const fySet = new Set();
    allTrades.forEach(t => { const fy = dateToFY(t.close); if (fy) fySet.add(fy); });
    const fys = [...fySet].sort();
    sel.innerHTML = '<option value="">All years</option>';
    fys.forEach(fy => {
      const o = document.createElement('option');
      o.value = fy; o.textContent = fyLabel(fy);
      sel.appendChild(o);
    });
    sel.disabled = fys.length === 0;
    if (window.TA._fyActive && fySet.has(window.TA._fyActive)) sel.value = window.TA._fyActive;
  };

  window.TA._fyActive = '';

  function applyFilter(fy) {
    window.TA._fyActive = fy;
    if (!window.SEED) return;
    if (!window.SEED_MASTER) window.SEED_MASTER = window.SEED;
    const master = window.SEED_MASTER;

    if (!fy) {
      window.SEED = master;
    } else {
      const [s] = fy.split('-').map(Number);
      const start = new Date(`${s}-04-01`), end = new Date(`${s + 1}-03-31T23:59:59`);
      const inFY = d => { const dt = new Date(d); return !isNaN(dt) && dt >= start && dt <= end; };
      const foT  = (master.trades || []).map(ensureFields).filter(t => inFY(t.close));
      const eqT  = ((master.equity && master.equity.trades) || []).filter(t => inFY(t.close));
      window.SEED = recompute(foT, eqT, master);
    }

    // Update chrome period label
    const periodSpan = document.querySelector('.tb-period span:nth-child(2)');
    if (periodSpan) periodSpan.textContent = fy ? `${fyLabel(fy)} · ${(window.SEED.trades || []).length} trades` : `All years · ${(window.SEED.trades || []).length} trades`;

    if (window.DASHBOARD_REDRAW) window.DASHBOARD_REDRAW();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('fySelect');
    if (sel) sel.addEventListener('change', e => applyFilter(e.target.value));
  });
})();

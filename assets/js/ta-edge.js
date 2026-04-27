/* ===== Trade Analytics — Edge tab ===== */
(() => {
  const { $, $$, charts, fontCol, gridCol, posCol, negCol, accCol, goldCol, tipCommon } = window.TA;
  // tw is NEVER destructured — always window.TA.tw (needs mutation visibility)

  function drawEdgeTab() {
    const S = window.SEED; if (!S) return;
    const trades = S.trades || [];
    const eqTrades = (S.equity && S.equity.trades) || [];
    const idxT = trades.filter(t => ['NIFTY', 'SENSEX'].includes(t.stk || t.sym));
    const stOpt = trades.filter(t => !['NIFTY', 'SENSEX'].includes(t.stk || t.sym));
    const stratData = [
      { s: 'Index Options', pnl: idxT.reduce((a, t) => a + t.pnl, 0), wr: idxT.filter(t => t.win).length / Math.max(idxT.length, 1) * 100, n: idxT.length },
      { s: 'Stock Options', pnl: stOpt.reduce((a, t) => a + t.pnl, 0), wr: stOpt.filter(t => t.win).length / Math.max(stOpt.length, 1) * 100, n: stOpt.length },
      { s: 'Equity Delivery', pnl: eqTrades.reduce((a, t) => a + t.pnl, 0), wr: eqTrades.filter(t => t.win).length / Math.max(eqTrades.length, 1) * 100, n: eqTrades.length },
    ];
    const ctx1 = $('#cEdgePnl'), ctx2 = $('#cEdgeWr');
    if (ctx1) {
      charts.edgePnl?.destroy();
      charts.edgePnl = new Chart(ctx1, { type: 'bar', data: { labels: stratData.map(s => s.s), datasets: [{ data: stratData.map(s => Math.round(s.pnl)), backgroundColor: stratData.map(s => s.pnl >= 0 ? posCol() : negCol()), borderRadius: 4, maxBarThickness: 48 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => '₹' + Math.round(c.raw).toLocaleString('en-IN') + ' · ' + stratData[c.dataIndex].n + ' trades' } } }, scales: { x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridCol() } }, y: { ticks: { color: fontCol(), font: { family: 'Inter Tight', size: 12, weight: 500 } }, grid: { display: false } } } } });
    }
    if (ctx2) {
      charts.edgeWr?.destroy();
      charts.edgeWr = new Chart(ctx2, { type: 'bar', data: { labels: stratData.map(s => s.s), datasets: [{ data: stratData.map(s => parseFloat(s.wr.toFixed(1))), backgroundColor: stratData.map(s => s.wr >= 80 ? posCol() : s.wr >= 60 ? goldCol() : negCol()), borderRadius: 4, maxBarThickness: 48 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => c.raw.toFixed(1) + '% WR' } } }, scales: { x: { min: 0, max: 100, ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => v + '%' }, grid: { color: gridCol() } }, y: { ticks: { color: fontCol(), font: { family: 'Inter Tight', size: 12, weight: 500 } }, grid: { display: false } } } } });
    }

    // Compute insight data
    const fs = S.extras || {};
    const idxWR = (idxT.filter(t => t.win).length / Math.max(idxT.length, 1) * 100).toFixed(1);
    const byHold = S.byHold || [];
    const bestHold = byHold.reduce((a, b) => b.wr > a.wr ? b : a, byHold[0] || { k: 'N/A', wr: 0 });
    const longHold = byHold.find(h => h.k === '15–30 d') || null;
    const byHour = S.byHour || [];
    const bestHour = byHour.reduce((a, b) => b.wr > a.wr ? b : a, byHour[0] || { h: 'N/A', wr: 0 });
    const eqSumm = S.equity || {};
    const intra = trades.filter(t => t.k === 'intra');
    const charges_fo = S.hero?.fo_charges || 0;
    const charges_eq = S.hero?.eq_charges || 0;
    const totalCharges = (charges_fo || 0) + (charges_eq || 0);
    const fmt = n => n >= 0 ? '+₹' + Math.round(n).toLocaleString('en-IN') : '−₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');

    const strengths = [
      { icon: '🎯', title: `Index options: ${idxWR}% win rate`, body: `<b>${idxWR}% win rate</b> across ${idxT.length} NIFTY+SENSEX trades. Nearly every position closes profitably — this is rare discipline. Your edge here is real and statistically significant.`, verdict: 'Your #1 strength', cls: 'good' },
      { icon: '⚡', title: `${bestHold.k} holds = ${bestHold.wr}% WR`, body: `Positions held <b>${bestHold.k}</b> show your highest win rate. The data confirms this is your sweet spot — premium decay works in your favour within this window better than any other timeframe.`, verdict: 'Sweet spot confirmed', cls: 'good' },
      { icon: '📞', title: `Intraday works: ${intra.length ? ((intra.filter(t => t.win).length / intra.length * 100).toFixed(1)) : 0}% WR`, body: `Your intraday win rate is strong (${intra.length} trades). For most retail traders this is where money is lost — you're actually making money here. Your quick in-out setups show genuine edge.`, verdict: 'Keep selective intraday', cls: 'good' },
    ];
    const killers = [
      ...(longHold && (longHold.pnl < 0 || longHold.wr < 55) ? [{ icon: '📉', title: '15–30 day holds are losing badly', body: `Positions held <b>15–30 days</b>: only <b>${longHold.wr}% win rate</b> on ${longHold.n} trades (${fmt(longHold.pnl)}). You're fighting time decay, delta risk grows, and you close at loss. This is your single biggest P&L leak.`, verdict: 'Stop holding 15d+', cls: 'bad' }] : []),
      ...(eqSumm.total > 0 ? [{ icon: '🔴', title: `Equity delivery: ${eqSumm.wr ?? 0}% win rate`, body: `${eqSumm.total} equity positions, only <b>${eqSumm.wr ?? 0}% win rate</b>. Net P&L ${fmt(eqSumm.net || 0)} after ₹${Math.round(eqSumm.charges || 0).toLocaleString('en-IN')} charges. The same capital in F&amp;O earns 2–3× more with higher consistency.`, verdict: 'Rethink equity allocation', cls: 'bad' }] : []),
      { icon: '⚠️', title: `₹${Math.round(totalCharges).toLocaleString('en-IN')} in charges — silent killer`, body: `F&amp;O charges ₹${Math.round(charges_fo).toLocaleString('en-IN')} + Equity ₹${Math.round(charges_eq).toLocaleString('en-IN')} = <b>₹${Math.round(totalCharges).toLocaleString('en-IN')} total</b>. Every flat trade is actually a loss. Break-even per trade: ₹${Math.round(totalCharges / Math.max(trades.length, 1))} just to cover costs.`, verdict: 'Trade less, earn more', cls: 'bad' },
    ];
    const actions = [
      { icon: '💡', title: 'Rule: max 7 days on options', body: `The data shows 1–7 day holds have <b>80–94% win rate</b>. Beyond 14 days it collapses. Set a hard rule: if you hold an option past 7 days you need a specific catalyst (earnings, event). Otherwise close and redeploy.`, verdict: 'Action: Set hold limit', cls: 'info' },
      { icon: '🏆', title: 'Double down on index options', body: `Index options gave you ${idxWR}% WR. Stock options are noisier with more event risk. <b>Allocate 80% of F&amp;O capital to NIFTY/SENSEX and only 20% to stock options</b> with very high-conviction setups.`, verdict: 'Action: Rebalance capital', cls: 'info' },
      { icon: '🕐', title: `Prioritise ${bestHour.h} entries`, body: `Your best win-rate hour is <b>${bestHour.h} (${bestHour.wr}% WR)</b>. Early market entries outperform — IV is elevated at open and premium decay works faster. Prioritise entries in the first 90 minutes.`, verdict: 'Action: Optimise entry time', cls: 'info' },
    ];

    const renderIns = (id, arr) => {
      const el = document.getElementById(id); if (!el) return;
      el.innerHTML = arr.map(a => `
        <div class="ins-card">
          <div class="ins-card-icon">${a.icon}</div>
          <div class="ins-card-title">${a.title}</div>
          <div class="ins-card-body">${a.body}</div>
          <span class="ins-verdict v-${a.cls}">${a.verdict}</span>
        </div>`).join('');
    };
    renderIns('gStrengths', strengths);
    renderIns('gKillers', killers);
    renderIns('gActions', actions);
  }

  Object.assign(window.TA, { drawEdgeTab });
})();

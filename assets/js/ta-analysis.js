/* ===== Trade Analytics — Analysis panel ===== */
(() => {
  const { $, $$, charts, fontCol, gridCol, posCol, negCol, accCol, goldCol, tipCommon } = window.TA;
  // tw is NEVER destructured — always window.TA.tw (needs mutation visibility)

  function updateVsCard() {
    const S = window.SEED; if (!S) return;
    const trades = S.trades || [];
    const intra = trades.filter(t => t.k === 'intra');
    const posi = trades.filter(t => t.k === 'pos');
    const iWr = intra.length ? (intra.filter(t => t.win).length / intra.length * 100).toFixed(1) : 0;
    const pWr = posi.length ? (posi.filter(t => t.win).length / posi.length * 100).toFixed(1) : 0;
    const iPnl = intra.reduce((a, t) => a + t.pnl, 0);
    const pPnl = posi.reduce((a, t) => a + t.pnl, 0);
    const iAvg = intra.length ? Math.round(iPnl / intra.length) : 0;
    const pAvg = posi.length ? Math.round(pPnl / posi.length) : 0;
    const fmt = n => (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
    const setEl = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    setEl('vsIntraPnl', fmt(iPnl)); setEl('vsIntraWr', iWr + '%'); setEl('vsIntraN', intra.length); setEl('vsIntraAvg', '₹' + Math.abs(iAvg).toLocaleString('en-IN'));
    setEl('vsPosiPnl', fmt(pPnl)); setEl('vsPosiWr', pWr + '%'); setEl('vsPosiN', posi.length); setEl('vsPosiAvg', '₹' + Math.abs(pAvg).toLocaleString('en-IN'));
    const vv = document.getElementById('vsVerdict');
    if (vv) {
      const winner = pPnl > iPnl ? 'Positional' : 'Intraday';
      vv.innerHTML = `${winner}<br><small>edges ahead</small>`;
    }
    const iPnlEl = document.getElementById('vsIntraPnl'); if (iPnlEl) iPnlEl.className = 'vs-pnl ' + (iPnl >= 0 ? 'pos' : 'neg');
    const pPnlEl = document.getElementById('vsPosiPnl'); if (pPnlEl) pPnlEl.className = 'vs-pnl ' + (pPnl >= 0 ? 'pos' : 'neg');
  }

  function drawCEPE() {
    const S = window.SEED; if (!S) return;
    const ctx = $('#cCEPE'); if (!ctx) return;
    charts.cepe?.destroy();
    const ce = S.cepe.find(c => c.t === 'CE') || { pnl: 0, wr: 0, avg: 0, n: 0 };
    const pe = S.cepe.find(c => c.t === 'PE') || { pnl: 0, wr: 0, avg: 0, n: 0 };
    // Update foot
    const foot = $('#cepeFoot');
    if (foot) foot.innerHTML = `<div><span class="ft-k">CE</span> ${ce.n || 0} trades <b class="pos">${ce.pnl >= 0 ? '+' : '−'}₹${Math.abs(ce.pnl).toLocaleString('en-IN')}</b> · ${ce.wr}% WR</div>`
      + `<div><span class="ft-k">PE</span> ${pe.n || 0} trades <b class="pos">${pe.pnl >= 0 ? '+' : '−'}₹${Math.abs(pe.pnl).toLocaleString('en-IN')}</b> · ${pe.wr}% WR</div>`;
    charts.cepe = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['P&L', 'Win Rate %', 'Avg/trade'],
        datasets: [
          { label: 'CE', data: [ce.pnl, ce.wr, ce.avg], backgroundColor: accCol(), borderRadius: 4, maxBarThickness: 30 },
          { label: 'PE', data: [pe.pnl, pe.wr, pe.avg], backgroundColor: goldCol(), borderRadius: 4, maxBarThickness: 30 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: fontCol(), font: { family: 'Inter Tight', size: 11, weight: 600 }, boxWidth: 8, boxHeight: 8 } }, tooltip: tipCommon },
        scales: {
          x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } },
          y: { type: 'logarithmic', ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => v >= 1000 ? (v / 1000) + 'k' : v }, grid: { color: gridCol() } }
        }
      }
    });
  }

  function drawCEPEavg() {
    const S = window.SEED; if (!S) return;
    const ctx = $('#cCEPEavg'); if (!ctx) return;
    charts.cepeAvg?.destroy();
    const ce = S.cepe.find(c => c.t === 'CE') || { avg: 0 };
    const pe = S.cepe.find(c => c.t === 'PE') || { avg: 0 };
    charts.cepeAvg = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['CE Avg/trade', 'PE Avg/trade'],
        datasets: [{ data: [ce.avg, pe.avg], backgroundColor: [accCol(), goldCol()], borderRadius: 4, maxBarThickness: 60 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => '₹' + Math.round(c.raw).toLocaleString('en-IN') } } },
        scales: {
          x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 11 } }, grid: { display: false } },
          y: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(1) + 'k' }, grid: { color: gridCol() } }
        }
      }
    });
  }

  function drawIPStock() {
    const S = window.SEED; if (!S) return;
    const ctx = $('#cIPStock'); if (!ctx) return;
    charts.ipStock?.destroy();
    const keyStocks = ['NIFTY', 'SENSEX', 'INFY', 'BEL', 'HAL', 'OFSS', 'CAMS', 'HCLTECH', 'BANK-N'];
    const trades = S.trades || [];
    const data = keyStocks.map(s => {
      const it = trades.filter(t => (t.stk || t.sym) === s && t.k === 'intra');
      const pt = trades.filter(t => (t.stk || t.sym) === s && t.k !== 'intra');
      const iPnl = it.reduce((a, t) => a + t.pnl, 0);
      const pPnl = pt.reduce((a, t) => a + t.pnl, 0);
      return { stock: s, iPnl, pPnl, hasData: it.length + pt.length > 0 };
    }).filter(d => d.hasData);
    if (!data.length) return;
    charts.ipStock = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.stock),
        datasets: [
          { label: 'Intraday', data: data.map(d => d.iPnl), backgroundColor: 'rgba(181,101,29,0.65)', borderRadius: 3, maxBarThickness: 28 },
          { label: 'Positional', data: data.map(d => d.pPnl), backgroundColor: 'rgba(31,107,78,0.65)', borderRadius: 3, maxBarThickness: 28 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: fontCol(), font: { family: 'Inter Tight', size: 10 }, boxWidth: 10 } }, tooltip: tipCommon },
        scales: {
          x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } },
          y: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridCol() } }
        }
      }
    });
  }

  function drawHours() {
    const S = window.SEED; if (!S) return;
    $('#hours').innerHTML = S.byHour.map(h => {
      const cls = h.wr >= 95 ? 'h4' : h.wr >= 88 ? 'h3' : h.wr >= 80 ? 'h2' : 'h1';
      return `<div class="hour ${cls}">
        <div class="hour-t">${h.h}</div>
        <div class="hour-wr">${h.wr}%</div>
        <div class="hour-n">${h.n} trade${h.n > 1 ? 's' : ''}</div>
      </div>`;
    }).join('');
  }

  function drawHold() {
    const S = window.SEED; if (!S) return;
    $('#holdStrip').innerHTML = S.byHold.map(h => {
      const rating = h.rating === 'good' ? 'good' : h.rating === 'bad' ? 'bad' : '';
      return `<div class="hold-cell ${rating}">
        <div class="hold-k">${h.k}</div>
        <div class="hold-wr">${h.wr}<span class="unit">%</span></div>
        <div class="hold-pnl ${h.pnl >= 0 ? 'pos' : 'neg'}">${h.pnl >= 0 ? '+' : '−'}₹${Math.abs(h.pnl).toLocaleString('en-IN')}</div>
        <div class="hold-count">${h.n} trades</div>
      </div>`;
    }).join('');
  }

  function drawHoldCharts() {
    const S = window.SEED; if (!S) return;
    const hLabels = S.byHold.map(h => h.k);
    const ctx1 = $('#cHoldWr'), ctx2 = $('#cHoldPnl');
    if (ctx1) {
      charts.holdWr?.destroy();
      charts.holdWr = new Chart(ctx1, { type: 'bar', data: { labels: hLabels, datasets: [{ data: S.byHold.map(h => h.wr), backgroundColor: S.byHold.map(h => h.wr >= 80 ? posCol() : negCol()), borderRadius: 3, maxBarThickness: 36 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => `${c.raw}% WR` } } }, scales: { x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } }, y: { min: 0, max: 100, ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => v + '%' }, grid: { color: gridCol() } } } } });
    }
    if (ctx2) {
      charts.holdPnl?.destroy();
      charts.holdPnl = new Chart(ctx2, { type: 'bar', data: { labels: hLabels, datasets: [{ data: S.byHold.map(h => h.pnl), backgroundColor: S.byHold.map(h => h.pnl >= 0 ? posCol() : negCol()), borderRadius: 3, maxBarThickness: 36 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => '₹' + c.raw.toLocaleString('en-IN') } } }, scales: { x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } }, y: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridCol() } } } } });
    }
  }

  function drawHourPnl() {
    const S = window.SEED; if (!S) return;
    const ctx = $('#cHourPnl'); if (!ctx) return;
    charts.hourPnl?.destroy();
    // Build hour P&L from trades if available, otherwise use byHour with estimated totals
    const hourMap = {};
    (S.trades || []).forEach(t => {
      const h = t.open_hour;
      if (h === undefined) return;
      if (!hourMap[h]) hourMap[h] = 0;
      hourMap[h] += t.pnl;
    });
    const labels = S.byHour.map(h => h.h);
    const pnls = S.byHour.map(h => {
      const hNum = parseInt(h.h);
      return hourMap[hNum] !== undefined ? Math.round(hourMap[hNum]) : 0;
    });
    charts.hourPnl = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: pnls, backgroundColor: pnls.map(v => v >= 0 ? posCol() : negCol()), borderRadius: 4, maxBarThickness: 36 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => '₹' + Math.round(c.raw).toLocaleString('en-IN') } } }, scales: { x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 11 } }, grid: { display: false } }, y: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridCol() } } } }
    });
  }

  function drawBuckets() {
    const S = window.SEED; if (!S) return;
    const maxAbs = Math.max(...S.byBucket.map(b => Math.abs(b.pnl)));
    $('#buckets').innerHTML = S.byBucket.map(b => {
      const pct = (Math.abs(b.pnl) / maxAbs) * 100;
      return `<div class="bkt">
        <div class="bkt-lbl">${b.k}<small>${b.sub} · ${b.n} trades · ${b.wr}% WR</small></div>
        <div class="bkt-track"><div class="bkt-fill ${b.pnl < 0 ? 'neg' : ''}" style="width:${pct}%"></div></div>
        <div class="bkt-val ${b.pnl >= 0 ? 'pos' : 'neg'}">${b.pnl >= 0 ? '+' : '−'}₹${Math.abs(b.pnl).toLocaleString('en-IN')}</div>
      </div>`;
    }).join('');
  }

  function drawScatter() {
    const S = window.SEED; if (!S) return;
    const ctx = $('#cScatter'); if (!ctx) return;
    charts.scatter?.destroy();
    const trades = S.trades || [];
    const ce = trades.filter(t => t.type === 'CE').map(t => ({ x: t.d, y: t.pnl, sym: t.sym }));
    const pe = trades.filter(t => t.type === 'PE').map(t => ({ x: t.d, y: t.pnl, sym: t.sym }));
    const other = trades.filter(t => t.type !== 'CE' && t.type !== 'PE').map(t => ({ x: t.d, y: t.pnl, sym: t.sym }));
    charts.scatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'CE', data: ce, backgroundColor: 'rgba(181,101,29,0.55)', pointRadius: 4 },
          { label: 'PE', data: pe, backgroundColor: 'rgba(154,122,29,0.55)', pointRadius: 4 },
          { label: 'Other', data: other, backgroundColor: 'rgba(122,114,98,0.4)', pointRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: fontCol(), font: { family: 'Inter Tight', size: 10 }, boxWidth: 8 } },
          tooltip: { ...tipCommon, callbacks: { title: () => '', label: i => `${i.raw.sym}: ₹${Math.round(i.raw.y).toLocaleString('en-IN')} · ${i.raw.x}d held` } }
        },
        scales: {
          x: { title: { display: true, text: 'Days held', color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: gridCol() } },
          y: { title: { display: true, text: 'P&L ₹', color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridCol() } }
        }
      }
    });
  }

  function drawActionPlan() {
    const S = window.SEED; if (!S) return;
    const list = document.getElementById('actionPlanList'); if (!list) return;
    const byHold = S.byHold || [];
    const byBucket = S.byBucket || [];
    const eq = S.equity || {};
    const fmt = n => n >= 0 ? '+₹' + Math.round(n).toLocaleString('en-IN') : '−₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
    const actions = [];

    const longHold = byHold.find(h => h.k === '15–30 d');
    if (longHold && longHold.pnl < 0) {
      actions.push({ title: 'Stop holding past 14 days.',
        body: `The 15–30d bucket is your only negative region (${fmt(longHold.pnl)}). Hard-exit on day 14 or when thesis breaks.`,
        gain: fmt(-longHold.pnl) + ' recovery', gainCls: 'pos' });
    } else {
      const worstHold = byHold.filter(h => h.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
      if (worstHold) {
        actions.push({ title: `Watch ${worstHold.k} holds.`,
          body: `This bucket is your weakest at ${worstHold.wr}% WR (${fmt(worstHold.pnl)}). Tighten exit discipline here.`,
          gain: 'Reduce losses', gainCls: 'pos' });
      }
    }

    const goodBuckets = byBucket.filter(b => b.wr >= 80 && b.pnl > 0);
    if (goodBuckets.length >= 2) {
      const totalPnl = goodBuckets.reduce((a, b) => a + b.pnl, 0);
      const totalN = goodBuckets.reduce((a, b) => a + b.n, 0);
      const avgWr = (goodBuckets.reduce((a, b) => a + b.wr, 0) / goodBuckets.length).toFixed(1);
      const labels = goodBuckets.map(b => b.sub || b.k).join(', ');
      actions.push({ title: `Favour ${labels} entries.`,
        body: `Combined <b>${fmt(totalPnl)} · ${avgWr}% WR</b> across ${totalN} trades. This is where your edge is strongest.`,
        gain: 'Edge: sustained', gainCls: 'pos' });
    } else if (goodBuckets.length === 1) {
      const b = goodBuckets[0];
      actions.push({ title: `Focus on ${b.k} entries.`,
        body: `<b>${fmt(b.pnl)} · ${b.wr}% WR</b> across ${b.n} trades. This is your clearest edge bucket.`,
        gain: 'Strongest bucket', gainCls: 'pos' });
    }

    if (eq.total > 0) {
      const chargeRatio = eq.gross > 0 ? Math.round(eq.charges / eq.gross * 100) : 0;
      if (eq.charges >= eq.gross) {
        actions.push({ title: 'Rethink the equity swing book.',
          body: `Charges are ${chargeRatio}% of gross gains. Either size up with conviction or rotate capital into F&amp;O.`,
          gain: fmt(-eq.charges) + ' bleed', gainCls: 'neg' });
      } else if (eq.wr < 55) {
        actions.push({ title: 'Improve equity stock selection.',
          body: `${eq.wr}% WR on ${eq.total} positions. Fewer, higher-conviction names will improve net.`,
          gain: fmt(eq.net), gainCls: eq.net >= 0 ? 'pos' : 'neg' });
      }
    }

    if (actions.length === 0) {
      list.innerHTML = '<li><div class="act-n">—</div><div class="act-body"><b>Upload your CSVs to generate your personalised action plan.</b><span>Click <b>Data</b> in the top-right to load your F&amp;O and Equity CSVs.</span></div><div class="act-gain">—</div></li>';
      return;
    }

    list.innerHTML = actions.map((a, i) =>
      `<li><div class="act-n">${String(i + 1).padStart(2, '0')}</div><div class="act-body"><b>${a.title}</b><span>${a.body}</span></div><div class="act-gain ${a.gainCls}">${a.gain}</div></li>`
    ).join('');
  }

  function drawAnalysisCharts() {
    updateVsCard();
    drawCEPE();
    drawCEPEavg();
    drawIPStock();
    drawHours();
    drawHold();
    drawHoldCharts();
    drawHourPnl();
    drawBuckets();
    drawScatter();
    drawActionPlan();
  }

  Object.assign(window.TA, { updateVsCard, drawCEPE, drawCEPEavg, drawIPStock, drawHours, drawHold, drawHoldCharts, drawHourPnl, drawBuckets, drawScatter, drawActionPlan, drawAnalysisCharts });
})();

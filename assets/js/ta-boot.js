/* ===== Trade Analytics — Boot / wiring ===== */
(() => {
  const { $, $$ } = window.TA;
  // tw is NEVER destructured — always window.TA.tw (needs mutation visibility)

  function applyTweaks() {
    document.body.dataset.theme = window.TA.tw.theme;
    document.body.dataset.density = window.TA.tw.density;
    document.body.dataset.accent = window.TA.tw.accent;
    // Sync mood attribute and chrome switcher buttons
    const mood = window.TA.tw.mood || 'bloomberg';
    document.body.dataset.mood = mood;
    document.querySelectorAll('#themeSwitch button[data-mood]').forEach(b =>
      b.classList.toggle('on', b.dataset.mood === mood));
    if (!window.SEED) return;
    const S = window.SEED, h = S.hero;
    if (window.TA.tw.hero === "fo") window.TA.setHero("F&O net", h.fo_net, 0, "F&O segment only");
    else if (window.TA.tw.hero === "eq") window.TA.setHero("Equity net", h.eq_net, 0, "Equity segment only");
    else window.TA.setHero("Combined net P&L · after charges", h.combined, h.combinedPct || 0, null);
    window.TA.redrawCharts();
  }

  // ---------- TAB SWITCH ----------
  $$('.tb-tab').forEach(b => b.addEventListener('click', () => {
    $$('.tb-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('#p-' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'trades') window.TA.renderTrades();
    if (b.dataset.tab === 'equity') window.TA.renderEquity();
    if (b.dataset.tab === 'analysis') window.TA.drawAnalysisCharts();
    if (b.dataset.tab === 'overview') window.TA.redrawCharts();
    if (b.dataset.tab === 'edge') window.TA.drawEdgeTab();
    if (b.dataset.tab === 'market') window.TA.drawMarketContext();
    try { window.parent.postMessage({ slideIndexChanged: ['overview', 'trades', 'equity', 'analysis', 'edge', 'market'].indexOf(b.dataset.tab) }, '*'); } catch (e) { }
  }));

  // ---------- MODAL ----------
  $('#btnData').addEventListener('click', () => $('#dataModal').hidden = false);
  $$('[data-close]').forEach(el => el.addEventListener('click', () => $('#dataModal').hidden = true));

  // ---------- CHROME THEME SWITCHER (Bloomberg / Paper / Carbon) ----------
  const themeSwitch = document.getElementById('themeSwitch');
  if (themeSwitch) {
    themeSwitch.addEventListener('click', e => {
      const btn = e.target.closest('button[data-mood]');
      if (!btn) return;
      const mood = btn.dataset.mood;
      const themeMap = { bloomberg: 'dark', carbon: 'dark', paper: 'light' };
      window.TA.tw.mood  = mood;
      window.TA.tw.theme = themeMap[mood] || 'dark';
      persist();
      applyTweaks();
      window.TA.redrawCharts();
    });
  }

  // ---------- IST CLOCK ----------
  function updateClock() {
    const el = document.getElementById('istClock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('en-IN',
      { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- EXPORT BUTTON (no-op stub, prints page) ----------
  const btnExport = document.getElementById('btnExport');
  if (btnExport) {
    btnExport.addEventListener('click', () => window.print());
  }

  // ---------- TWEAKS PANEL ----------
  const tweaksEl = $('#tweaks');
  function showTweaks(on) { tweaksEl.hidden = !on; }
  window.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === '__activate_edit_mode') showTweaks(true);
    if (d.type === '__deactivate_edit_mode') showTweaks(false);
  });
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) { }

  $('#twClose').addEventListener('click', () => {
    showTweaks(false);
    try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (e) { }
  });

  $$('.tweaks .seg, .tweaks .swatches').forEach(grp => {
    grp.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      grp.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      window.TA.tw[grp.dataset.tw] = b.dataset.val;
      persist();
      applyTweaks();
    });
  });

  function persist() {
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { ...window.TA.tw } }, '*'); } catch (e) { }
  }

  function syncPanel() {
    $$('.tweaks [data-tw]').forEach(grp => {
      const val = window.TA.tw[grp.dataset.tw];
      grp.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === val));
    });
  }

  // ---------- EMPTY STATE ----------
  function showEmptyState() {
    // Hide all data-dependent elements and show upload prompt
    document.querySelector('.hero-num').style.opacity = '0.15';
    document.querySelector('.hero-sub').innerHTML = '<span class="serif">Upload your Zerodha CSVs to see your analytics.</span> Click <b>Data</b> in the top-right to get started.';
    document.querySelector('.kpi-row').style.opacity = '0.15';
    document.querySelector('.hero-curve').style.opacity = '0.15';
    document.querySelector('.hero-split').style.opacity = '0.15';
    // Clear leaderboard and trades
    const lb = document.getElementById('leaderboard');
    if (lb) lb.innerHTML = '<div style="padding:24px;color:var(--muted);text-align:center;font-size:13px">Upload F&O CSVs to see stock leaderboard</div>';
    const tb = document.getElementById('tBody');
    if (tb) tb.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Upload your F&O tradebook and P&amp;L CSV to populate the trades table</td></tr>';
    const eb = document.getElementById('eqTBody');
    if (eb) eb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Upload your Equity CSVs to see the equity trade log</td></tr>';
  }

  function restoreDataView() {
    document.querySelector('.hero-num').style.opacity = '1';
    document.querySelector('.kpi-row').style.opacity = '1';
    document.querySelector('.hero-curve').style.opacity = '1';
    document.querySelector('.hero-split').style.opacity = '1';
  }

  window.DASHBOARD_REDRAW = function () {
    const S = window.SEED; if (!S) return;
    // Update hero and split rows
    const h = S.hero;
    const e = S.extras || {};
    // Update split rows
    const rows = document.querySelectorAll('.hero-split .split-row');
    if (rows[0]) {
      rows[0].querySelector('.split-val').textContent = (h.fo_net >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(h.fo_net)).toLocaleString('en-IN');
      rows[0].querySelector('.split-val').className = 'split-val ' + (h.fo_net >= 0 ? 'pos' : 'neg');
      rows[0].querySelector('.split-meta').textContent = `Gross ₹${Math.round(h.fo_gross).toLocaleString('en-IN')} · Charges ₹${Math.round(h.fo_charges).toLocaleString('en-IN')}`;
    }
    if (rows[1]) {
      rows[1].querySelector('.split-val').textContent = (h.eq_net >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(h.eq_net)).toLocaleString('en-IN');
      rows[1].querySelector('.split-val').className = 'split-val ' + (h.eq_net >= 0 ? 'pos' : 'neg');
      rows[1].querySelector('.split-meta').textContent = `Gross ${h.eq_gross >= 0 ? '+' : '−'}₹${Math.abs(Math.round(h.eq_gross)).toLocaleString('en-IN')} · Charges ₹${Math.round(h.eq_charges).toLocaleString('en-IN')}`;
    }
    if (rows[2] && e.best) {
      rows[2].querySelector('.split-lbl').textContent = 'Best trade';
      rows[2].querySelector('.split-val').textContent = e.best.sym;
      rows[2].querySelector('.split-val').className = 'split-val pos';
      rows[2].querySelector('.split-meta').textContent = `+₹${Math.round(e.best.pnl).toLocaleString('en-IN')} · ${e.best.d} day${e.best.d !== 1 ? 's' : ''}`;
    }
    if (rows[3] && e.worst) {
      rows[3].querySelector('.split-val').textContent = e.worst.sym;
      rows[3].querySelector('.split-val').className = 'split-val neg';
      rows[3].querySelector('.split-meta').textContent = `−₹${Math.abs(Math.round(e.worst.pnl)).toLocaleString('en-IN')} · held ${e.worst.d} day${e.worst.d !== 1 ? 's' : ''}`;
    }
    // KPI row
    const kpis = document.querySelectorAll('.kpi .kpi-val');
    if (kpis[0]) kpis[0].innerHTML = `${e.winRate || 0}<span class="unit">%</span>`;
    const bar = document.querySelector('.kpi-bar span'); if (bar) bar.style.width = (e.winRate || 0) + '%';
    const winSub = document.querySelectorAll('.kpi .kpi-sub')[0]; if (winSub) winSub.textContent = `${e.wins || 0} wins · ${e.losses || 0} losses`;
    if (kpis[1]) {
      const avg = Math.round(h.fo_gross / Math.max(e.totalPositions || 1, 1));
      kpis[1].innerHTML = `${avg}<span class="unit">₹</span>`;
    }
    if (kpis[2]) kpis[2].textContent = e.totalPositions || 0;
    const splitKpi = document.querySelector('.kpi-split');
    if (splitKpi) splitKpi.innerHTML = `<span><i class="dot pos"></i>Wins ${e.wins || 0}</span><span><i class="dot neg"></i>Losses ${e.losses || 0}</span>`;
    // Avg hold sub and positional/intraday avg sub
    const kpiSubs = document.querySelectorAll('#p-overview .kpi .kpi-sub');
    const trades = S.trades || [];
    if (kpiSubs[2]) {
      const avgHold = trades.length ? (trades.reduce((a, t) => a + t.d, 0) / trades.length).toFixed(1) : 0;
      kpiSubs[2].textContent = `Avg ${avgHold} days held`;
    }
    if (kpiSubs[1]) {
      const intra = trades.filter(t => t.k === 'intra');
      const posi = trades.filter(t => t.k !== 'intra');
      const iAvg = intra.length ? Math.round(intra.reduce((a, t) => a + t.pnl, 0) / intra.length) : 0;
      const pAvg = posi.length ? Math.round(posi.reduce((a, t) => a + t.pnl, 0) / posi.length) : 0;
      kpiSubs[1].textContent = `Positional ₹${pAvg} · Intraday ₹${iAvg}`;
    }
    // Edge grade
    const wr = e.winRate || 0;
    const grade = wr >= 90 ? 'A+' : wr >= 85 ? 'A' : wr >= 80 ? 'A−' : wr >= 75 ? 'B+' : wr >= 70 ? 'B' : wr >= 65 ? 'B−' : 'C';
    if (kpis[4]) kpis[4].innerHTML = `<span class="serif hi">${grade}</span>`;
    if (kpiSubs[4]) kpiSubs[4].textContent = `${wr}% win rate · ${e.totalPositions || 0} positions`;
    const ce = (S.cepe.find(c => c.t === 'CE') || { pnl: 0, n: 0 });
    const pe = (S.cepe.find(c => c.t === 'PE') || { pnl: 0, n: 0 });
    if (kpis[3]) kpis[3].innerHTML = `${Math.round(ce.pnl / 1000)}k<span class="unit"> / </span>${Math.round(pe.pnl / 1000)}k`;
    const stack = document.querySelector('.stack-bar');
    if (stack) {
      const total = Math.max(ce.pnl + pe.pnl, 1);
      stack.innerHTML = `<span class="stk-ce" style="width:${(ce.pnl / total * 100).toFixed(1)}%"></span><span class="stk-pe" style="width:${(pe.pnl / total * 100).toFixed(1)}%"></span>`;
    }
    const stackLeg = document.querySelector('.stack-leg');
    if (stackLeg) stackLeg.innerHTML = `<span><i class="dot ce"></i>Calls ${ce.n || 0}</span><span><i class="dot pe"></i>Puts ${pe.n || 0}</span>`;

    // Trades heading count
    const tradesCount = document.getElementById('tradesCount');
    if (tradesCount) tradesCount.textContent = `${trades.length} rows`;

    // Period label
    const periodSpan = document.querySelector('.tb-period span:nth-child(2)');
    if (periodSpan) periodSpan.textContent = 'Your data · ' + (e.totalPositions || 0) + ' trades';

    // Overview insights
    window.TA.drawOverviewInsights();

    restoreDataView();
    // Update main hero number (the large ₹ figure + sign + delta)
    const h2 = S.hero;
    if (window.TA.tw.hero === "fo") window.TA.setHero("F&O net", h2.fo_net, 0, "F&O segment only");
    else if (window.TA.tw.hero === "eq") window.TA.setHero("Equity net", h2.eq_net, 0, "Equity segment only");
    else window.TA.setHero("Combined net P&L · after charges", h2.combined, h2.combinedPct || 0, null);
    window.TA.redrawCharts();
    window.TA.renderTrades();
    window.TA.renderEquity();

    // FIX: Charts inside hidden panels (analysis, equity) have zero dimensions
    // when rendered while the panel is display:none. Force a resize after a
    // short delay so Chart.js can measure the canvas correctly.
    setTimeout(() => {
      window.TA.drawAnalysisCharts();
      const activeTab = document.querySelector('.tb-tab.active');
      if (activeTab && activeTab.dataset.tab === 'edge') window.TA.drawEdgeTab();
      if (activeTab && activeTab.dataset.tab === 'market') window.TA.drawMarketContext();
      // Notify Chart.js to resize all registered charts
      Object.values(window.TA.charts).forEach(c => { try { c.resize(); } catch(e){} });
    }, 50);
  };

  // ---------- BOOT ----------
  // Apply theme/density/accent/mood without rendering data (SEED is null until upload)
  document.body.dataset.theme   = window.TA.tw.theme;
  document.body.dataset.density = window.TA.tw.density;
  document.body.dataset.accent  = window.TA.tw.accent;
  document.body.dataset.mood    = window.TA.tw.mood || 'bloomberg';
  // Sync chrome switcher to persisted mood
  document.querySelectorAll('#themeSwitch button[data-mood]').forEach(b =>
    b.classList.toggle('on', b.dataset.mood === (window.TA.tw.mood || 'bloomberg')));
  showEmptyState();
  syncPanel();
  window.addEventListener('resize', () => { window.TA.drawHeroCurve(); window.TA.drawCumulative(); });
  try { window.parent.postMessage({ slideIndexChanged: 0 }, '*'); } catch (e) { }
})();

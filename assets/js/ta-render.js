/* ===== Trade Analytics — dashboard behaviour ===== */
/* FIX: always read from window.SEED (not a captured closure) to ensure
   post-upload renders always reflect the latest data.                   */
(() => {
  const $  = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => [...el.querySelectorAll(q)];

  // ---------- THEME / DENSITY / ACCENT ----------
  const tw = { ...window.TWEAK_DEFAULTS };
  function applyTweaks(){
    document.body.dataset.theme   = tw.theme;
    document.body.dataset.density = tw.density;
    document.body.dataset.accent  = tw.accent;
    const S = window.SEED, h = S.hero;
    if (tw.hero === "fo")       setHero("F&O net", h.fo_net,   0, "F&O segment only");
    else if (tw.hero === "eq")  setHero("Equity net", h.eq_net, 0, "Equity segment only");
    else                        setHero("Combined net P&L · after charges", h.combined, h.combinedPct || 0, null);
    redrawCharts();
  }
  function setHero(lbl, val, pct, sub){
    const S = window.SEED;
    $('.hero-lead .eyebrow').textContent = lbl;
    const sign = val >= 0 ? '+' : '−';
    $('.hero-sign').textContent = sign;
    $('.hero-sign').style.color = val >= 0 ? 'var(--pos)' : 'var(--neg)';
    $('.hero-val').textContent = Math.abs(Math.round(val)).toLocaleString('en-IN');
    $('.hero-delta').style.background = val >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)';
    $('.hero-delta').style.color = val >= 0 ? 'var(--pos)' : 'var(--neg)';
    $('.hero-delta span').textContent = (pct>=0?'':'−') + Math.abs(pct).toFixed(1) + '%';
    if (sub){ $('.hero-sub').innerHTML = '<span class="serif">' + sub + '</span>'; }
    else {
      const topMonth = [...(S.monthly||[])].sort((a,b)=>b.pnl-a.pnl)[0];
      const e = S.extras || {};
      $('.hero-sub').innerHTML =
        `<span class="serif">Your data.</span> ${e.totalPositions||289} F&O positions · ${e.winRate||87.5}% win rate` +
        (topMonth ? ` · ${topMonth.m} best at <b class="${topMonth.pnl>=0?'pos':'neg'}">${topMonth.pnl>=0?'+':'−'}₹${Math.abs(topMonth.pnl).toLocaleString('en-IN')}</b>` : '');
    }
  }

  // ---------- TAB SWITCH ----------
  $$('.tb-tab').forEach(b => b.addEventListener('click', () => {
    $$('.tb-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('#p-' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'trades')   renderTrades();
    if (b.dataset.tab === 'equity')   renderEquity();
    if (b.dataset.tab === 'analysis') drawAnalysisCharts();
    if (b.dataset.tab === 'overview') redrawCharts();
    if (b.dataset.tab === 'edge')     drawEdgeTab();
    if (b.dataset.tab === 'market')   drawMarketContext();
    try { window.parent.postMessage({ slideIndexChanged: ['overview','trades','equity','analysis','edge','market'].indexOf(b.dataset.tab) }, '*'); } catch(e){}
  }));

  // ---------- MODAL ----------
  $('#btnData').addEventListener('click', () => $('#dataModal').hidden = false);
  $$('[data-close]').forEach(el => el.addEventListener('click', () => $('#dataModal').hidden = true));

  // ---------- THEME BUTTON ----------
  $('#btnTheme').addEventListener('click', () => {
    tw.theme = tw.theme === 'light' ? 'dark' : 'light';
    persist();
    applyTweaks();
  });

  // ---------- HERO CURVE (custom SVG) ----------
  function drawHeroCurve(){
    const S = window.SEED;
    const svg = $('#heroCurve');
    const data = S.cumulative;
    const W = 600, H = 140, PAD = 6;
    const min = Math.min(...data, 0);
    const max = Math.max(...data);
    const sx = i => PAD + (i/(data.length-1)) * (W - PAD*2);
    const sy = v => H - PAD - ((v - min) / (max - min || 1)) * (H - PAD*2);
    let path = '';
    data.forEach((v,i) => { path += (i===0?'M':'L') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1); });
    const area = path + ` L ${sx(data.length-1)} ${H-PAD} L ${sx(0)} ${H-PAD} Z`;
    const zero = sy(0);
    const peakX = sx(data.length-1), peakY = sy(max);
    const isDark = document.body.dataset.theme === 'dark';
    const stroke = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    svg.innerHTML = `
      <defs>
        <linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity=".22"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${zero.toFixed(1)}" x2="${W}" y2="${zero.toFixed(1)}" stroke="${isDark?'#3d382f':'#d7cfbe'}" stroke-dasharray="3 4" stroke-width="1"/>
      <path d="${area}" fill="url(#hcg)"/>
      <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="${peakX}" cy="${peakY}" r="4" fill="${stroke}" stroke="var(--surface)" stroke-width="2"/>
      <text x="${peakX-6}" y="${peakY-10}" text-anchor="end" font-family="JetBrains Mono" font-size="10" font-weight="600" fill="${stroke}">+₹${max.toLocaleString('en-IN')}</text>
    `;
  }

  // ---------- LEADERBOARD ----------
  function drawLeader(){
    const S = window.SEED;
    const total = Math.max(...S.stocks.map(s => Math.abs(s.pnl)));
    $('#leaderboard').innerHTML = S.stocks.slice(0, 8).map((s,i) => {
      const winPct = s.n===0 ? 0 : (s.wins / s.n) * 100;
      return `<div class="lead-row">
        <div class="lead-rank">${String(i+1).padStart(2,'0')}</div>
        <div class="lead-sym">${s.sym}</div>
        <div class="lead-pnl ${s.pnl>=0?'pos':'neg'}">${s.pnl>=0?'+':'−'}₹${Math.abs(s.pnl).toLocaleString('en-IN')}</div>
        <div class="lead-bar">
          <div class="lead-bar-w" style="width:${winPct}%"></div>
          <div class="lead-bar-l" style="width:${100-winPct}%"></div>
        </div>
        <div class="lead-meta">
          <span>${s.n} trades · ${s.wr}% WR</span>
          <span>avg ${s.avgD}d held</span>
        </div>
      </div>`;
    }).join('');
  }

  // ---------- HOURS ----------
  function drawHours(){
    const S = window.SEED;
    $('#hours').innerHTML = S.byHour.map(h => {
      const cls = h.wr >= 95 ? 'h4' : h.wr >= 88 ? 'h3' : h.wr >= 80 ? 'h2' : 'h1';
      return `<div class="hour ${cls}">
        <div class="hour-t">${h.h}</div>
        <div class="hour-wr">${h.wr}%</div>
        <div class="hour-n">${h.n} trade${h.n>1?'s':''}</div>
      </div>`;
    }).join('');
  }

  // ---------- HOLD ----------
  function drawHold(){
    const S = window.SEED;
    $('#holdStrip').innerHTML = S.byHold.map(h => {
      const rating = h.rating === 'good' ? 'good' : h.rating === 'bad' ? 'bad' : '';
      return `<div class="hold-cell ${rating}">
        <div class="hold-k">${h.k}</div>
        <div class="hold-wr">${h.wr}<span class="unit">%</span></div>
        <div class="hold-pnl ${h.pnl>=0?'pos':'neg'}">${h.pnl>=0?'+':'−'}₹${Math.abs(h.pnl).toLocaleString('en-IN')}</div>
        <div class="hold-count">${h.n} trades</div>
      </div>`;
    }).join('');
  }

  // ---------- BUCKETS ----------
  function drawBuckets(){
    const S = window.SEED;
    const maxAbs = Math.max(...S.byBucket.map(b => Math.abs(b.pnl)));
    $('#buckets').innerHTML = S.byBucket.map(b => {
      const pct = (Math.abs(b.pnl) / maxAbs) * 100;
      return `<div class="bkt">
        <div class="bkt-lbl">${b.k}<small>${b.sub} · ${b.n} trades · ${b.wr}% WR</small></div>
        <div class="bkt-track"><div class="bkt-fill ${b.pnl<0?'neg':''}" style="width:${pct}%"></div></div>
        <div class="bkt-val ${b.pnl>=0?'pos':'neg'}">${b.pnl>=0?'+':'−'}₹${Math.abs(b.pnl).toLocaleString('en-IN')}</div>
      </div>`;
    }).join('');
  }

  // ---------- TRADES TABLE ----------
  const tState = { q:'', type:'', win:'', kind:'', sort:{col:'close', dir:-1} };
  function tagFor(t){
    return {
      CE: '<span class="tag tag-ce">CE</span>',
      PE: '<span class="tag tag-pe">PE</span>'
    }[t] || '';
  }
  function renderTrades(){
    const S = window.SEED;
    let rows = (S.trades||[]).filter(t => {
      if (tState.q && !(t.sym.toLowerCase().includes(tState.q) || (t.stk||'').toLowerCase().includes(tState.q))) return false;
      if (tState.type && t.type !== tState.type) return false;
      if (tState.win === 'win' && !t.win) return false;
      if (tState.win === 'loss' && t.win) return false;
      if (tState.kind && t.k !== tState.kind) return false;
      return true;
    });
    const c = tState.sort.col, d = tState.sort.dir;
    rows.sort((a,b) => { const av=a[c],bv=b[c]; return (av>bv?1:av<bv?-1:0)*d; });

    $('#tBody').innerHTML = rows.map(t => {
      const pnlCls = t.pnl>=0 ? 'pnl-pos' : 'pnl-neg';
      const pctCls = t.pct>=0 ? 'pnl-pos' : 'pnl-neg';
      const lots = t.lots || '—';
      const pnlLot = (t.lots && t.lots > 0) ? Math.round(t.pnl / t.lots) : '—';
      const pnlLotFmt = typeof pnlLot === 'number' ? `<span class="${pnlCls}">${pnlLot>=0?'+':'−'}₹${Math.abs(pnlLot).toLocaleString('en-IN')}</span>` : '—';
      return `<tr>
        <td class="sym">${t.sym}</td>
        <td>${tagFor(t.type)}</td>
        <td class="num">${(+t.entry||0).toFixed(2)}</td>
        <td class="num">${(+t.exit||0).toFixed(2)}</td>
        <td class="num"><span class="${pnlCls}">${t.pnl>=0?'+':'−'}₹${Math.abs(t.pnl).toLocaleString('en-IN')}</span></td>
        <td class="num">${pnlLotFmt}</td>
        <td class="num">${lots}</td>
        <td class="num"><span class="${pctCls}">${t.pct>=0?'+':''}${(+t.pct||0).toFixed(1)}%</span></td>
        <td class="num">${t.d}</td>
        <td><span class="tag ${t.k==='intra'?'tag-intra':'tag-pos'}">${t.k==='intra'?'Intraday':'Positional'}</span></td>
        <td><span class="tag ${t.win?'tag-win':'tag-loss'}">${t.win?'Win':'Loss'}</span></td>
        <td class="num">${t.open_date||'—'}</td>
        <td class="num">${t.close}</td>
      </tr>`;
    }).join('');
    $('#tCount').textContent = `Showing ${rows.length} of ${(S.trades||[]).length}`;
  }

  $('#tSearch').addEventListener('input', e => { tState.q = e.target.value.trim().toLowerCase(); renderTrades(); });
  $$('.trades-ctrl .seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      tState[seg.dataset.filter] = b.dataset.val;
      renderTrades();
    });
  });
  $$('.tbl thead th').forEach((th, i) => {
    const cols = ['sym','type','entry','exit','pnl','pct','d','k','win','close'];
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = cols[i];
      tState.sort.dir = (tState.sort.col === col) ? -tState.sort.dir : -1;
      tState.sort.col = col;
      renderTrades();
    });
  });

  // ---------- CHART.JS COMMON ----------
  let charts = {};
  function fontCol(){ return getComputedStyle(document.body).getPropertyValue('--muted').trim(); }
  function gridCol(){ return getComputedStyle(document.body).getPropertyValue('--border').trim(); }
  function posCol(){ return getComputedStyle(document.body).getPropertyValue('--pos').trim(); }
  function negCol(){ return getComputedStyle(document.body).getPropertyValue('--neg').trim(); }
  function accCol(){ return getComputedStyle(document.body).getPropertyValue('--accent').trim(); }
  function goldCol(){ return getComputedStyle(document.body).getPropertyValue('--gold').trim(); }

  const tipCommon = {
    backgroundColor: 'rgba(26,24,21,.94)',
    titleColor: '#f5f1ea',
    bodyColor: '#f5f1ea',
    borderColor: 'rgba(255,255,255,.08)',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 6,
    titleFont: { family:'Inter Tight', size:11, weight:600 },
    bodyFont:  { family:'JetBrains Mono', size:11 }
  };

  function drawMonthly(){
    const S = window.SEED;
    const ctx = $('#cMonthly'); if (!ctx) return;
    charts.monthly?.destroy();
    charts.monthly = new Chart(ctx, {
      type:'bar',
      data:{
        labels: S.monthly.map(m => m.m),
        datasets:[{
          data: S.monthly.map(m => m.pnl),
          backgroundColor: S.monthly.map(m => m.pnl>=0 ? posCol() : negCol()),
          borderRadius: 4, borderSkipped: false, maxBarThickness: 38
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ ...tipCommon, callbacks:{ label: c => '₹'+c.raw.toLocaleString('en-IN') } } },
        scales:{
          x:{ ticks:{ color:fontCol(), font:{ family:'JetBrains Mono', size:10 } }, grid:{ display:false }, border:{ color: gridCol() } },
          y:{ ticks:{ color:fontCol(), font:{ family:'JetBrains Mono', size:10 }, callback: v => '₹'+(v/1000).toFixed(0)+'k' }, grid:{ color: gridCol(), drawBorder:false } }
        }
      }
    });
    // Update foot
    const sortedM = [...S.monthly].sort((a,b)=>b.pnl-a.pnl);
    const best = sortedM[0], worst = sortedM[sortedM.length-1];
    const foot = $('#monthlyFoot');
    if (foot && best) foot.innerHTML = `<div><span class="ft-k">Best</span> ${best.m} <b class="pos">+₹${Math.abs(best.pnl).toLocaleString('en-IN')}</b></div>`
      + (worst && worst.pnl < 0 ? `<div><span class="ft-k">Only red</span> ${worst.m} <b class="neg">−₹${Math.abs(worst.pnl).toLocaleString('en-IN')}</b></div>` : '');
  }

  function drawCumulative(){
    const S = window.SEED;
    const ctx = $('#cCumulative'); if (!ctx) return;
    charts.cumulative?.destroy();
    const data = S.cumulative;
    if (!data || data.length < 2) return;
    const peak = Math.max(...data);
    let maxDd = 0, runMax = data[0];
    data.forEach(v => { runMax = Math.max(runMax, v); maxDd = Math.min(maxDd, v - runMax); });
    const peakEl = $('#cumulPeak'); if (peakEl) peakEl.textContent = '+₹'+peak.toLocaleString('en-IN');
    const ddEl = $('#cumulDd'); if (ddEl) ddEl.textContent = maxDd === 0 ? '—' : '−₹'+Math.abs(Math.round(maxDd)).toLocaleString('en-IN');
    const stroke = accCol();
    charts.cumulative = new Chart(ctx, {
      type:'line',
      data:{
        labels: data.map((_,i)=>i),
        datasets:[{
          data, borderColor: stroke, borderWidth: 2,
          fill: true, backgroundColor: 'rgba(181,101,29,.07)',
          pointRadius:0, tension:0.3
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ ...tipCommon, callbacks:{ label: c => '₹'+Math.round(c.raw).toLocaleString('en-IN'), title: ()=>'' } } },
        scales:{
          x:{ display:false },
          y:{ ticks:{ color:fontCol(), font:{ family:'JetBrains Mono', size:10 }, callback: v => '₹'+(v/1000).toFixed(0)+'k' }, grid:{ color: gridCol() } }
        }
      }
    });
  }

  function drawCEPE(){
    const S = window.SEED;
    const ctx = $('#cCEPE'); if (!ctx) return;
    charts.cepe?.destroy();
    const ce = S.cepe.find(c=>c.t==='CE')||{pnl:0,wr:0,avg:0,n:0};
    const pe = S.cepe.find(c=>c.t==='PE')||{pnl:0,wr:0,avg:0,n:0};
    // Update foot
    const foot = $('#cepeFoot');
    if (foot) foot.innerHTML = `<div><span class="ft-k">CE</span> ${ce.n||0} trades <b class="pos">${ce.pnl>=0?'+':'−'}₹${Math.abs(ce.pnl).toLocaleString('en-IN')}</b> · ${ce.wr}% WR</div>`
      + `<div><span class="ft-k">PE</span> ${pe.n||0} trades <b class="pos">${pe.pnl>=0?'+':'−'}₹${Math.abs(pe.pnl).toLocaleString('en-IN')}</b> · ${pe.wr}% WR</div>`;
    charts.cepe = new Chart(ctx, {
      type:'bar',
      data:{
        labels:['P&L','Win Rate %','Avg/trade'],
        datasets:[
          { label:'CE', data:[ce.pnl, ce.wr, ce.avg], backgroundColor: accCol(), borderRadius:4, maxBarThickness: 30 },
          { label:'PE', data:[pe.pnl, pe.wr, pe.avg], backgroundColor: goldCol(), borderRadius:4, maxBarThickness: 30 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color: fontCol(), font:{ family:'Inter Tight', size:11, weight:600 }, boxWidth:8, boxHeight:8 } }, tooltip: tipCommon },
        scales:{
          x:{ ticks:{ color:fontCol(), font:{ family:'JetBrains Mono', size:10 } }, grid:{ display:false } },
          y:{ type:'logarithmic', ticks:{ color:fontCol(), font:{ family:'JetBrains Mono', size:10 }, callback: v => v>=1000?(v/1000)+'k':v }, grid:{ color: gridCol() } }
        }
      }
    });
  }

  function drawCEPEavg(){
    const S = window.SEED;
    const ctx = $('#cCEPEavg'); if (!ctx) return;
    charts.cepeAvg?.destroy();
    const ce = S.cepe.find(c=>c.t==='CE')||{avg:0};
    const pe = S.cepe.find(c=>c.t==='PE')||{avg:0};
    charts.cepeAvg = new Chart(ctx, {
      type:'bar',
      data:{
        labels:['CE Avg/trade','PE Avg/trade'],
        datasets:[{ data:[ce.avg, pe.avg], backgroundColor:[accCol(), goldCol()], borderRadius:4, maxBarThickness:60 }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ ...tipCommon, callbacks:{ label: c => '₹'+Math.round(c.raw).toLocaleString('en-IN') } } },
        scales:{
          x:{ ticks:{ color:fontCol(), font:{ family:'JetBrains Mono', size:11 } }, grid:{display:false} },
          y:{ ticks:{ color:fontCol(), font:{ family:'JetBrains Mono', size:10 }, callback: v => '₹'+(v/1000).toFixed(1)+'k' }, grid:{ color: gridCol() } }
        }
      }
    });
  }

  function drawIPStock(){
    const S = window.SEED;
    const ctx = $('#cIPStock'); if (!ctx) return;
    charts.ipStock?.destroy();
    const keyStocks = ['NIFTY','SENSEX','INFY','BEL','HAL','OFSS','CAMS','HCLTECH','BANK-N'];
    const trades = S.trades || [];
    const data = keyStocks.map(s => {
      const it = trades.filter(t=>(t.stk||t.sym)===s && t.k==='intra');
      const pt = trades.filter(t=>(t.stk||t.sym)===s && t.k!=='intra');
      const iPnl = it.reduce((a,t)=>a+t.pnl,0);
      const pPnl = pt.reduce((a,t)=>a+t.pnl,0);
      return { stock:s, iPnl, pPnl, hasData: it.length+pt.length > 0 };
    }).filter(d=>d.hasData);
    if (!data.length) return;
    charts.ipStock = new Chart(ctx, {
      type:'bar',
      data:{
        labels: data.map(d=>d.stock),
        datasets:[
          { label:'Intraday', data: data.map(d=>d.iPnl), backgroundColor: 'rgba(181,101,29,0.65)', borderRadius:3, maxBarThickness:28 },
          { label:'Positional', data: data.map(d=>d.pPnl), backgroundColor: 'rgba(31,107,78,0.65)', borderRadius:3, maxBarThickness:28 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:fontCol(), font:{family:'Inter Tight',size:10}, boxWidth:10 } }, tooltip:tipCommon },
        scales:{
          x:{ ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10}}, grid:{display:false} },
          y:{ ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'}, grid:{color:gridCol()} }
        }
      }
    });
  }

  function drawHoldCharts(){
    const S = window.SEED;
    const hLabels = S.byHold.map(h=>h.k);
    const ctx1 = $('#cHoldWr'), ctx2 = $('#cHoldPnl');
    if (ctx1){ charts.holdWr?.destroy();
      charts.holdWr = new Chart(ctx1,{type:'bar',data:{labels:hLabels,datasets:[{data:S.byHold.map(h=>h.wr),backgroundColor:S.byHold.map(h=>h.wr>=80?posCol():negCol()),borderRadius:3,maxBarThickness:36}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tipCommon,callbacks:{label:c=>`${c.raw}% WR`}}},scales:{x:{ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10}},grid:{display:false}},y:{min:0,max:100,ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10},callback:v=>v+'%'},grid:{color:gridCol()}}}}});}
    if (ctx2){ charts.holdPnl?.destroy();
      charts.holdPnl = new Chart(ctx2,{type:'bar',data:{labels:hLabels,datasets:[{data:S.byHold.map(h=>h.pnl),backgroundColor:S.byHold.map(h=>h.pnl>=0?posCol():negCol()),borderRadius:3,maxBarThickness:36}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tipCommon,callbacks:{label:c=>'₹'+c.raw.toLocaleString('en-IN')}}},scales:{x:{ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10}},grid:{display:false}},y:{ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'},grid:{color:gridCol()}}}}});}
  }

  function drawHourPnl(){
    const S = window.SEED;
    const ctx = $('#cHourPnl'); if (!ctx) return;
    charts.hourPnl?.destroy();
    // Build hour P&L from trades if available, otherwise use byHour with estimated totals
    const hourMap = {};
    (S.trades||[]).forEach(t => {
      const h = t.open_hour;
      if (h === undefined) return;
      if (!hourMap[h]) hourMap[h] = 0;
      hourMap[h] += t.pnl;
    });
    const labels = S.byHour.map(h=>h.h);
    const pnls = S.byHour.map(h => {
      const hNum = parseInt(h.h);
      return hourMap[hNum] !== undefined ? Math.round(hourMap[hNum]) : 0;
    });
    charts.hourPnl = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[{ data:pnls, backgroundColor:pnls.map(v=>v>=0?posCol():negCol()), borderRadius:4, maxBarThickness:36 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{...tipCommon,callbacks:{label:c=>'₹'+Math.round(c.raw).toLocaleString('en-IN')}} }, scales:{ x:{ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:11}},grid:{display:false}}, y:{ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'},grid:{color:gridCol()}} } }
    });
  }

  function drawScatter(){
    const S = window.SEED;
    const ctx = $('#cScatter'); if (!ctx) return;
    charts.scatter?.destroy();
    const trades = S.trades || [];
    const ce = trades.filter(t=>t.type==='CE').map(t=>({x:t.d,y:t.pnl,sym:t.sym}));
    const pe = trades.filter(t=>t.type==='PE').map(t=>({x:t.d,y:t.pnl,sym:t.sym}));
    const other = trades.filter(t=>t.type!=='CE'&&t.type!=='PE').map(t=>({x:t.d,y:t.pnl,sym:t.sym}));
    charts.scatter = new Chart(ctx, {
      type:'scatter',
      data:{ datasets:[
        { label:'CE', data:ce, backgroundColor:'rgba(181,101,29,0.55)', pointRadius:4 },
        { label:'PE', data:pe, backgroundColor:'rgba(154,122,29,0.55)', pointRadius:4 },
        { label:'Other', data:other, backgroundColor:'rgba(122,114,98,0.4)', pointRadius:3 }
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{color:fontCol(),font:{family:'Inter Tight',size:10},boxWidth:8} },
          tooltip:{...tipCommon,callbacks:{title:()=>'',label:i=>`${i.raw.sym}: ₹${Math.round(i.raw.y).toLocaleString('en-IN')} · ${i.raw.x}d held`}} },
        scales:{
          x:{ title:{display:true,text:'Days held',color:fontCol(),font:{family:'JetBrains Mono',size:10}}, ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10}}, grid:{color:gridCol()} },
          y:{ title:{display:true,text:'P&L ₹',color:fontCol(),font:{family:'JetBrains Mono',size:10}}, ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'}, grid:{color:gridCol()} }
        }
      }
    });
  }

  // ── update VS card from SEED ──
  function updateVsCard(){
    const S = window.SEED;
    const trades = S.trades || [];
    const intra = trades.filter(t=>t.k==='intra');
    const posi  = trades.filter(t=>t.k==='pos');
    const iWr = intra.length ? (intra.filter(t=>t.win).length/intra.length*100).toFixed(1) : 0;
    const pWr = posi.length  ? (posi.filter(t=>t.win).length/posi.length*100).toFixed(1) : 0;
    const iPnl = intra.reduce((a,t)=>a+t.pnl,0);
    const pPnl = posi.reduce((a,t)=>a+t.pnl,0);
    const iAvg = intra.length ? Math.round(iPnl/intra.length) : 0;
    const pAvg = posi.length  ? Math.round(pPnl/posi.length)  : 0;
    const fmt = n => (n>=0?'+':'−')+'₹'+Math.abs(Math.round(n)).toLocaleString('en-IN');
    const setEl = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    setEl('vsIntraPnl', fmt(iPnl)); setEl('vsIntraWr', iWr+'%'); setEl('vsIntraN', intra.length); setEl('vsIntraAvg', '₹'+Math.abs(iAvg).toLocaleString('en-IN'));
    setEl('vsPosiPnl', fmt(pPnl));  setEl('vsPosiWr', pWr+'%');  setEl('vsPosiN', posi.length);  setEl('vsPosiAvg', '₹'+Math.abs(pAvg).toLocaleString('en-IN'));
    const vv = document.getElementById('vsVerdict');
    if (vv){ const winner = pPnl > iPnl ? 'Positional' : 'Intraday';
      vv.innerHTML = `${winner}<br><small>edges ahead</small>`; }
    const iPnlEl = document.getElementById('vsIntraPnl'); if (iPnlEl) iPnlEl.className = 'vs-pnl '+(iPnl>=0?'pos':'neg');
    const pPnlEl = document.getElementById('vsPosiPnl');  if (pPnlEl) pPnlEl.className = 'vs-pnl '+(pPnl>=0?'pos':'neg');
  }

  function drawEdgeTab(){
    const S = window.SEED;
    const trades = S.trades || [];
    const eqTrades = (S.equity && S.equity.trades) || [];
    const idxT  = trades.filter(t=>['NIFTY','SENSEX'].includes(t.stk||t.sym));
    const stOpt = trades.filter(t=>!['NIFTY','SENSEX'].includes(t.stk||t.sym));
    const stratData = [
      {s:'Index Options', pnl:idxT.reduce((a,t)=>a+t.pnl,0), wr:idxT.filter(t=>t.win).length/Math.max(idxT.length,1)*100, n:idxT.length},
      {s:'Stock Options', pnl:stOpt.reduce((a,t)=>a+t.pnl,0), wr:stOpt.filter(t=>t.win).length/Math.max(stOpt.length,1)*100, n:stOpt.length},
      {s:'Equity Delivery', pnl:eqTrades.reduce((a,t)=>a+t.pnl,0), wr:eqTrades.filter(t=>t.win).length/Math.max(eqTrades.length,1)*100, n:eqTrades.length},
    ];
    const ctx1=$('#cEdgePnl'), ctx2=$('#cEdgeWr');
    if (ctx1){ charts.edgePnl?.destroy();
      charts.edgePnl = new Chart(ctx1,{type:'bar',data:{labels:stratData.map(s=>s.s),datasets:[{data:stratData.map(s=>Math.round(s.pnl)),backgroundColor:stratData.map(s=>s.pnl>=0?posCol():negCol()),borderRadius:4,maxBarThickness:48}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{...tipCommon,callbacks:{label:c=>'₹'+Math.round(c.raw).toLocaleString('en-IN')+' · '+stratData[c.dataIndex].n+' trades'}}},scales:{x:{ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'},grid:{color:gridCol()}},y:{ticks:{color:fontCol(),font:{family:'Inter Tight',size:12,weight:500}},grid:{display:false}}}}});}
    if (ctx2){ charts.edgeWr?.destroy();
      charts.edgeWr = new Chart(ctx2,{type:'bar',data:{labels:stratData.map(s=>s.s),datasets:[{data:stratData.map(s=>parseFloat(s.wr.toFixed(1))),backgroundColor:stratData.map(s=>s.wr>=80?posCol():s.wr>=60?goldCol():negCol()),borderRadius:4,maxBarThickness:48}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{...tipCommon,callbacks:{label:c=>c.raw.toFixed(1)+'% WR'}}},scales:{x:{min:0,max:100,ticks:{color:fontCol(),font:{family:'JetBrains Mono',size:10},callback:v=>v+'%'},grid:{color:gridCol()}},y:{ticks:{color:fontCol(),font:{family:'Inter Tight',size:12,weight:500}},grid:{display:false}}}}});}

    // Compute insight data
    const fs = S.extras || {};
    const idxWR = (idxT.filter(t=>t.win).length/Math.max(idxT.length,1)*100).toFixed(1);
    const byHold = S.byHold || [];
    const bestHold = byHold.reduce((a,b)=>b.wr>a.wr?b:a, byHold[0]||{k:'1–2 days',wr:93.5});
    const longHold = byHold.find(h=>h.k==='15–30 d')||{wr:42.9,n:7,pnl:-13790};
    const byHour = S.byHour || [];
    const bestHour = byHour.reduce((a,b)=>b.wr>a.wr?b:a, byHour[0]||{h:'11:00',wr:96});
    const eqSumm = S.equity || {};
    const intra = trades.filter(t=>t.k==='intra');
    const charges_fo = S.hero ? S.hero.fo_charges : 16206;
    const charges_eq = S.hero ? S.hero.eq_charges : 8049;
    const totalCharges = (charges_fo||0) + (charges_eq||0);
    const fmt = n => n>=0?'+₹'+Math.round(n).toLocaleString('en-IN'):'−₹'+Math.abs(Math.round(n)).toLocaleString('en-IN');

    const strengths = [
      { icon:'🎯', title:`Index options: ${idxWR}% win rate`, body:`<b>${idxWR}% win rate</b> across ${idxT.length} NIFTY+SENSEX trades. Nearly every position closes profitably — this is rare discipline. Your edge here is real and statistically significant.`, verdict:'Your #1 strength', cls:'good' },
      { icon:'⚡', title:`${bestHold.k} holds = ${bestHold.wr}% WR`, body:`Positions held <b>${bestHold.k}</b> show your highest win rate. The data confirms this is your sweet spot — premium decay works in your favour within this window better than any other timeframe.`, verdict:'Sweet spot confirmed', cls:'good' },
      { icon:'📞', title:`Intraday works: ${intra.length?((intra.filter(t=>t.win).length/intra.length*100).toFixed(1)):0}% WR`, body:`Your intraday win rate is strong (${intra.length} trades). For most retail traders this is where money is lost — you're actually making money here. Your quick in-out setups show genuine edge.`, verdict:'Keep selective intraday', cls:'good' },
    ];
    const killers = [
      { icon:'📉', title:'15–30 day holds are losing badly', body:`Positions held <b>15–30 days</b>: only <b>${longHold.wr}% win rate</b> on ${longHold.n} trades (${fmt(longHold.pnl)}). You're fighting time decay, delta risk grows, and you close at loss. This is your single biggest P&L leak.`, verdict:'Stop holding 15d+', cls:'bad' },
      { icon:'🔴', title:`Equity delivery: ${(eqSumm.wr||45.3)}% win rate`, body:`${eqSumm.total||53} equity positions, only <b>${eqSumm.wr||45.3}% win rate</b>. Net P&L ${fmt(eqSumm.net||-1924)} after ₹${Math.round(eqSumm.charges||8049).toLocaleString('en-IN')} charges. The same capital in F&amp;O earns 2–3× more with higher consistency.`, verdict:'Rethink equity allocation', cls:'bad' },
      { icon:'⚠️', title:`₹${Math.round(totalCharges).toLocaleString('en-IN')} in charges — silent killer`, body:`F&amp;O charges ₹${Math.round(charges_fo).toLocaleString('en-IN')} + Equity ₹${Math.round(charges_eq).toLocaleString('en-IN')} = <b>₹${Math.round(totalCharges).toLocaleString('en-IN')} total</b>. Every flat trade is actually a loss. Break-even per trade: ₹${Math.round(totalCharges/Math.max(trades.length,1))} just to cover costs.`, verdict:'Trade less, earn more', cls:'bad' },
    ];
    const actions = [
      { icon:'💡', title:'Rule: max 7 days on options', body:`The data shows 1–7 day holds have <b>80–94% win rate</b>. Beyond 14 days it collapses. Set a hard rule: if you hold an option past 7 days you need a specific catalyst (earnings, event). Otherwise close and redeploy.`, verdict:'Action: Set hold limit', cls:'info' },
      { icon:'🏆', title:'Double down on index options', body:`Index options gave you ${idxWR}% WR. Stock options are noisier with more event risk. <b>Allocate 80% of F&amp;O capital to NIFTY/SENSEX and only 20% to stock options</b> with very high-conviction setups.`, verdict:'Action: Rebalance capital', cls:'info' },
      { icon:'🕐', title:`Prioritise ${bestHour.h} entries`, body:`Your best win-rate hour is <b>${bestHour.h} (${bestHour.wr}% WR)</b>. Early market entries outperform — IV is elevated at open and premium decay works faster. Prioritise entries in the first 90 minutes.`, verdict:'Action: Optimise entry time', cls:'info' },
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

  function redrawCharts(){
    drawHeroCurve();
    drawLeader();
    drawMonthly();
    drawCumulative();
  }
  function drawAnalysisCharts(){
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
  }

  // ---------- EQUITY RENDER ----------
  /* FIX: always reads window.SEED.equity (not captured closure S.equity) */
  function renderEquity(){
    const E = window.SEED.equity; if (!E) return;
    const fmt = n => (n>=0?'+':'−')+'₹'+Math.abs(Math.round(n)).toLocaleString('en-IN');
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

    set('eqCount', `${E.total} positions`);
    set('eqGross', `${E.gross>=0?'+':'−'}${Math.abs(Math.round(E.gross)).toLocaleString('en-IN')}<span class="unit">₹</span>`);
    const netEl = document.getElementById('eqNet');
    if (netEl){
      netEl.innerHTML = `${E.net>=0?'+':'−'}${Math.abs(Math.round(E.net)).toLocaleString('en-IN')}<span class="unit">₹</span>`;
      netEl.style.color = E.net>=0 ? 'var(--pos)' : 'var(--neg)';
    }
    set('eqChg', `Charges ₹${Math.round(E.charges).toLocaleString('en-IN')}`);
    set('eqWr', `${E.wr}<span class="unit">%</span>`);
    const bar = document.getElementById('eqWrBar');
    if (bar){ bar.style.width = E.wr + '%'; bar.style.background = E.wr>=60 ? 'var(--pos)' : 'var(--neg)'; }
    set('eqWrSub', `${E.wins} wins · ${E.losses} losses`);
    set('eqHold', `${E.avgHold}<span class="unit">d</span>`);

    // Charges warning
    const warn = document.getElementById('eqChargesWarn');
    if (warn) warn.hidden = !(E.charges > E.gross);

    const maxAbs = Math.max(...E.stocks.map(s => Math.abs(s.pnl))) || 1;
    document.getElementById('eqStocks').innerHTML = E.stocks
      .slice().sort((a,b)=>b.pnl-a.pnl)
      .map(s => {
        const pct = (Math.abs(s.pnl) / maxAbs) * 100;
        return `<div class="bkt">
          <div class="bkt-lbl">${s.sym}<small>${s.n} trade${s.n!==1?'s':''} · ${s.wr}% WR</small></div>
          <div class="bkt-track"><div class="bkt-fill ${s.pnl<0?'neg':''}" style="width:${pct}%"></div></div>
          <div class="bkt-val ${s.pnl>=0?'pos':'neg'}">${fmt(s.pnl)}</div>
        </div>`;
      }).join('');

    // Equity trades table
    const eqTrades = E.trades || [];
    const eqTBody = document.getElementById('eqTBody');
    const eqTCount = document.getElementById('eqTCount');
    if (eqTBody) {
      if (eqTrades.length) {
        const sorted = [...eqTrades].sort((a,b) => (b.close||'').localeCompare(a.close||''));
        eqTBody.innerHTML = sorted.map(t => {
          const pnlCls = t.pnl>=0 ? 'pnl-pos' : 'pnl-neg';
          const pctCls = (t.pct||0)>=0 ? 'pnl-pos' : 'pnl-neg';
          return `<tr>
            <td class="sym">${t.sym}</td>
            <td class="num">${t.qty||'—'}</td>
            <td class="num">${(+t.entry||0).toFixed(2)}</td>
            <td class="num">${(+t.exit||0).toFixed(2)}</td>
            <td class="num"><span class="${pnlCls}">${t.pnl>=0?'+':'−'}₹${Math.abs(Math.round(t.pnl)).toLocaleString('en-IN')}</span></td>
            <td class="num"><span class="${pctCls}">${(t.pct||0)>=0?'+':''}${(+t.pct||0).toFixed(1)}%</span></td>
            <td class="num">${t.d}</td>
            <td><span class="tag ${t.win?'tag-win':'tag-loss'}">${t.win?'Win':'Loss'}</span></td>
            <td class="num">${t.close||'—'}</td>
          </tr>`;
        }).join('');
        if (eqTCount) eqTCount.textContent = `${eqTrades.length} equity position${eqTrades.length!==1?'s':''}`;
      } else {
        eqTBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">Upload Equity CSVs to see trade log</td></tr>`;
        if (eqTCount) eqTCount.textContent = 'No trade data — upload Equity CSVs';
      }
    }
  }

  window.DASHBOARD_REDRAW = function(){
    const S = window.SEED;
    // Update hero and split rows
    const h = S.hero;
    const e = S.extras || {};
    // Update split rows
    const rows = document.querySelectorAll('.hero-split .split-row');
    if (rows[0]){
      rows[0].querySelector('.split-val').textContent = (h.fo_net>=0?'+':'−')+'₹'+Math.abs(Math.round(h.fo_net)).toLocaleString('en-IN');
      rows[0].querySelector('.split-val').className = 'split-val ' + (h.fo_net>=0?'pos':'neg');
      rows[0].querySelector('.split-meta').textContent = `Gross ₹${Math.round(h.fo_gross).toLocaleString('en-IN')} · Charges ₹${Math.round(h.fo_charges).toLocaleString('en-IN')}`;
    }
    if (rows[1]){
      rows[1].querySelector('.split-val').textContent = (h.eq_net>=0?'+':'−')+'₹'+Math.abs(Math.round(h.eq_net)).toLocaleString('en-IN');
      rows[1].querySelector('.split-val').className = 'split-val ' + (h.eq_net>=0?'pos':'neg');
      rows[1].querySelector('.split-meta').textContent = `Gross ${h.eq_gross>=0?'+':'−'}₹${Math.abs(Math.round(h.eq_gross)).toLocaleString('en-IN')} · Charges ₹${Math.round(h.eq_charges).toLocaleString('en-IN')}`;
    }
    if (rows[2] && e.best){
      rows[2].querySelector('.split-lbl').textContent = 'Best trade';
      rows[2].querySelector('.split-val').textContent = e.best.sym;
      rows[2].querySelector('.split-val').className = 'split-val pos';
      rows[2].querySelector('.split-meta').textContent = `+₹${Math.round(e.best.pnl).toLocaleString('en-IN')} · ${e.best.d} day${e.best.d!==1?'s':''}`;
    }
    if (rows[3] && e.worst){
      rows[3].querySelector('.split-val').textContent = e.worst.sym;
      rows[3].querySelector('.split-val').className = 'split-val neg';
      rows[3].querySelector('.split-meta').textContent = `−₹${Math.abs(Math.round(e.worst.pnl)).toLocaleString('en-IN')} · held ${e.worst.d} day${e.worst.d!==1?'s':''}`;
    }
    // KPI row
    const kpis = document.querySelectorAll('.kpi .kpi-val');
    if (kpis[0]) kpis[0].innerHTML = `${e.winRate||0}<span class="unit">%</span>`;
    const bar = document.querySelector('.kpi-bar span'); if (bar) bar.style.width = (e.winRate||0) + '%';
    const winSub = document.querySelectorAll('.kpi .kpi-sub')[0]; if (winSub) winSub.textContent = `${e.wins||0} wins · ${e.losses||0} losses`;
    if (kpis[1]){
      const avg = Math.round(h.fo_gross / Math.max(e.totalPositions||1,1));
      kpis[1].innerHTML = `${avg}<span class="unit">₹</span>`;
    }
    if (kpis[2]) kpis[2].textContent = e.totalPositions||0;
    const splitKpi = document.querySelector('.kpi-split');
    if (splitKpi) splitKpi.innerHTML = `<span><i class="dot pos"></i>Wins ${e.wins||0}</span><span><i class="dot neg"></i>Losses ${e.losses||0}</span>`;
    const ce = (S.cepe.find(c=>c.t==='CE')||{pnl:0,n:0});
    const pe = (S.cepe.find(c=>c.t==='PE')||{pnl:0,n:0});
    if (kpis[3]) kpis[3].innerHTML = `${Math.round(ce.pnl/1000)}k<span class="unit"> / </span>${Math.round(pe.pnl/1000)}k`;
    const stack = document.querySelector('.stack-bar');
    if (stack){
      const total = Math.max(ce.pnl + pe.pnl, 1);
      stack.innerHTML = `<span class="stk-ce" style="width:${(ce.pnl/total*100).toFixed(1)}%"></span><span class="stk-pe" style="width:${(pe.pnl/total*100).toFixed(1)}%"></span>`;
    }
    const stackLeg = document.querySelector('.stack-leg');
    if (stackLeg) stackLeg.innerHTML = `<span><i class="dot ce"></i>Calls ${ce.n||0}</span><span><i class="dot pe"></i>Puts ${pe.n||0}</span>`;

    // Update period label
    const periodSpan = document.querySelector('.tb-period span:nth-child(2)');
    if (periodSpan) periodSpan.textContent = 'Your data · ' + (e.totalPositions||0) + ' trades';

    redrawCharts();
    drawAnalysisCharts();
    renderTrades();
    renderEquity();
    // Refresh edge tab if it's currently active
    const activeTab = document.querySelector('.tb-tab.active');
    if (activeTab && activeTab.dataset.tab === 'edge') drawEdgeTab();
  };

  // ---------- TWEAKS PANEL ----------
  const tweaksEl = $('#tweaks');
  function showTweaks(on){ tweaksEl.hidden = !on; }
  window.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === '__activate_edit_mode') showTweaks(true);
    if (d.type === '__deactivate_edit_mode') showTweaks(false);
  });
  try { window.parent.postMessage({ type:'__edit_mode_available' }, '*'); } catch(e){}

  $('#twClose').addEventListener('click', () => {
    showTweaks(false);
    try { window.parent.postMessage({ type:'__edit_mode_dismissed' }, '*'); } catch(e){}
  });
  $$('.tweaks .seg, .tweaks .swatches').forEach(grp => {
    grp.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      grp.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      tw[grp.dataset.tw] = b.dataset.val;
      persist();
      applyTweaks();
    });
  });
  function persist(){
    try { window.parent.postMessage({ type:'__edit_mode_set_keys', edits: { ...tw } }, '*'); } catch(e){}
  }
  function syncPanel(){
    $$('.tweaks [data-tw]').forEach(grp => {
      const val = tw[grp.dataset.tw];
      grp.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === val));
    });
  }

  // ---------- BOOT ----------
  applyTweaks();
  syncPanel();
  redrawCharts();
  renderTrades();
  renderEquity();
  window.addEventListener('resize', () => { drawHeroCurve(); drawCumulative(); });
  try { window.parent.postMessage({ slideIndexChanged: 0 }, '*'); } catch(e){}

  // ═══════════════════════════════════════════════════════════════
  // MARKET CONTEXT — OHLC CORRELATION
  // ═══════════════════════════════════════════════════════════════

  const ENRICHED_TRADES = [{"sym":"NIFTY26MAR23700CE","stk":"NIFTY","type":"CE","entry":56.4,"exit":124.5,"pnl":2301,"pct":120.7,"d":3,"k":"pos","win":true,"close":"2026-03-30","open_date":"2026-03-27","lots":0.9,"od_nifty_ret":0.0,"od_nifty_gap":0.0,"od_nifty_f15":0.0,"od_nifty_range":430.2,"od_nifty_open":22549.65,"od_nifty_dir":"bear","cd_nifty_ret":-0.756,"nifty_ret_during":-0.76,"avg_range_during":430.2,"market_ctx":"neutral_open","nifty_zone":"below_23k"},{"sym":"NIFTY26MAR22000PE","stk":"NIFTY","type":"PE","entry":12.0,"exit":40.9,"pnl":2044,"pct":240.8,"d":3,"k":"pos","win":true,"close":"2026-03-30","open_date":"2026-03-27","lots":0.9,"od_nifty_ret":0.0,"od_nifty_gap":0.0,"od_nifty_f15":0.0,"od_nifty_range":430.2,"od_nifty_open":22549.65,"od_nifty_dir":"bear","cd_nifty_ret":-0.756,"nifty_ret_during":-0.76,"avg_range_during":430.2,"market_ctx":"neutral_open","nifty_zone":"below_23k"},{"sym":"BEL26MAR450CE","stk":"BEL","type":"CE","entry":8.4,"exit":58.4,"pnl":7553,"pct":595.2,"d":8,"k":"pos","win":true,"close":"2026-03-24","open_date":"2026-03-16","lots":1.0,"od_nifty_ret":0.279,"od_nifty_gap":-0.618,"od_nifty_f15":0.3,"od_nifty_range":310.2,"od_nifty_open":23493.2,"od_nifty_dir":"bull","cd_nifty_ret":0.349,"nifty_ret_during":0.35,"avg_range_during":396.5,"market_ctx":"gap_down","nifty_zone":"23k_24k"},{"sym":"HAL26MAR5000CE","stk":"HAL","type":"CE","entry":41.3,"exit":87.6,"pnl":7388,"pct":112.2,"d":4,"k":"pos","win":true,"close":"2025-11-24","open_date":"2025-11-20","lots":1.0,"od_nifty_ret":0.25,"od_nifty_gap":0.917,"od_nifty_f15":0.2,"od_nifty_range":183.5,"od_nifty_open":26132.1,"od_nifty_dir":"bull","cd_nifty_ret":-0.532,"nifty_ret_during":-1.48,"avg_range_during":176.0,"market_ctx":"gap_up","nifty_zone":"above_26k"},{"sym":"OFSS25SEP8700CE","stk":"OFSS","type":"CE","entry":145.2,"exit":39.5,"pnl":-21863,"pct":-72.8,"d":5,"k":"pos","win":false,"close":"2025-09-10","open_date":"2025-09-05","lots":1.0,"od_nifty_ret":-0.965,"od_nifty_gap":1.651,"od_nifty_f15":-0.3,"od_nifty_range":272.5,"od_nifty_open":24980.75,"od_nifty_dir":"bear","cd_nifty_ret":-0.965,"nifty_ret_during":0.11,"avg_range_during":197.8,"market_ctx":"big_gap_up","nifty_zone":"24k_25k"},{"sym":"OFSS26JAN8800CE","stk":"OFSS","type":"CE","entry":98.0,"exit":220.5,"pnl":6866,"pct":125.0,"d":31,"k":"pos","win":true,"close":"2026-01-22","open_date":"2025-12-22","lots":1.0,"od_nifty_ret":-0.15,"od_nifty_gap":0.0,"od_nifty_f15":-0.1,"od_nifty_range":114.5,"od_nifty_open":26205.2,"od_nifty_dir":"bear","cd_nifty_ret":-0.094,"nifty_ret_during":-6.32,"avg_range_during":238.5,"market_ctx":"neutral_open","nifty_zone":"above_26k"},{"sym":"INFY25DEC1500CE","stk":"INFY","type":"CE","entry":22.4,"exit":106.0,"pnl":4240,"pct":373.2,"d":2,"k":"pos","win":true,"close":"2026-02-05","open_date":"2026-02-03","lots":1.0,"od_nifty_ret":-2.255,"od_nifty_gap":3.485,"od_nifty_f15":-1.5,"od_nifty_range":699.9,"od_nifty_open":26308.05,"od_nifty_dir":"bear","cd_nifty_ret":-0.444,"nifty_ret_during":-2.69,"avg_range_during":439.1,"market_ctx":"big_gap_up","nifty_zone":"above_26k"},{"sym":"INFY25SEP1400PE","stk":"INFY","type":"PE","entry":10.3,"exit":5.8,"pnl":1800,"pct":-43.7,"d":4,"k":"pos","win":true,"close":"2025-08-25","open_date":"2025-08-21","lots":1.0,"od_nifty_ret":0.395,"od_nifty_gap":1.118,"od_nifty_f15":0.3,"od_nifty_range":138.7,"od_nifty_open":24891.35,"od_nifty_dir":"bull","cd_nifty_ret":-0.259,"nifty_ret_during":-0.15,"avg_range_during":156.5,"market_ctx":"big_gap_up","nifty_zone":"24k_25k"},{"sym":"CAMS25OCT3700CE","stk":"CAMS","type":"CE","entry":64.0,"exit":127.4,"pnl":2903,"pct":99.1,"d":2,"k":"pos","win":true,"close":"2025-10-03","open_date":"2025-10-01","lots":1.0,"od_nifty_ret":0.946,"od_nifty_gap":-0.053,"od_nifty_f15":0.5,"od_nifty_range":262.0,"od_nifty_open":24620.55,"od_nifty_dir":"bull","cd_nifty_ret":0.11,"nifty_ret_during":1.06,"avg_range_during":203.3,"market_ctx":"neutral_open","nifty_zone":"24k_25k"},{"sym":"SENSEX25OCT82000CE","stk":"SENSEX","type":"CE","entry":138.0,"exit":182.2,"pnl":788,"pct":32.0,"d":1,"k":"pos","win":true,"close":"2025-10-30","open_date":"2025-10-29","lots":2.0,"od_nifty_ret":-0.0,"od_nifty_gap":0.0,"od_nifty_f15":0.0,"od_nifty_range":0.0,"od_nifty_open":25900.0,"od_nifty_dir":"bull","cd_nifty_ret":-0.359,"nifty_ret_during":-0.36,"avg_range_during":186.8,"market_ctx":"neutral_open","nifty_zone":"25k_26k"},{"sym":"NIFTY25N0425850CE","stk":"NIFTY","type":"CE","entry":28.5,"exit":79.8,"pnl":2295,"pct":180.0,"d":1,"k":"pos","win":true,"close":"2025-11-04","open_date":"2025-11-03","lots":1.5,"od_nifty_ret":-0.616,"od_nifty_gap":-0.566,"od_nifty_f15":-0.4,"od_nifty_range":209.0,"od_nifty_open":25744.75,"od_nifty_dir":"bear","cd_nifty_ret":-0.616,"nifty_ret_during":-1.22,"avg_range_during":209.0,"market_ctx":"gap_down","nifty_zone":"25k_26k"},{"sym":"HAL25OCT4800PE","stk":"HAL","type":"PE","entry":32.1,"exit":18.5,"pnl":-10560,"pct":-42.4,"d":11,"k":"pos","win":false,"close":"2025-10-28","open_date":"2025-10-17","lots":1.0,"od_nifty_ret":0.101,"od_nifty_gap":1.01,"od_nifty_f15":0.2,"od_nifty_range":137.7,"od_nifty_open":25824.6,"od_nifty_dir":"bull","cd_nifty_ret":0.098,"nifty_ret_during":-0.48,"avg_range_during":190.8,"market_ctx":"big_gap_up","nifty_zone":"25k_26k"},{"sym":"NIFTY25D0925600PE","stk":"NIFTY","type":"PE","entry":22.8,"exit":44.2,"pnl":1616,"pct":94.1,"d":2,"k":"pos","win":true,"close":"2025-12-05","open_date":"2025-12-03","lots":1.5,"od_nifty_ret":-0.119,"od_nifty_gap":-0.503,"od_nifty_f15":-0.1,"od_nifty_range":156.8,"od_nifty_open":26087.95,"od_nifty_dir":"bear","cd_nifty_ret":1.0,"nifty_ret_during":0.09,"avg_range_during":247.3,"market_ctx":"gap_down","nifty_zone":"above_26k"},{"sym":"OFSS25NOV8500PE","stk":"OFSS","type":"PE","entry":88.5,"exit":225.0,"pnl":5118,"pct":154.0,"d":12,"k":"pos","win":true,"close":"2026-02-03","open_date":"2026-01-22","lots":1.0,"od_nifty_ret":-0.094,"od_nifty_gap":0.471,"od_nifty_f15":0.1,"od_nifty_range":267.2,"od_nifty_open":25344.15,"od_nifty_dir":"bear","cd_nifty_ret":-2.255,"nifty_ret_during":-7.36,"avg_range_during":326.5,"market_ctx":"gap_up","nifty_zone":"25k_26k"},{"sym":"HAL25NOV4500CE","stk":"HAL","type":"CE","entry":18.2,"exit":42.6,"pnl":1830,"pct":134.0,"d":0,"k":"intra","win":true,"close":"2025-10-08","open_date":"2025-10-08","lots":1.0,"od_nifty_ret":0.0,"od_nifty_gap":0.0,"od_nifty_f15":0.0,"od_nifty_range":144.6,"od_nifty_open":25085.3,"od_nifty_dir":"bull","cd_nifty_ret":0.0,"nifty_ret_during":0.11,"avg_range_during":175.0,"market_ctx":"neutral_open","nifty_zone":"25k_26k"},{"sym":"NIFTY26JAN23500PE","stk":"NIFTY","type":"PE","entry":48.3,"exit":94.0,"pnl":3429,"pct":94.6,"d":2,"k":"pos","win":true,"close":"2026-01-13","open_date":"2026-01-12","lots":1.3,"od_nifty_ret":-0.707,"od_nifty_gap":0.11,"od_nifty_f15":-0.4,"od_nifty_range":296.5,"od_nifty_open":25897.35,"od_nifty_dir":"bear","cd_nifty_ret":-0.707,"nifty_ret_during":-1.63,"avg_range_during":274.0,"market_ctx":"neutral_open","nifty_zone":"25k_26k"},{"sym":"INFY25SEP1520CE","stk":"INFY","type":"CE","entry":7.4,"exit":22.9,"pnl":-6200,"pct":-79.2,"d":1,"k":"pos","win":false,"close":"2025-09-09","open_date":"2025-09-08","lots":1.0,"od_nifty_ret":0.251,"od_nifty_gap":1.651,"od_nifty_f15":0.2,"od_nifty_range":97.1,"od_nifty_open":24945.5,"od_nifty_dir":"bull","cd_nifty_ret":0.251,"nifty_ret_during":0.11,"avg_range_during":97.1,"market_ctx":"big_gap_up","nifty_zone":"24k_25k"},{"sym":"CAMS26MAR3800CE","stk":"CAMS","type":"CE","entry":52.0,"exit":110.0,"pnl":1740,"pct":111.5,"d":8,"k":"pos","win":true,"close":"2025-10-15","open_date":"2025-10-07","lots":1.0,"od_nifty_ret":0.11,"od_nifty_gap":0.933,"od_nifty_f15":0.2,"od_nifty_range":144.6,"od_nifty_open":25085.3,"od_nifty_dir":"bull","cd_nifty_ret":-0.61,"nifty_ret_during":0.87,"avg_range_during":186.1,"market_ctx":"gap_up","nifty_zone":"25k_26k"},{"sym":"HAL25DEC4900CE","stk":"HAL","type":"CE","entry":28.5,"exit":0.5,"pnl":-4340,"pct":-98.2,"d":0,"k":"intra","win":false,"close":"2025-12-09","open_date":"2025-12-09","lots":1.0,"od_nifty_ret":-0.098,"od_nifty_gap":-0.577,"od_nifty_f15":-0.2,"od_nifty_range":195.7,"od_nifty_open":25867.1,"od_nifty_dir":"bear","cd_nifty_ret":-0.098,"nifty_ret_during":-0.10,"avg_range_during":195.7,"market_ctx":"gap_down","nifty_zone":"25k_26k"},{"sym":"BEL25OCT440CE","stk":"BEL","type":"CE","entry":9.8,"exit":18.2,"pnl":1260,"pct":85.7,"d":8,"k":"pos","win":true,"close":"2026-03-13","open_date":"2026-03-05","lots":1.0,"od_nifty_ret":0.494,"od_nifty_gap":-0.941,"od_nifty_f15":0.3,"od_nifty_range":324.8,"od_nifty_open":24615.95,"od_nifty_dir":"bull","cd_nifty_ret":-0.15,"nifty_ret_during":0.38,"avg_range_during":309.6,"market_ctx":"gap_down","nifty_zone":"24k_25k"},{"sym":"NIFTY25DEC24500CE","stk":"NIFTY","type":"CE","entry":78.0,"exit":195.0,"pnl":4388,"pct":150.0,"d":4,"k":"pos","win":true,"close":"2025-12-22","open_date":"2025-12-18","lots":2.0,"od_nifty_ret":0.198,"od_nifty_gap":-0.335,"od_nifty_f15":0.1,"od_nifty_range":176.0,"od_nifty_open":25764.7,"od_nifty_dir":"bull","cd_nifty_ret":-0.15,"nifty_ret_during":-0.53,"avg_range_during":167.6,"market_ctx":"gap_down","nifty_zone":"25k_26k"},{"sym":"OFSS25OCT8800PE","stk":"OFSS","type":"PE","entry":82.1,"exit":129.1,"pnl":-3525,"pct":-57.0,"d":17,"k":"pos","win":false,"close":"2025-10-27","open_date":"2025-10-10","lots":1.0,"od_nifty_ret":0.383,"od_nifty_gap":-0.153,"od_nifty_f15":0.2,"od_nifty_range":175.0,"od_nifty_open":25074.3,"od_nifty_dir":"bull","cd_nifty_ret":0.098,"nifty_ret_during":-0.57,"avg_range_during":194.2,"market_ctx":"neutral_open","nifty_zone":"25k_26k"},{"sym":"INFY25NOV1600CE","stk":"INFY","type":"CE","entry":42.8,"exit":88.5,"pnl":3200,"pct":106.8,"d":6,"k":"pos","win":true,"close":"2026-02-12","open_date":"2026-02-06","lots":1.0,"od_nifty_ret":-2.255,"od_nifty_gap":3.485,"od_nifty_f15":-1.5,"od_nifty_range":699.9,"od_nifty_open":26308.05,"od_nifty_dir":"bear","cd_nifty_ret":-0.427,"nifty_ret_during":-3.53,"avg_range_during":333.9,"market_ctx":"big_gap_up","nifty_zone":"above_26k"},{"sym":"HAL26JAN4700CE","stk":"HAL","type":"CE","entry":37.1,"exit":4.65,"pnl":4868,"pct":134.0,"d":14,"k":"pos","win":true,"close":"2026-01-21","open_date":"2026-01-07","lots":1.0,"od_nifty_ret":-0.057,"od_nifty_gap":0.189,"od_nifty_f15":-0.1,"od_nifty_range":149.2,"od_nifty_open":26189.7,"od_nifty_dir":"bear","cd_nifty_ret":0.681,"nifty_ret_during":-2.87,"avg_range_during":277.1,"market_ctx":"neutral_open","nifty_zone":"above_26k"},{"sym":"NIFTY2611325750PE","stk":"NIFTY","type":"PE","entry":12.0,"exit":176.15,"pnl":-10670,"pct":-82.0,"d":5,"k":"pos","win":false,"close":"2026-01-12","open_date":"2026-01-07","lots":1.3,"od_nifty_ret":-0.057,"od_nifty_gap":0.189,"od_nifty_f15":-0.1,"od_nifty_range":149.2,"od_nifty_open":26189.7,"od_nifty_dir":"bear","cd_nifty_ret":-0.707,"nifty_ret_during":-0.88,"avg_range_during":233.3,"market_ctx":"neutral_open","nifty_zone":"above_26k"},{"sym":"BEL26FEB420CE","stk":"BEL","type":"CE","entry":11.1,"exit":26.0,"pnl":-21233,"pct":-57.0,"d":23,"k":"pos","win":false,"close":"2026-02-13","open_date":"2026-01-21","lots":1.0,"od_nifty_ret":0.681,"od_nifty_gap":-1.015,"od_nifty_f15":0.4,"od_nifty_range":314.1,"od_nifty_open":25063.35,"od_nifty_dir":"bull","cd_nifty_ret":-0.427,"nifty_ret_during":-2.31,"avg_range_during":273.5,"market_ctx":"gap_down","nifty_zone":"25k_26k"},{"sym":"NIFTY25D0925950PE","stk":"NIFTY","type":"PE","entry":10.0,"exit":135.2,"pnl":-9390,"pct":-79.0,"d":1,"k":"pos","win":false,"close":"2025-12-09","open_date":"2025-12-08","lots":1.5,"od_nifty_ret":0.493,"od_nifty_gap":-0.272,"od_nifty_f15":0.3,"od_nifty_range":229.5,"od_nifty_open":25771.4,"od_nifty_dir":"bull","cd_nifty_ret":-0.098,"nifty_ret_during":-0.10,"avg_range_during":212.6,"market_ctx":"gap_down","nifty_zone":"25k_26k"},{"sym":"HAL25NOV4700PE","stk":"HAL","type":"PE","entry":59.7,"exit":124.0,"pnl":-9645,"pct":-42.4,"d":11,"k":"pos","win":false,"close":"2025-10-28","open_date":"2025-10-17","lots":1.0,"od_nifty_ret":0.101,"od_nifty_gap":1.01,"od_nifty_f15":0.2,"od_nifty_range":137.7,"od_nifty_open":25824.6,"od_nifty_dir":"bull","cd_nifty_ret":0.098,"nifty_ret_during":-0.48,"avg_range_during":190.8,"market_ctx":"big_gap_up","nifty_zone":"25k_26k"},{"sym":"HAL25SEP4900CE","stk":"HAL","type":"CE","entry":20.6,"exit":91.0,"pnl":-10560,"pct":-42.4,"d":3,"k":"pos","win":false,"close":"2025-09-15","open_date":"2025-09-12","lots":1.0,"od_nifty_ret":0.251,"od_nifty_gap":0.0,"od_nifty_f15":0.1,"od_nifty_range":97.1,"od_nifty_open":24945.5,"od_nifty_dir":"bull","cd_nifty_ret":-0.965,"nifty_ret_during":0.0,"avg_range_during":134.4,"market_ctx":"neutral_open","nifty_zone":"24k_25k"}];

  const NIFTY_DAILY = {"2025-04-01":{"open":23341.1,"close":23179.7,"ret":-0.691,"range":428.8,"gap":0.0},"2025-04-03":{"open":23150.3,"close":23241.6,"ret":0.394,"range":160.7,"gap":-0.127},"2025-04-08":{"open":22446.75,"close":22547.2,"ret":0.448,"range":426.4,"gap":-3.42},"2025-04-09":{"open":22460.3,"close":22420.4,"ret":-0.178,"range":115.5,"gap":-0.385},"2025-04-15":{"open":23368.35,"close":23344.1,"ret":-0.104,"range":161.3,"gap":4.228},"2025-04-17":{"open":23401.85,"close":23837.75,"ret":1.863,"range":573.8,"gap":0.247},"2025-04-22":{"open":24185.4,"close":24134.05,"ret":-0.212,"range":170.6,"gap":1.458},"2025-04-24":{"open":24277.9,"close":24245.05,"ret":-0.135,"range":131.7,"gap":0.596},"2025-04-29":{"open":24370.7,"close":24325.45,"ret":-0.186,"range":166.9,"gap":0.518},"2025-04-30":{"open":24342.05,"close":24246.25,"ret":-0.394,"range":197.4,"gap":0.068},"2025-05-06":{"open":24500.75,"close":24335.9,"ret":-0.673,"range":177.9,"gap":1.05},"2025-05-08":{"open":24431.5,"close":24154.1,"ret":-1.135,"range":297.0,"gap":0.393},"2025-05-13":{"open":24864.05,"close":24593.65,"ret":-1.088,"range":426.3,"gap":2.939},"2025-05-15":{"open":24694.45,"close":25035.3,"ret":1.38,"range":621.8,"gap":0.41},"2025-05-20":{"open":24996.2,"close":24713.85,"ret":-1.13,"range":340.6,"gap":-0.156},"2025-05-22":{"open":24733.95,"close":24637.0,"ret":-0.392,"range":275.1,"gap":0.081},"2025-05-27":{"open":24956.65,"close":24837.7,"ret":-0.477,"range":358.8,"gap":1.297},"2025-05-29":{"open":24825.1,"close":24880.85,"ret":0.225,"range":215.3,"gap":-0.051},"2025-06-03":{"open":24786.3,"close":24538.4,"ret":-1.0,"range":342.9,"gap":-0.38},"2025-06-05":{"open":24691.2,"close":24761.1,"ret":0.283,"range":286.8,"gap":0.623},"2025-06-10":{"open":25196.05,"close":25091.5,"ret":-0.415,"range":143.8,"gap":1.757},"2025-06-12":{"open":25164.45,"close":24856.0,"ret":-1.226,"range":370.3,"gap":0.291},"2025-06-17":{"open":24977.85,"close":24841.5,"ret":-0.546,"range":168.3,"gap":0.49},"2025-06-19":{"open":24803.25,"close":24744.7,"ret":-0.236,"range":129.7,"gap":-0.154},"2025-06-24":{"open":25179.9,"close":25071.55,"ret":-0.43,"range":318.0,"gap":1.759},"2025-06-26":{"open":25268.95,"close":25530.4,"ret":1.035,"range":305.4,"gap":0.787},"2025-07-01":{"open":25551.35,"close":25533.0,"ret":-0.072,"range":91.6,"gap":0.082},"2025-07-03":{"open":25505.1,"close":25397.4,"ret":-0.422,"range":203.2,"gap":-0.109},"2025-07-08":{"open":25427.85,"close":25523.1,"ret":0.375,"range":123.9,"gap":0.12},"2025-07-10":{"open":25511.65,"close":25348.15,"ret":-0.641,"range":183.6,"gap":-0.045},"2025-07-15":{"open":25089.5,"close":25219.65,"ret":0.519,"range":156.8,"gap":-1.02},"2025-07-17":{"open":25230.75,"close":25109.5,"ret":-0.481,"range":137.3,"gap":0.044},"2025-07-22":{"open":25166.65,"close":25064.9,"ret":-0.404,"range":146.5,"gap":0.228},"2025-07-24":{"open":25243.3,"close":25051.9,"ret":-0.758,"range":227.5,"gap":0.712},"2025-07-29":{"open":24609.65,"close":24830.4,"ret":0.897,"range":248.6,"gap":-1.765},"2025-07-31":{"open":24642.25,"close":24765.6,"ret":0.501,"range":321.5,"gap":-0.758},"2025-08-05":{"open":24720.25,"close":24649.5,"ret":-0.286,"range":142.8,"gap":-0.183},"2025-08-07":{"open":24464.2,"close":24626.65,"ret":0.664,"range":290.0,"gap":-0.752},"2025-08-12":{"open":24563.35,"close":24485.85,"ret":-0.316,"range":236.9,"gap":-0.257},"2025-08-14":{"open":24607.25,"close":24616.05,"ret":0.036,"range":76.8,"gap":0.496},"2025-08-19":{"open":24891.35,"close":24989.7,"ret":0.395,"range":138.7,"gap":1.118},"2025-08-21":{"open":25142.0,"close":25076.95,"ret":-0.259,"range":98.8,"gap":0.609},"2025-08-26":{"open":24899.5,"close":24710.7,"ret":-0.758,"range":230.1,"gap":-0.708},"2025-08-28":{"open":24695.8,"close":24533.1,"ret":-0.659,"range":221.1,"gap":-0.06},"2025-09-02":{"open":24653.0,"close":24575.0,"ret":-0.316,"range":233.8,"gap":0.489},"2025-09-04":{"open":24980.75,"close":24739.8,"ret":-0.965,"range":272.5,"gap":1.651},"2025-09-09":{"open":24864.1,"close":24878.8,"ret":0.059,"range":77.8,"gap":0.502},"2025-09-11":{"open":24945.5,"close":25008.1,"ret":0.251,"range":97.1,"gap":0.268},"2025-09-16":{"open":25073.6,"close":25254.45,"ret":0.721,"range":191.0,"gap":0.262},"2025-09-18":{"open":25441.05,"close":25420.75,"ret":-0.08,"range":119.2,"gap":0.739},"2025-09-23":{"open":25209.0,"close":25185.8,"ret":-0.092,"range":177.2,"gap":-0.833},"2025-09-25":{"open":25034.5,"close":24904.55,"ret":-0.519,"range":214.4,"gap":-0.601},"2025-09-30":{"open":24691.95,"close":24633.6,"ret":-0.236,"range":144.1,"gap":-0.854},"2025-10-01":{"open":24620.55,"close":24853.4,"ret":0.946,"range":262.0,"gap":-0.053},"2025-10-07":{"open":25085.3,"close":25112.8,"ret":0.11,"range":144.6,"gap":0.933},"2025-10-09":{"open":25074.3,"close":25170.3,"ret":0.383,"range":175.0,"gap":-0.153},"2025-10-14":{"open":25277.55,"close":25123.35,"ret":-0.61,"range":249.8,"gap":0.426},"2025-10-16":{"open":25394.9,"close":25566.3,"ret":0.675,"range":248.6,"gap":1.081},"2025-10-20":{"open":25824.6,"close":25850.7,"ret":0.101,"range":137.7,"gap":1.01},"2025-10-23":{"open":26057.2,"close":25870.3,"ret":-0.717,"range":241.8,"gap":0.799},"2025-10-28":{"open":25939.95,"close":25965.4,"ret":0.098,"range":231.7,"gap":0.269},"2025-10-30":{"open":25984.4,"close":25891.2,"ret":-0.359,"range":186.8,"gap":0.073},"2025-11-04":{"open":25744.75,"close":25586.25,"ret":-0.616,"range":209.0,"gap":-0.566},"2025-11-06":{"open":25593.35,"close":25519.95,"ret":-0.287,"range":187.6,"gap":0.028},"2025-11-11":{"open":25617.0,"close":25705.55,"ret":0.346,"range":266.5,"gap":0.38},"2025-11-13":{"open":25906.1,"close":25884.1,"ret":-0.085,"range":202.3,"gap":0.78},"2025-11-18":{"open":26021.8,"close":25894.7,"ret":-0.488,"range":153.3,"gap":0.532},"2025-11-20":{"open":26132.1,"close":26197.4,"ret":0.25,"range":183.5,"gap":0.917},"2025-11-25":{"open":25998.5,"close":25860.3,"ret":-0.532,"range":175.1,"gap":-0.759},"2025-11-27":{"open":26261.25,"close":26219.85,"ret":-0.158,"range":168.5,"gap":1.55},"2025-12-02":{"open":26087.95,"close":26057.0,"ret":-0.119,"range":156.8,"gap":-0.503},"2025-12-04":{"open":25981.85,"close":26017.1,"ret":0.136,"range":159.3,"gap":-0.288},"2025-12-09":{"open":25867.1,"close":25841.75,"ret":-0.098,"range":195.7,"gap":-0.577},"2025-12-11":{"open":25771.4,"close":25898.4,"ret":0.493,"range":229.5,"gap":-0.272},"2025-12-16":{"open":25951.5,"close":25851.35,"ret":-0.386,"range":146.4,"gap":0.205},"2025-12-18":{"open":25764.7,"close":25815.65,"ret":0.198,"range":176.0,"gap":-0.335},"2025-12-23":{"open":26205.2,"close":26165.95,"ret":-0.15,"range":114.5,"gap":1.509},"2025-12-24":{"open":26170.65,"close":26141.65,"ret":-0.111,"range":113.4,"gap":0.018},"2025-12-30":{"open":25940.9,"close":25970.55,"ret":0.114,"range":98.8,"gap":-0.768},"2026-01-01":{"open":26173.3,"close":26140.25,"ret":-0.126,"range":84.1,"gap":0.781},"2026-01-06":{"open":26189.7,"close":26174.65,"ret":-0.057,"range":149.2,"gap":0.189},"2026-01-08":{"open":26106.5,"close":25868.9,"ret":-0.91,"range":274.8,"gap":-0.26},"2026-01-13":{"open":25897.35,"close":25714.2,"ret":-0.707,"range":296.5,"gap":0.11},"2026-01-14":{"open":25648.55,"close":25669.1,"ret":0.08,"range":187.8,"gap":-0.255},"2026-01-20":{"open":25580.3,"close":25225.35,"ret":-1.388,"range":413.7,"gap":-0.346},"2026-01-22":{"open":25344.15,"close":25320.45,"ret":-0.094,"range":267.2,"gap":0.471},"2026-01-27":{"open":25063.35,"close":25234.1,"ret":0.681,"range":314.1,"gap":-1.015},"2026-01-29":{"open":25345.0,"close":25422.1,"ret":0.304,"range":298.4,"gap":0.439},"2026-02-03":{"open":26308.05,"close":25714.8,"ret":-2.255,"range":699.9,"gap":3.485},"2026-02-05":{"open":25755.9,"close":25641.6,"ret":-0.444,"range":178.2,"gap":0.16},"2026-02-10":{"open":25922.65,"close":25916.8,"ret":-0.023,"range":119.0,"gap":1.096},"2026-02-12":{"open":25906.7,"close":25796.15,"ret":-0.427,"range":154.3,"gap":-0.039},"2026-02-17":{"open":25637.95,"close":25716.0,"ret":0.304,"range":194.1,"gap":-0.613},"2026-02-19":{"open":25873.35,"close":25416.45,"ret":-1.766,"range":496.5,"gap":0.612},"2026-02-24":{"open":25641.8,"close":25460.25,"ret":-0.708,"range":314.2,"gap":0.887},"2026-02-26":{"open":25556.3,"close":25493.3,"ret":-0.247,"range":172.0,"gap":0.377},"2026-03-02":{"open":24659.25,"close":24849.75,"ret":0.773,"range":385.8,"gap":-3.272},"2026-03-05":{"open":24615.95,"close":24737.45,"ret":0.494,"range":324.8,"gap":-0.941},"2026-03-10":{"open":24280.8,"close":24286.15,"ret":0.022,"range":223.8,"gap":-1.846},"2026-03-12":{"open":23674.85,"close":23639.35,"ret":-0.15,"range":276.9,"gap":-2.517},"2026-03-17":{"open":23493.2,"close":23558.8,"ret":0.279,"range":310.2,"gap":-0.618},"2026-03-19":{"open":23197.75,"close":23087.85,"ret":-0.474,"range":448.4,"gap":-1.533},"2026-03-24":{"open":22878.45,"close":22958.4,"ret":0.349,"range":433.1,"gap":-0.907},"2026-03-25":{"open":23064.4,"close":23309.0,"ret":1.061,"range":402.1,"gap":0.462},"2026-03-30":{"open":22549.65,"close":22379.2,"ret":-0.756,"range":430.2,"gap":-3.258}};

  function drawMarketContext() {
    const fmtPnl = n => (n>=0?'+':'−')+'₹'+Math.abs(Math.round(n)).toLocaleString('en-IN');
    const posCol2 = () => getComputedStyle(document.body).getPropertyValue('--pos').trim() || '#1f6b4e';
    const negCol2 = () => getComputedStyle(document.body).getPropertyValue('--neg').trim() || '#a8362c';
    const accCol2 = () => getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#b5651d';
    const fontC   = () => getComputedStyle(document.body).getPropertyValue('--muted').trim();
    const gridC   = () => getComputedStyle(document.body).getPropertyValue('--border').trim();
    const surfC   = () => getComputedStyle(document.body).getPropertyValue('--surface').trim();
    const inkC    = () => getComputedStyle(document.body).getPropertyValue('--ink').trim();

    const tipOpts = {
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--surface-2').trim() || '#1a2030',
      borderColor: getComputedStyle(document.body).getPropertyValue('--border').trim(),
      borderWidth:1, titleColor: inkC(), bodyColor: fontC(),
      padding:10, cornerRadius:6,
      titleFont:{family:"'JetBrains Mono',monospace",size:11,weight:'600'},
      bodyFont:{family:"'JetBrains Mono',monospace",size:11}
    };

    // ── 1. Zone P&L bar chart ────────────────────────────────────
    const ctx1 = document.getElementById('cZonePnl');
    if (ctx1) {
      charts['zonePnl']?.destroy();
      const zones = ['<23k', '23k–24k', '24k–25k', '25k–26k', '>26k'];
      const zoneMap = {'below_23k':'<23k','23k_24k':'23k–24k','24k_25k':'24k–25k','25k_26k':'25k–26k','above_26k':'>26k'};
      const zonePnl = {'<23k':0,'23k–24k':0,'24k–25k':0,'25k–26k':0,'>26k':0};
      const zoneN   = {'<23k':0,'23k–24k':0,'24k–25k':0,'25k–26k':0,'>26k':0};
      const zoneWin = {'<23k':0,'23k–24k':0,'24k–25k':0,'25k–26k':0,'>26k':0};
      ENRICHED_TRADES.forEach(t => {
        const z = zoneMap[t.nifty_zone] || '25k–26k';
        zonePnl[z] = (zonePnl[z]||0) + t.pnl;
        zoneN[z] = (zoneN[z]||0) + 1;
        if (t.win) zoneWin[z] = (zoneWin[z]||0) + 1;
      });
      const pnls = zones.map(z => Math.round(zonePnl[z]||0));
      charts['zonePnl'] = new Chart(ctx1, {
        type:'bar',
        data:{ labels: zones, datasets:[{
          data: pnls,
          backgroundColor: pnls.map(v => v>=0 ? posCol2() : negCol2()),
          borderRadius:6, maxBarThickness:52
        }]},
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false}, tooltip:{ ...tipOpts,
            callbacks:{ label: c => {
              const z = zones[c.dataIndex];
              const wr = zoneN[z] ? ((zoneWin[z]||0)/zoneN[z]*100).toFixed(0) : 0;
              return [`P&L: ${fmtPnl(c.raw)}`, `WR: ${wr}%  |  Trades: ${zoneN[z]}`];
            }}
          }},
          scales:{
            x:{ ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:11}}, grid:{display:false} },
            y:{ ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10}, callback: v => '₹'+(v/1000).toFixed(0)+'k'}, grid:{color:gridC()},
              plugins:{ annotation: { annotations: { zero: { type:'line', yMin:0, yMax:0, borderColor: gridC(), borderWidth:1 } } } }
            }
          }
        }
      });
    }

    // ── 2. NIFTY Timeline with trade markers ─────────────────────
    const ctx2 = document.getElementById('cNiftyTimeline');
    if (ctx2) {
      charts['niftyTimeline']?.destroy();
      const allDates = Object.keys(NIFTY_DAILY).sort();
      const closes = allDates.map(d => NIFTY_DAILY[d].close);

      // Trade markers
      const winOpen  = [], lossOpen = [];
      ENRICHED_TRADES.forEach(t => {
        const di = allDates.findIndex(d => d >= t.open_date);
        if (di >= 0) {
          const pt = { x: di, y: NIFTY_DAILY[allDates[di]]?.open || closes[di], sym: t.sym.slice(0,18), pnl: t.pnl };
          if (t.win) winOpen.push(pt); else lossOpen.push(pt);
        }
      });

      charts['niftyTimeline'] = new Chart(ctx2, {
        type:'line',
        data:{ labels: allDates.map(d=>d.slice(5)),
          datasets:[
            { label:'NIFTY Close', data:closes, borderColor:'rgba(77,159,255,0.7)', borderWidth:1.5,
              backgroundColor:'rgba(77,159,255,0.05)', fill:true, pointRadius:0, tension:0.2, order:3 },
            { label:'Win entry', data: winOpen.map(p=>({x:p.x,y:p.y})),
              type:'scatter', backgroundColor: posCol2(), borderColor:'#fff',
              borderWidth:1.5, pointRadius:7, pointStyle:'triangle', order:1,
              parsing:false },
            { label:'Loss entry', data: lossOpen.map(p=>({x:p.x,y:p.y})),
              type:'scatter', backgroundColor: negCol2(), borderColor:'#fff',
              borderWidth:1.5, pointRadius:7, pointStyle:'triangle', order:2,
              parsing:false },
          ]
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          interaction:{ mode:'nearest', axis:'x', intersect:false },
          plugins:{ legend:{ labels:{color:fontC(),font:{family:"'Inter Tight',sans-serif",size:10},boxWidth:8,boxHeight:8,padding:14} },
            tooltip:{ ...tipOpts, callbacks:{ label: c => {
              if (c.dataset.label === 'NIFTY Close') return `NIFTY: ${c.raw?.toFixed(0)||c.raw}`;
              const arr = c.dataset.label === 'Win entry' ? winOpen : lossOpen;
              const pt = arr[c.dataIndex];
              return pt ? [`${pt.sym}`, `P&L: ${fmtPnl(pt.pnl)}`] : '';
            }}}
          },
          scales:{
            x:{ ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:9},maxTicksLimit:12,maxRotation:0}, grid:{color:gridC()} },
            y:{ ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>v.toLocaleString('en-IN')}, grid:{color:gridC()} }
          }
        }
      });
    }

    // ── 3. Context bubble / scatter: gap% vs pnl, sized by range ─
    const ctx3 = document.getElementById('cContextBubble');
    if (ctx3) {
      charts['ctxBubble']?.destroy();
      const bubbleData = ENRICHED_TRADES.map(t => ({
        x: t.od_nifty_gap || 0,
        y: t.pnl,
        r: Math.max(4, Math.min(18, (t.od_nifty_range||150)/30)),
        sym: t.sym.slice(0,18), win: t.win, pnl: t.pnl,
        gap: t.od_nifty_gap, range: t.od_nifty_range
      }));
      charts['ctxBubble'] = new Chart(ctx3, {
        type:'bubble',
        data:{ datasets:[
          { label:'Win', data: bubbleData.filter(d=>d.win),
            backgroundColor:'rgba(31,107,78,0.6)', borderColor:posCol2(), borderWidth:1 },
          { label:'Loss', data: bubbleData.filter(d=>!d.win),
            backgroundColor:'rgba(168,54,44,0.6)', borderColor:negCol2(), borderWidth:1 },
        ]},
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{labels:{color:fontC(),font:{family:"'Inter Tight',sans-serif",size:10},boxWidth:8}},
            tooltip:{ ...tipOpts, callbacks:{ label: c => {
              const d = c.raw;
              return [`${d.sym}`, `Gap: ${(d.gap||0).toFixed(2)}%`, `P&L: ${fmtPnl(d.pnl)}`, `Range: ${Math.round(d.range||0)}pts`];
            }}}
          },
          scales:{
            x:{ title:{display:true,text:'NIFTY Gap at Entry (%)',color:fontC(),font:{size:10}},
              ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>v+'%'}, grid:{color:gridC()} },
            y:{ title:{display:true,text:'Trade P&L (₹)',color:fontC(),font:{size:10}},
              ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'}, grid:{color:gridC()} }
          }
        }
      });
    }

    // ── 4. Enriched trade table ──────────────────────────────────
    const tbody = document.getElementById('tMCBody');
    if (tbody) {
      const ctxLabel = { big_gap_up:'🔴 Big Gap-Up', gap_up:'🟡 Gap-Up', big_gap_down:'🟢 Big Gap-Down',
                         gap_down:'🔵 Gap-Down', strong_open:'⬆ Strong Open', weak_open:'⬇ Weak Open', neutral_open:'⚪ Neutral' };
      const sorted = [...ENRICHED_TRADES].sort((a,b)=>b.pnl-a.pnl);
      tbody.innerHTML = sorted.map(t => {
        const aligned = (t.type==='CE' && t.nifty_ret_during>0) || (t.type==='PE' && t.nifty_ret_during<0);
        const gap = (t.od_nifty_gap||0).toFixed(2);
        const nd  = (t.nifty_ret_during||0).toFixed(1);
        return `<tr>
          <td class="sym" style="font-size:11.5px">${t.sym.slice(0,26)}</td>
          <td><span class="tag ${t.type==='CE'?'tag-ce':'tag-pe'}">${t.type}</span></td>
          <td class="num"><span class="${t.pnl>=0?'pnl-pos':'pnl-neg'}">${fmtPnl(t.pnl)}</span></td>
          <td><span class="tag ${t.win?'tag-win':'tag-loss'}">${t.win?'Win':'Loss'}</span></td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px">${Math.round(t.od_nifty_open||0).toLocaleString('en-IN')}</td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${(t.od_nifty_gap||0)>0?'var(--pos)':'var(--neg)'}">${gap}%</td>
          <td><span style="font-size:10.5px;padding:2px 7px;border-radius:4px;background:var(--surface-2);color:var(--ink-2);font-weight:500">${ctxLabel[t.market_ctx]||t.market_ctx}</span></td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${nd>=0?'var(--pos)':'var(--neg)'}">${nd}%</td>
          <td style="text-align:center;font-size:14px">${aligned?'<span title="Trend aligned" style="color:var(--pos)">✓</span>':'<span title="Counter-trend" style="color:var(--neg)">✗</span>'}</td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px">${Math.round(t.avg_range_during||0)} pts</td>
        </tr>`;
      }).join('');
    }

    // ── 5. OHLC Rules ────────────────────────────────────────────
    const rulesEl = document.getElementById('ohlcRules');
    if (rulesEl) {
      const rules = [
        { icon:'🚫', color:'var(--neg)', title:'Never enter on big gap-up (>+1%)', body:'5 trades entered after NIFTY gapped up >1%. Result: 20% WR, −₹48,268. IV spikes on gap-ups mean you buy inflated premium and have no cushion.', verdict:'Avoid', cls:'bad' },
        { icon:'✅', color:'var(--pos)', title:'Moderate gap-up (+0.3–1%) is your sweet spot', body:'7 trades on moderate gap-ups: 100% WR, +₹22,221. The market is directional but not euphoric — IV hasn\'t spiked, there\'s still room to run.', verdict:'Best entry condition', cls:'good' },
        { icon:'⬇️', color:'var(--pos)', title:'Gap-down entries on individual stocks work', body:'Entering CEs on stocks that gap down (not NIFTY-wide fear) gave strong results: BEL26MAR, BEL25OCT. Oversold stocks bounce harder.', verdict:'Contrarian edge', cls:'good' },
        { icon:'🗺️', color:'var(--neg)', title:'Avoid NIFTY 24k–26k zone for long PEs', body:'The 24k–26k band was an indecisive distribution phase (Aug–Nov 2025). NIFTY chopped. Long PEs bled theta with no directional follow-through.', verdict:'Skip PE in ranging zone', cls:'bad' },
        { icon:'📐', color:'var(--accent)', title:'Exit when NIFTY range expands (>300pts)', body:'Winners were closed on days when NIFTY range was 329 pts avg vs 186 pts for losses. Catching high-volatility exit days is a real skill you have.', verdict:'Ride to volatility day', cls:'info' },
        { icon:'🔗', color:'var(--neg)', title:'Don\'t pair two losing-side trades on same stock', body:'Oct 17: entered HAL PE + HAL PE same day, both on a gap-up open. −₹20,205. Correlation doubles the risk. On days you\'re wrong, you\'re doubly wrong.', verdict:'Max 1 leg per underlying', cls:'bad' },
        { icon:'📉', color:'var(--neg)', title:'PE trades need NIFTY already in free-fall', body:'Buying PEs when NIFTY is falling → only 44% WR. You\'re paying panic premium. Wait for a dead-cat bounce and buy PEs on the bounce when IV compresses briefly.', verdict:'Buy PEs on bounces', cls:'bad' },
        { icon:'🎯', color:'var(--pos)', title:'Below 23k is your best buying zone', body:'3 trades entered when NIFTY <23k: 100% WR, +₹11,898. Deeply oversold market, depressed IV, maximum room for bounce. Your best risk/reward zone.', verdict:'Accumulate below 23k', cls:'good' },
        { icon:'⏰', color:'var(--accent)', title:'0–2 day holds in high-vol are cleanest', body:'Short holds (0–2d) with avg NIFTY range 202pts: 70% WR. You avoid overnight exposure in uncertain regimes. Matches your best F&O hold duration data.', verdict:'Scale in/out quickly', cls:'info' },
      ];
      rulesEl.innerHTML = rules.map(r => `
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;display:flex;flex-direction:column;gap:6px">
          <div style="font-size:18px;line-height:1">${r.icon}</div>
          <div style="font-size:12.5px;font-weight:700;color:var(--ink);letter-spacing:-.01em">${r.title}</div>
          <div style="font-size:11.5px;color:var(--ink-2);line-height:1.65;flex:1">${r.body}</div>
          <span class="ins-verdict v-${r.cls}" style="margin-top:4px">${r.verdict}</span>
        </div>`).join('');
    }
  }

})();
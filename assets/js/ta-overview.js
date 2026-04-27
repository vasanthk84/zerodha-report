/* ===== Trade Analytics — Overview panel ===== */
(() => {
  const { $, $$, charts, fontCol, gridCol, posCol, negCol, accCol, goldCol, tipCommon } = window.TA;
  // tw is NEVER destructured — always window.TA.tw (needs mutation visibility)

  function setHero(lbl, val, pct, sub) {
    const S = window.SEED; if (!S) return;
    $('.hero-lead .eyebrow').textContent = lbl;
    const sign = val >= 0 ? '+' : '−';
    $('.hero-sign').textContent = sign;
    $('.hero-sign').style.color = val >= 0 ? 'var(--pos)' : 'var(--neg)';
    $('.hero-val').textContent = Math.abs(Math.round(val)).toLocaleString('en-IN');
    $('.hero-delta').style.background = val >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)';
    $('.hero-delta').style.color = val >= 0 ? 'var(--pos)' : 'var(--neg)';
    $('.hero-delta span').textContent = (pct >= 0 ? '' : '−') + Math.abs(pct).toFixed(1) + '%';
    if (sub) { $('.hero-sub').innerHTML = '<span class="serif">' + sub + '</span>'; }
    else {
      const topMonth = [...(S.monthly || [])].sort((a, b) => b.pnl - a.pnl)[0];
      const e = S.extras || {};
      $('.hero-sub').innerHTML =
        `<span class="serif">Your data.</span> ${e.totalPositions || 289} F&O positions · ${e.winRate || 87.5}% win rate` +
        (topMonth ? ` · ${topMonth.m} best at <b class="${topMonth.pnl >= 0 ? 'pos' : 'neg'}">${topMonth.pnl >= 0 ? '+' : '−'}₹${Math.abs(topMonth.pnl).toLocaleString('en-IN')}</b>` : '');
    }
  }

  function drawHeroCurve() {
    const S = window.SEED; if (!S) return;
    const svg = $('#heroCurve');
    const data = S.cumulative;
    const W = 600, H = 140, PAD = 6;
    const min = Math.min(...data, 0);
    const max = Math.max(...data);
    const sx = i => PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const sy = v => H - PAD - ((v - min) / (max - min || 1)) * (H - PAD * 2);
    let path = '';
    data.forEach((v, i) => { path += (i === 0 ? 'M' : 'L') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1); });
    const area = path + ` L ${sx(data.length - 1)} ${H - PAD} L ${sx(0)} ${H - PAD} Z`;
    const zero = sy(0);
    const peakX = sx(data.length - 1), peakY = sy(max);
    const isDark = document.body.dataset.theme === 'dark';
    const stroke = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    svg.innerHTML = `
      <defs>
        <linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity=".22"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${zero.toFixed(1)}" x2="${W}" y2="${zero.toFixed(1)}" stroke="${isDark ? '#3d382f' : '#d7cfbe'}" stroke-dasharray="3 4" stroke-width="1"/>
      <path d="${area}" fill="url(#hcg)"/>
      <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="${peakX}" cy="${peakY}" r="4" fill="${stroke}" stroke="var(--surface)" stroke-width="2"/>
      <text x="${peakX - 6}" y="${peakY - 10}" text-anchor="end" font-family="JetBrains Mono" font-size="10" font-weight="600" fill="${stroke}">+₹${max.toLocaleString('en-IN')}</text>
    `;
  }

  function drawLeader() {
    const S = window.SEED; if (!S) return;
    const total = Math.max(...S.stocks.map(s => Math.abs(s.pnl)));
    $('#leaderboard').innerHTML = S.stocks.slice(0, 8).map((s, i) => {
      const winPct = s.n === 0 ? 0 : (s.wins / s.n) * 100;
      return `<div class="lead-row">
        <div class="lead-rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="lead-sym">${s.sym}</div>
        <div class="lead-pnl ${s.pnl >= 0 ? 'pos' : 'neg'}">${s.pnl >= 0 ? '+' : '−'}₹${Math.abs(s.pnl).toLocaleString('en-IN')}</div>
        <div class="lead-bar">
          <div class="lead-bar-w" style="width:${winPct}%"></div>
          <div class="lead-bar-l" style="width:${100 - winPct}%"></div>
        </div>
        <div class="lead-meta">
          <span>${s.n} trades · ${s.wr}% WR</span>
          <span>avg ${s.avgD}d held</span>
        </div>
      </div>`;
    }).join('');
  }

  function drawMonthly() {
    const S = window.SEED; if (!S) return;
    const ctx = $('#cMonthly'); if (!ctx) return;
    charts.monthly?.destroy();
    charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: S.monthly.map(m => m.m),
        datasets: [{
          data: S.monthly.map(m => m.pnl),
          backgroundColor: S.monthly.map(m => m.pnl >= 0 ? posCol() : negCol()),
          borderRadius: 4, borderSkipped: false, maxBarThickness: 38
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => '₹' + c.raw.toLocaleString('en-IN') } } },
        scales: {
          x: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false }, border: { color: gridCol() } },
          y: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridCol(), drawBorder: false } }
        }
      }
    });
    // Update foot
    const sortedM = [...S.monthly].sort((a, b) => b.pnl - a.pnl);
    const best = sortedM[0], worst = sortedM[sortedM.length - 1];
    const foot = $('#monthlyFoot');
    if (foot && best) foot.innerHTML = `<div><span class="ft-k">Best</span> ${best.m} <b class="pos">+₹${Math.abs(best.pnl).toLocaleString('en-IN')}</b></div>`
      + (worst && worst.pnl < 0 ? `<div><span class="ft-k">Only red</span> ${worst.m} <b class="neg">−₹${Math.abs(worst.pnl).toLocaleString('en-IN')}</b></div>` : '');
  }

  function drawCumulative() {
    const S = window.SEED; if (!S) return;
    const ctx = $('#cCumulative'); if (!ctx) return;
    charts.cumulative?.destroy();
    const data = S.cumulative;
    if (!data || data.length < 2) return;
    const peak = Math.max(...data);
    let maxDd = 0, runMax = data[0];
    data.forEach(v => { runMax = Math.max(runMax, v); maxDd = Math.min(maxDd, v - runMax); });
    const peakEl = $('#cumulPeak'); if (peakEl) peakEl.textContent = '+₹' + peak.toLocaleString('en-IN');
    const ddEl = $('#cumulDd'); if (ddEl) ddEl.textContent = maxDd === 0 ? '—' : '−₹' + Math.abs(Math.round(maxDd)).toLocaleString('en-IN');
    const stroke = accCol();
    charts.cumulative = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data, borderColor: stroke, borderWidth: 2,
          fill: true, backgroundColor: 'rgba(181,101,29,.07)',
          pointRadius: 0, tension: 0.3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tipCommon, callbacks: { label: c => '₹' + Math.round(c.raw).toLocaleString('en-IN'), title: () => '' } } },
        scales: {
          x: { display: false },
          y: { ticks: { color: fontCol(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridCol() } }
        }
      }
    });
  }

  function drawOverviewInsights() {
    const S = window.SEED; if (!S) return;
    const list = document.getElementById('overviewInsights'); if (!list) return;
    const ins = [];
    const byBucket = S.byBucket || [];
    const byHold = S.byHold || [];
    const eq = S.equity;
    const fmt = (n, abs) => abs ? '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN') : (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');

    const bestBucket = byBucket.filter(b => b.pnl > 0).reduce((a, b) => b.wr > a.wr ? b : a, byBucket.find(b => b.pnl > 0) || null);
    if (bestBucket) {
      ins.push({ cls: 'pos', title: `${bestBucket.k} options are your sweet spot.`,
        body: `${bestBucket.sub ? bestBucket.sub + ' entry' : bestBucket.k}: <b class="pos">${fmt(bestBucket.pnl)} · ${bestBucket.wr}% WR</b> across ${bestBucket.n} trades.` });
    }

    const bestHold = byHold.filter(h => h.pnl > 0).reduce((a, b) => b.wr > a.wr ? b : a, byHold.find(h => h.pnl > 0) || null);
    if (bestHold) {
      const avg = bestHold.n ? Math.round(bestHold.pnl / bestHold.n) : 0;
      ins.push({ cls: 'pos', title: `${bestHold.k} holds convert best.`,
        body: `${bestHold.k} holds averaged <b class="pos">₹${avg.toLocaleString('en-IN')} / trade · ${bestHold.wr}% WR</b> — your highest-edge zone.` });
    }

    const longHold = byHold.find(h => h.k === '15–30 d');
    if (longHold && (longHold.pnl < 0 || longHold.wr < 55)) {
      ins.push({ cls: 'neg', title: 'Holding > 2 weeks breaks the edge.',
        body: `15–30d bucket: <b class="neg">${fmt(longHold.pnl)} · ${longHold.wr}% WR</b>. Cut these sooner.` });
    }

    if (eq && eq.total > 0) {
      if (eq.wr < 55) {
        const worst2 = (eq.stocks || []).filter(s => s.pnl < 0).slice(-2).map(s => s.sym).join(' and ');
        ins.push({ cls: 'neg', title: 'Equity swing book is underwater.',
          body: `${eq.wr}% WR, net <b class="neg">${fmt(eq.net)}</b>.${worst2 ? ` ${worst2} dragging returns.` : ''}` });
      } else {
        ins.push({ cls: 'pos', title: 'Equity book is contributing.',
          body: `${eq.wr}% WR on ${eq.total} positions, net <b class="pos">${fmt(eq.net)}</b>.` });
      }
    }

    if (ins.length === 0) {
      ins.push({ cls: 'neg', title: 'No data yet.',
        body: 'Upload your F&amp;O and Equity CSVs to see what worked and what didn\'t.' });
    }

    list.innerHTML = ins.map(i =>
      `<li class="ins ${i.cls}"><div class="ins-rail"></div><div class="ins-copy"><b>${i.title}</b><span>${i.body}</span></div></li>`
    ).join('');
  }

  function redrawCharts() {
    drawHeroCurve();
    drawLeader();
    drawMonthly();
    drawCumulative();
  }

  Object.assign(window.TA, { setHero, drawHeroCurve, drawLeader, drawMonthly, drawCumulative, drawOverviewInsights, redrawCharts });
})();

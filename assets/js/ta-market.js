/* ===== Trade Analytics — Market Context panel ===== */
(() => {
  const { charts } = window.TA;
  // tw is NEVER destructured — always window.TA.tw (needs mutation visibility)
  function drawMarketContext() {
    // Use uploaded+enriched data when available, fall back to built-in sample data
    const ETRADES = window.SEED?.enrichedTrades || null;
    const NDAILY = window.SEED?.niftyDaily || null;

    if (!ETRADES || !NDAILY) {
      container.innerHTML = `
    <div class="empty-state">
      <p>No market data loaded. Upload NIFTY OHLC JSON + tradebook to see context.</p>
    </div>`;
      return;
    }

    const fmtPnl = n => (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
    const posCol2 = () => window.TA.posCol();
    const negCol2 = () => window.TA.negCol();
    const accCol2 = () => window.TA.accCol();
    const fontC = () => getComputedStyle(document.body).getPropertyValue('--muted').trim();
    const gridC = () => getComputedStyle(document.body).getPropertyValue('--border').trim();
    const surfC = () => getComputedStyle(document.body).getPropertyValue('--surface').trim();
    const inkC = () => getComputedStyle(document.body).getPropertyValue('--ink').trim();

    const tipOpts = {
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--surface-2').trim() || '#1a2030',
      borderColor: getComputedStyle(document.body).getPropertyValue('--border').trim(),
      borderWidth: 1, titleColor: inkC(), bodyColor: fontC(),
      padding: 10, cornerRadius: 6,
      titleFont: { family: "'JetBrains Mono',monospace", size: 11, weight: '600' },
      bodyFont: { family: "'JetBrains Mono',monospace", size: 11 }
    };

    // ── 1. Zone P&L bar chart ────────────────────────────────────
    const ctx1 = document.getElementById('cZonePnl');
    if (ctx1) {
      charts['zonePnl']?.destroy();
      const zones = ['<23k', '23k–24k', '24k–25k', '25k–26k', '>26k'];
      const zoneMap = { 'below_23k': '<23k', '23k_24k': '23k–24k', '24k_25k': '24k–25k', '25k_26k': '25k–26k', 'above_26k': '>26k' };
      const zonePnl = { '<23k': 0, '23k–24k': 0, '24k–25k': 0, '25k–26k': 0, '>26k': 0 };
      const zoneN = { '<23k': 0, '23k–24k': 0, '24k–25k': 0, '25k–26k': 0, '>26k': 0 };
      const zoneWin = { '<23k': 0, '23k–24k': 0, '24k–25k': 0, '25k–26k': 0, '>26k': 0 };
      ETRADES.forEach(t => {
        const z = zoneMap[t.nifty_zone] || '25k–26k';
        zonePnl[z] = (zonePnl[z] || 0) + t.pnl;
        zoneN[z] = (zoneN[z] || 0) + 1;
        if (t.win) zoneWin[z] = (zoneWin[z] || 0) + 1;
      });
      const pnls = zones.map(z => Math.round(zonePnl[z] || 0));
      charts['zonePnl'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: zones, datasets: [{
            data: pnls,
            backgroundColor: pnls.map(v => v >= 0 ? posCol2() : negCol2()),
            borderRadius: 6, maxBarThickness: 52
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false }, tooltip: {
              ...tipOpts,
              callbacks: {
                label: c => {
                  const z = zones[c.dataIndex];
                  const wr = zoneN[z] ? ((zoneWin[z] || 0) / zoneN[z] * 100).toFixed(0) : 0;
                  return [`P&L: ${fmtPnl(c.raw)}`, `WR: ${wr}%  |  Trades: ${zoneN[z]}`];
                }
              }
            }
          },
          scales: {
            x: { ticks: { color: fontC(), font: { family: "'JetBrains Mono',monospace", size: 11 } }, grid: { display: false } },
            y: {
              ticks: { color: fontC(), font: { family: "'JetBrains Mono',monospace", size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridC() },
              plugins: { annotation: { annotations: { zero: { type: 'line', yMin: 0, yMax: 0, borderColor: gridC(), borderWidth: 1 } } } }
            }
          }
        }
      });
    }

    // ── 2. NIFTY Timeline with trade markers ─────────────────────
    const ctx2 = document.getElementById('cNiftyTimeline');
    if (ctx2) {
      charts['niftyTimeline']?.destroy();
      const allDates = Object.keys(NDAILY).sort();
      const closes = allDates.map(d => NDAILY[d].close);

      // Trade markers
      const winOpen = [], lossOpen = [];
      ETRADES.forEach(t => {
        const di = allDates.findIndex(d => d >= t.open_date);
        if (di >= 0) {
          const pt = { x: di, y: NDAILY[allDates[di]]?.open || closes[di], sym: t.sym.slice(0, 18), pnl: t.pnl };
          if (t.win) winOpen.push(pt); else lossOpen.push(pt);
        }
      });

      charts['niftyTimeline'] = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: allDates.map(d => d.slice(5)),
          datasets: [
            {
              label: 'NIFTY Close', data: closes, borderColor: 'rgba(77,159,255,0.7)', borderWidth: 1.5,
              backgroundColor: 'rgba(77,159,255,0.05)', fill: true, pointRadius: 0, tension: 0.2, order: 3
            },
            {
              label: 'Win entry', data: winOpen.map(p => ({ x: p.x, y: p.y })),
              type: 'scatter', backgroundColor: posCol2(), borderColor: '#fff',
              borderWidth: 1.5, pointRadius: 7, pointStyle: 'triangle', order: 1,
              parsing: false
            },
            {
              label: 'Loss entry', data: lossOpen.map(p => ({ x: p.x, y: p.y })),
              type: 'scatter', backgroundColor: negCol2(), borderColor: '#fff',
              borderWidth: 1.5, pointRadius: 7, pointStyle: 'triangle', order: 2,
              parsing: false
            },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'nearest', axis: 'x', intersect: false },
          plugins: {
            legend: { labels: { color: fontC(), font: { family: "'Inter Tight',sans-serif", size: 10 }, boxWidth: 8, boxHeight: 8, padding: 14 } },
            tooltip: {
              ...tipOpts, callbacks: {
                label: c => {
                  if (c.dataset.label === 'NIFTY Close') return `NIFTY: ${c.raw?.toFixed(0) || c.raw}`;
                  const arr = c.dataset.label === 'Win entry' ? winOpen : lossOpen;
                  const pt = arr[c.dataIndex];
                  return pt ? [`${pt.sym}`, `P&L: ${fmtPnl(pt.pnl)}`] : '';
                }
              }
            }
          },
          scales: {
            x: { ticks: { color: fontC(), font: { family: "'JetBrains Mono',monospace", size: 9 }, maxTicksLimit: 12, maxRotation: 0 }, grid: { color: gridC() } },
            y: { ticks: { color: fontC(), font: { family: "'JetBrains Mono',monospace", size: 10 }, callback: v => v.toLocaleString('en-IN') }, grid: { color: gridC() } }
          }
        }
      });
    }

    // ── 3. Context bubble / scatter: gap% vs pnl, sized by range ─
    const ctx3 = document.getElementById('cContextBubble');
    if (ctx3) {
      charts['ctxBubble']?.destroy();
      const bubbleData = ETRADES.map(t => ({
        x: t.od_nifty_gap || 0,
        y: t.pnl,
        r: Math.max(4, Math.min(18, (t.od_nifty_range || 150) / 30)),
        sym: t.sym.slice(0, 18), win: t.win, pnl: t.pnl,
        gap: t.od_nifty_gap, range: t.od_nifty_range
      }));
      charts['ctxBubble'] = new Chart(ctx3, {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Win', data: bubbleData.filter(d => d.win),
              backgroundColor: 'rgba(31,107,78,0.6)', borderColor: posCol2(), borderWidth: 1
            },
            {
              label: 'Loss', data: bubbleData.filter(d => !d.win),
              backgroundColor: 'rgba(168,54,44,0.6)', borderColor: negCol2(), borderWidth: 1
            },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: fontC(), font: { family: "'Inter Tight',sans-serif", size: 10 }, boxWidth: 8 } },
            tooltip: {
              ...tipOpts, callbacks: {
                label: c => {
                  const d = c.raw;
                  return [`${d.sym}`, `Gap: ${(d.gap || 0).toFixed(2)}%`, `P&L: ${fmtPnl(d.pnl)}`, `Range: ${Math.round(d.range || 0)}pts`];
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'NIFTY Gap at Entry (%)', color: fontC(), font: { size: 10 } },
              ticks: { color: fontC(), font: { family: "'JetBrains Mono',monospace", size: 10 }, callback: v => v + '%' }, grid: { color: gridC() }
            },
            y: {
              title: { display: true, text: 'Trade P&L (₹)', color: fontC(), font: { size: 10 } },
              ticks: { color: fontC(), font: { family: "'JetBrains Mono',monospace", size: 10 }, callback: v => '₹' + (v / 1000).toFixed(0) + 'k' }, grid: { color: gridC() }
            }
          }
        }
      });
    }

    // ── 4. Enriched trade table ──────────────────────────────────
    const tbody = document.getElementById('tMCBody');
    if (tbody) {
      const ctxLabel = {
        big_gap_up: '🔴 Big Gap-Up', gap_up: '🟡 Gap-Up', big_gap_down: '🟢 Big Gap-Down',
        gap_down: '🔵 Gap-Down', strong_open: '⬆ Strong Open', weak_open: '⬇ Weak Open', neutral_open: '⚪ Neutral'
      };
      const sorted = [...ETRADES].sort((a, b) => b.pnl - a.pnl);
      tbody.innerHTML = sorted.map(t => {
        const aligned = (t.type === 'CE' && t.nifty_ret_during > 0) || (t.type === 'PE' && t.nifty_ret_during < 0);
        const gap = (t.od_nifty_gap || 0).toFixed(2);
        const nd = (t.nifty_ret_during || 0).toFixed(1);
        return `<tr>
          <td class="sym" style="font-size:11.5px">${t.sym.slice(0, 26)}</td>
          <td><span class="tag ${t.type === 'CE' ? 'tag-ce' : 'tag-pe'}">${t.type}</span></td>
          <td class="num"><span class="${t.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${fmtPnl(t.pnl)}</span></td>
          <td><span class="tag ${t.win ? 'tag-win' : 'tag-loss'}">${t.win ? 'Win' : 'Loss'}</span></td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px">${Math.round(t.od_nifty_open || 0).toLocaleString('en-IN')}</td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${(t.od_nifty_gap || 0) > 0 ? 'var(--pos)' : 'var(--neg)'}">${gap}%</td>
          <td><span style="font-size:10.5px;padding:2px 7px;border-radius:4px;background:var(--surface-2);color:var(--ink-2);font-weight:500">${ctxLabel[t.market_ctx] || t.market_ctx}</span></td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${nd >= 0 ? 'var(--pos)' : 'var(--neg)'}">${nd}%</td>
          <td style="text-align:center;font-size:14px">${aligned ? '<span title="Trend aligned" style="color:var(--pos)">✓</span>' : '<span title="Counter-trend" style="color:var(--neg)">✗</span>'}</td>
          <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px">${Math.round(t.avg_range_during || 0)} pts</td>
        </tr>`;
      }).join('');
    }

    // ── 5. OHLC Rules ────────────────────────────────────────────
    const rulesEl = document.getElementById('ohlcRules');
    if (rulesEl) {
      const rules = [
        { icon: '🚫', color: 'var(--neg)', title: 'Never enter on big gap-up (>+1%)', body: '5 trades entered after NIFTY gapped up >1%. Result: 20% WR, −₹48,268. IV spikes on gap-ups mean you buy inflated premium and have no cushion.', verdict: 'Avoid', cls: 'bad' },
        { icon: '✅', color: 'var(--pos)', title: 'Moderate gap-up (+0.3–1%) is your sweet spot', body: '7 trades on moderate gap-ups: 100% WR, +₹22,221. The market is directional but not euphoric — IV hasn\'t spiked, there\'s still room to run.', verdict: 'Best entry condition', cls: 'good' },
        { icon: '⬇️', color: 'var(--pos)', title: 'Gap-down entries on individual stocks work', body: 'Entering CEs on stocks that gap down (not NIFTY-wide fear) gave strong results: BEL26MAR, BEL25OCT. Oversold stocks bounce harder.', verdict: 'Contrarian edge', cls: 'good' },
        { icon: '🗺️', color: 'var(--neg)', title: 'Avoid NIFTY 24k–26k zone for long PEs', body: 'The 24k–26k band was an indecisive distribution phase (Aug–Nov 2025). NIFTY chopped. Long PEs bled theta with no directional follow-through.', verdict: 'Skip PE in ranging zone', cls: 'bad' },
        { icon: '📐', color: 'var(--accent)', title: 'Exit when NIFTY range expands (>300pts)', body: 'Winners were closed on days when NIFTY range was 329 pts avg vs 186 pts for losses. Catching high-volatility exit days is a real skill you have.', verdict: 'Ride to volatility day', cls: 'info' },
        { icon: '🔗', color: 'var(--neg)', title: 'Don\'t pair two losing-side trades on same stock', body: 'Oct 17: entered HAL PE + HAL PE same day, both on a gap-up open. −₹20,205. Correlation doubles the risk. On days you\'re wrong, you\'re doubly wrong.', verdict: 'Max 1 leg per underlying', cls: 'bad' },
        { icon: '📉', color: 'var(--neg)', title: 'PE trades need NIFTY already in free-fall', body: 'Buying PEs when NIFTY is falling → only 44% WR. You\'re paying panic premium. Wait for a dead-cat bounce and buy PEs on the bounce when IV compresses briefly.', verdict: 'Buy PEs on bounces', cls: 'bad' },
        { icon: '🎯', color: 'var(--pos)', title: 'Below 23k is your best buying zone', body: '3 trades entered when NIFTY <23k: 100% WR, +₹11,898. Deeply oversold market, depressed IV, maximum room for bounce. Your best risk/reward zone.', verdict: 'Accumulate below 23k', cls: 'good' },
        { icon: '⏰', color: 'var(--accent)', title: '0–2 day holds in high-vol are cleanest', body: 'Short holds (0–2d) with avg NIFTY range 202pts: 70% WR. You avoid overnight exposure in uncertain regimes. Matches your best F&O hold duration data.', verdict: 'Scale in/out quickly', cls: 'info' },
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

  Object.assign(window.TA, { drawMarketContext });
})();

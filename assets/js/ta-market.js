/* ===== Trade Analytics — Market Context panel ===== */
(() => {
  const { charts } = window.TA;

  function drawMarketContext() {
    const ETRADES = window.SEED?.enrichedTrades || null;
    const NDAILY  = window.SEED?.niftyDaily    || null;
    const TRADES  = window.SEED?.trades        || [];   // raw trades always present
    const hasOhlc = !!(NDAILY && Object.keys(NDAILY).length > 0);
    const hasEnriched = !!(ETRADES && ETRADES.length > 0);
    const hasTrades = TRADES.length > 0;

    const dynamicArea = document.getElementById('marketDynamicContent');
    if (!dynamicArea) return;

    // ── FULLY EMPTY STATE (no trades at all) ─────────────────────────────
    if (!hasTrades && !hasEnriched) {
      dynamicArea.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
             padding:80px 24px;text-align:center;gap:18px;
             background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg)">
          <div style="font-size:48px;line-height:1;opacity:.4">📡</div>
          <div style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-.015em">No Market Context Data</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.65;max-width:48ch">
            Upload your <b style="color:var(--ink)">F&O Tradebook</b>,
            <b style="color:var(--ink)">F&O P&L CSV</b> and optionally
            <b style="color:var(--ink)">NIFTY 50 OHLC JSON</b> to see how your trades correlate with market conditions.
          </div>
          <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:12px;color:var(--ink-2)">📊 Gap analysis</div>
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:12px;color:var(--ink-2)">📈 NIFTY zone P&L</div>
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:12px;color:var(--ink-2)">🎯 Trend alignment</div>
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:12px;color:var(--ink-2)">🗺️ Trade timeline</div>
          </div>
          <button class="btn-primary" style="margin-top:8px" onclick="document.getElementById('btnData').click()">Upload Data</button>
        </div>`;
      ['zonePnl','niftyTimeline','ctxBubble'].forEach(k => { charts[k]?.destroy(); delete charts[k]; });
      return;
    }

    // ── PARTIAL STATE (trades loaded, no OHLC) ───────────────────────────
    if (!hasEnriched && hasTrades) {
      renderPartialState(dynamicArea, TRADES);
      return;
    }

    // ── FULL STATE (trades + OHLC enriched) ──────────────────────────────
    renderFullState(dynamicArea, ETRADES, NDAILY);
  }

  // ── PARTIAL STATE: show trade stats without OHLC data ──────────────────
  function renderPartialState(container, TRADES) {
    const fmtPnl = n => (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
    const wrOf   = arr => arr.length ? ((arr.filter(t=>t.win).length/arr.length)*100).toFixed(1) : '—';
    const pnlOf  = arr => arr.reduce((a,t)=>a+t.pnl,0);

    const wins   = TRADES.filter(t=>t.win);
    const losses = TRADES.filter(t=>!t.win);
    const ceTrades = TRADES.filter(t=>t.type==='CE');
    const peTrades = TRADES.filter(t=>t.type==='PE');
    const intra  = TRADES.filter(t=>t.k==='intra');
    const posi   = TRADES.filter(t=>t.k!=='intra');

    // By stock
    const byStock = {};
    TRADES.forEach(t => {
      const s = t.stk||t.sym||'?';
      if (!byStock[s]) byStock[s] = { pnl:0, n:0, wins:0 };
      byStock[s].pnl += t.pnl; byStock[s].n++; if(t.win) byStock[s].wins++;
    });
    const stockRows = Object.entries(byStock).sort((a,b)=>b[1].pnl-a[1].pnl).slice(0,8);
    const maxStockAbs = Math.max(...stockRows.map(([,v])=>Math.abs(v.pnl)), 1);

    container.innerHTML = `
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 8%,var(--surface)),var(--surface));
           border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:18px;
           display:flex;align-items:flex-start;gap:20px">
        <div style="font-size:28px;line-height:1;flex-shrink:0;margin-top:2px">📡</div>
        <div style="flex:1">
          <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:4px">Market Context · Partial Data</div>
          <div style="font-size:17px;font-weight:700;letter-spacing:-.015em;margin-bottom:6px">Trade summary loaded — NIFTY OHLC not yet uploaded</div>
          <div style="font-size:12.5px;color:var(--ink-2);line-height:1.65">
            ${TRADES.length} F&O trades are loaded. To unlock full market correlation (gap analysis, NIFTY zone P&L, timeline), upload the <b style="color:var(--ink)">NIFTY 50 OHLC JSON</b> via the Data button.
          </div>
        </div>
        <div style="flex-shrink:0;text-align:center">
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 18px;margin-bottom:8px">
            <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Trades</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:var(--ink)">${TRADES.length}</div>
          </div>
          <button class="btn-primary" onclick="document.getElementById('btnData').click()" style="width:100%">+ Add NIFTY OHLC</button>
        </div>
      </div>

      <!-- SUMMARY GRID -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
        ${[
          { lbl:'Overall WR', val: wrOf(TRADES)+'%', sub: `${wins.length}W · ${losses.length}L`, clr: Number(wrOf(TRADES))>=70?'var(--pos)':'var(--neg)' },
          { lbl:'CE Win Rate', val: wrOf(ceTrades)+'%', sub: `${ceTrades.length} call trades`, clr: 'var(--ce)' },
          { lbl:'PE Win Rate', val: wrOf(peTrades)+'%', sub: `${peTrades.length} put trades`, clr: 'var(--pe)' },
          { lbl:'Intraday WR', val: wrOf(intra)+'%', sub: `${intra.length} intra · ${posi.length} posi`, clr: 'var(--accent)' },
        ].map(k=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow)">
          <div style="font-size:9.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">${k.lbl}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:${k.clr};margin-bottom:3px">${k.val}</div>
          <div style="font-size:10px;color:var(--muted)">${k.sub}</div>
        </div>`).join('')}
      </div>

      <!-- BY STOCK -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-head">
          <div class="card-title">P&L by Stock — F&O positions</div>
          <div class="card-sub">All ${TRADES.length} trades · sorted by P&L</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${stockRows.map(([sym, v]) => {
            const pct = (Math.abs(v.pnl) / maxStockAbs * 100).toFixed(1);
            const wr  = v.n ? ((v.wins/v.n)*100).toFixed(0) : 0;
            const clr = v.pnl >= 0 ? 'var(--pos)' : 'var(--neg)';
            return `<div style="display:grid;grid-template-columns:70px 1fr 90px 45px;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
              <div style="font-size:12px;font-weight:700;color:var(--ink)">${sym}</div>
              <div style="height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${clr};border-radius:3px"></div>
              </div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;text-align:right;color:${clr}">${fmtPnl(v.pnl)}</div>
              <div style="font-size:10px;color:var(--muted);text-align:right">${wr}% WR</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- CE vs PE breakdown -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        ${[
          { label:'Call Options (CE)', trades: ceTrades, clr:'var(--ce)', emoji:'📞' },
          { label:'Put Options (PE)',  trades: peTrades, clr:'var(--pe)', emoji:'📉' },
        ].map(s => {
          const sw = s.trades.filter(t=>t.win);
          const sl = s.trades.filter(t=>!t.win);
          const sp = pnlOf(s.trades);
          return `<div class="card">
            <div class="card-head">
              <div class="card-title">${s.emoji} ${s.label}</div>
              <div class="card-sub">${s.trades.length} trades</div>
            </div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;color:${sp>=0?'var(--pos)':'var(--neg)'};margin-bottom:8px">${fmtPnl(sp)}</div>
            <div style="display:flex;gap:16px;font-size:12px;color:var(--muted)">
              <span><b style="color:var(--pos)">${sw.length}</b> wins</span>
              <span><b style="color:var(--neg)">${sl.length}</b> losses</span>
              <span><b style="color:${s.clr}">${wrOf(s.trades)}%</b> WR</span>
            </div>
            <div style="margin-top:10px;height:4px;background:var(--surface-3);border-radius:2px;overflow:hidden">
              <div style="width:${wrOf(s.trades)}%;height:100%;background:${s.clr};border-radius:2px"></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- OHLC CTA -->
      <div style="background:color-mix(in srgb,var(--accent) 8%,var(--surface));border:1.5px dashed var(--accent);
           border-radius:var(--radius-lg);padding:24px;text-align:center">
        <div style="font-size:24px;margin-bottom:10px">📊</div>
        <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:8px">Unlock Full Market Context</div>
        <div style="font-size:12.5px;color:var(--ink-2);line-height:1.65;margin-bottom:14px;max-width:56ch;margin-inline:auto">
          Upload the <b style="color:var(--ink)">NIFTY 50 OHLC JSON</b> to see gap analysis, NIFTY zone P&L, trade timeline overlaid on NIFTY price, and more. Run <code style="background:var(--surface-2);padding:2px 6px;border-radius:4px;font-family:monospace">fetch_ohlc.py</code> to generate this file from Kite Connect.
        </div>
        <button class="btn-primary" onclick="document.getElementById('btnData').click()">Open Data Upload</button>
      </div>`;
  }

  // ── FULL STATE: all OHLC-enriched content ──────────────────────────────
  function renderFullState(container, ETRADES, NDAILY) {
    const fmtPnl = n => (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
    const posCol2 = () => window.TA.posCol();
    const negCol2 = () => window.TA.negCol();
    const fontC   = () => getComputedStyle(document.body).getPropertyValue('--muted').trim();
    const gridC   = () => getComputedStyle(document.body).getPropertyValue('--border').trim();
    const inkC    = () => getComputedStyle(document.body).getPropertyValue('--ink').trim();
    const tipOpts = {
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--surface-2').trim() || '#1a2030',
      borderColor:     getComputedStyle(document.body).getPropertyValue('--border').trim(),
      borderWidth: 1, titleColor: inkC(), bodyColor: fontC(),
      padding: 10, cornerRadius: 6,
      titleFont: { family:"'JetBrains Mono',monospace", size:11, weight:'600' },
      bodyFont:  { family:"'JetBrains Mono',monospace", size:11 }
    };
    const wrOf   = arr => arr.length ? ((arr.filter(t=>t.win).length/arr.length)*100).toFixed(0) : '—';
    const pnlOf  = arr => arr.reduce((a,t)=>a+t.pnl,0);

    // Gap buckets
    const gapBuckets = {
      big_gap_up:   { label:'Big Gap-Up >+1%',          trades:[] },
      gap_up:       { label:'Moderate Gap-Up +0.3–1%',  trades:[] },
      neutral_open: { label:'Flat Open ±0.3%',           trades:[] },
      gap_down:     { label:'Moderate Gap-Down −0.3–1%', trades:[] },
      big_gap_down: { label:'Big Gap-Down <−1%',         trades:[] },
    };
    ETRADES.forEach(t => { const ctx = t.market_ctx || 'neutral_open'; if (gapBuckets[ctx]) gapBuckets[ctx].trades.push(t); });

    // Zone
    const zoneMap  = { below_23k:'<23k', '23k_24k':'23k–24k', '24k_25k':'24k–25k', '25k_26k':'25k–26k', above_26k:'>26k' };
    const zonePnl  = {}, zoneN = {}, zoneWin = {};
    const zones = ['<23k','23k–24k','24k–25k','25k–26k','>26k'];
    zones.forEach(z => { zonePnl[z]=0; zoneN[z]=0; zoneWin[z]=0; });
    ETRADES.forEach(t => { const z = zoneMap[t.nifty_zone] || '24k–25k'; zonePnl[z]+=t.pnl; zoneN[z]++; if(t.win) zoneWin[z]++; });
    const activeZones  = zones.filter(z => zoneN[z] > 0);
    const bestZone     = activeZones.reduce((a,b)=>zonePnl[b]>zonePnl[a]?b:a, activeZones[0]||'');
    const worstZone    = activeZones.reduce((a,b)=>zonePnl[b]<zonePnl[a]?b:a, activeZones[0]||'');
    const bestZoneWR   = bestZone  && zoneN[bestZone]  ? ((zoneWin[bestZone]/zoneN[bestZone])*100).toFixed(0) : 0;
    const worstZoneWR  = worstZone && zoneN[worstZone] ? ((zoneWin[worstZone]/zoneN[worstZone])*100).toFixed(0) : 0;

    // CE/PE direction
    const ceUp=[],ceDown=[],peUp=[],peDown=[];
    ETRADES.forEach(t => { const up=(t.nifty_ret_during||0)>0; if(t.type==='CE')(up?ceUp:ceDown).push(t); else if(t.type==='PE')(up?peUp:peDown).push(t); });

    // Volatility
    const hiVol = ETRADES.filter(t=>(t.od_nifty_range||0)>300);
    const mdVol = ETRADES.filter(t=>(t.od_nifty_range||0)>=150&&(t.od_nifty_range||0)<=300);
    const loVol = ETRADES.filter(t=>(t.od_nifty_range||0)<150);
    const avgRangeOf = arr => arr.length ? Math.round(arr.reduce((a,t)=>a+(t.od_nifty_range||0),0)/arr.length) : 0;
    const winAvgRange  = avgRangeOf(ETRADES.filter(t=>t.win));
    const lossAvgRange = avgRangeOf(ETRADES.filter(t=>!t.win));

    const allDates = Object.keys(NDAILY).sort();
    const tradingDays = allDates.length;
    const dateFrom = allDates[0]||''; const dateTo = allDates[allDates.length-1]||'';
    const fmtDate = s => s ? new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

    // Gap bars HTML
    const gapBarsHTML = Object.entries(gapBuckets).map(([key,gb]) => {
      const n = gb.trades.length; if(!n) return '';
      const wr = wrOf(gb.trades);
      const p  = pnlOf(gb.trades);
      const clr = Number(wr)>=70?'var(--pos)':Number(wr)>=50?'var(--accent)':'var(--neg)';
      const pClr = p>=0?'var(--pos)':'var(--neg)';
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <span style="font-size:12px;font-weight:600;color:var(--ink)">${gb.label} <span style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace">n=${n}</span></span>
          <div style="display:flex;gap:12px">
            <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${clr}">${wr}% WR</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${pClr}">${fmtPnl(p)}</span>
          </div>
        </div>
        <div style="height:7px;background:var(--surface-3);border-radius:4px;overflow:hidden">
          <div style="width:${wr}%;height:100%;background:${clr};border-radius:4px"></div>
        </div>
      </div>`;
    }).join('');

    // Vol bars
    const volBars = [
      { label:'High vol >300 pts', arr: hiVol },
      { label:'Medium 150–300',    arr: mdVol },
      { label:'Low vol ≤150',      arr: loVol },
    ].map(v => {
      if (!v.arr.length) return '';
      const wr = wrOf(v.arr);
      const clr = Number(wr)>=70?'var(--pos)':Number(wr)>=50?'var(--accent)':'var(--neg)';
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <span style="font-size:11px;color:var(--muted);width:140px;flex-shrink:0">${v.label}</span>
        <div style="flex:1;height:20px;background:var(--surface-3);border-radius:3px;overflow:hidden;position:relative">
          <div style="position:absolute;inset:0;width:${wr}%;background:color-mix(in srgb,${clr} 55%,transparent)"></div>
          <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:10.5px;font-weight:700;color:var(--ink);font-family:'JetBrains Mono',monospace">${wr}% WR · n=${v.arr.length}</span>
        </div>
      </div>`;
    }).join('');

    // Zone summary rows
    const zoneSummaryHTML = zones.map(z => {
      const n = zoneN[z]; if (!n) return '';
      const p = zonePnl[z]; const wr2 = ((zoneWin[z]||0)/n*100).toFixed(0);
      const clr = p>=0?'var(--pos)':'var(--neg)';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:7px">
        <div style="font-size:12px;font-weight:600;color:var(--ink)">${z}</div>
        <div style="display:flex;gap:14px;font-family:'JetBrains Mono',monospace;font-size:12px">
          <span style="color:var(--muted)">n=${n}</span>
          <span style="color:var(--muted)">${wr2}% WR</span>
          <span style="color:${clr};font-weight:700">${fmtPnl(p)}</span>
        </div>
      </div>`;
    }).join('');

    // OHLC rules
    const ohlcRules = buildOhlcRules({ gapBuckets, worstZone, bestZone, zones, zoneMap, zonePnl, zoneWin, zoneN, ETRADES });

    container.innerHTML = `
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 8%,var(--surface)),var(--surface));
           border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:18px;
           display:flex;align-items:flex-start;gap:20px">
        <div style="font-size:28px;line-height:1;flex-shrink:0;margin-top:2px">📡</div>
        <div style="flex:1">
          <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:4px">OHLC Cross-Correlation · NSE:NIFTY 50</div>
          <div style="font-size:17px;font-weight:700;letter-spacing:-.015em;margin-bottom:6px">Your trades mapped against NIFTY's actual daily behaviour</div>
          <div style="font-size:12.5px;color:var(--ink-2);line-height:1.65">
            ${ETRADES.length} trades · <b style="color:var(--ink)">${fmtDate(dateFrom)}</b> → <b style="color:var(--ink)">${fmtDate(dateTo)}</b> enriched with gap%, intraday range, trend and zone data.
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;text-align:center">
            <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Enriched</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:700;color:var(--ink)">${ETRADES.length}</div>
          </div>
          <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;text-align:center">
            <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">OHLC days</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:700;color:var(--accent)">${tradingDays}</div>
          </div>
        </div>
      </div>

      <!-- ROW 1: Gap + Zone -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="card">
          <div class="card-head" style="margin-bottom:16px">
            <div class="card-title">Win Rate & P&L by Gap at Entry</div>
            <div class="card-sub">What NIFTY was doing when you entered</div>
          </div>
          ${gapBarsHTML || '<div style="padding:20px;color:var(--muted);text-align:center">No gap data</div>'}
        </div>
        <div class="card">
          <div class="card-head" style="margin-bottom:14px">
            <div class="card-title">P&L by NIFTY Zone at Entry</div>
            <div class="card-sub">Which market altitude you trade best in</div>
          </div>
          <div class="chart-h200"><canvas id="cZonePnl"></canvas></div>
          ${bestZone||worstZone?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
            ${bestZone?`<div style="background:color-mix(in srgb,var(--pos) 8%,var(--surface-2));border:1px solid var(--border);border-radius:6px;padding:10px 12px">
              <div style="font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:3px">Best zone</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--pos)">${bestZone}</div>
              <div style="font-size:11px;color:var(--muted)">${bestZoneWR}% WR · ${fmtPnl(zonePnl[bestZone]||0)}</div>
            </div>`:''}
            ${worstZone&&worstZone!==bestZone?`<div style="background:color-mix(in srgb,var(--neg) 8%,var(--surface-2));border:1px solid var(--border);border-radius:6px;padding:10px 12px">
              <div style="font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:3px">Worst zone</div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--neg)">${worstZone}</div>
              <div style="font-size:11px;color:var(--muted)">${worstZoneWR}% WR · ${fmtPnl(zonePnl[worstZone]||0)}</div>
            </div>`:''}
          </div>`:''}
        </div>
      </div>

      <!-- ROW 2: CE/PE + Volatility -->
      <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:14px;margin-bottom:14px">
        <div class="card">
          <div class="card-head" style="margin-bottom:16px">
            <div class="card-title">NIFTY Trend During Hold — CE & PE Alignment</div>
            <div class="card-sub">Did the market move in your option's direction?</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${[
              { lbl:'CALL Options (CE)', clr:'var(--ce)', up: ceUp, down: ceDown, upDesc:'NIFTY rose ↑', downDesc:'NIFTY fell ↓' },
              { lbl:'PUT Options (PE)',  clr:'var(--gold)', up: peUp, down: peDown, upDesc:'NIFTY rose ↑', downDesc:'NIFTY fell ↓' },
            ].map(s => `<div>
              <div style="font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${s.clr};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${s.clr}">${s.lbl}</div>
              ${s.up.length?`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px dashed var(--border)">
                <div><div style="font-size:12px;color:var(--ink);font-weight:600">${s.upDesc}</div><div style="font-size:10px;color:var(--muted)">n=${s.up.length}</div></div>
                <div style="text-align:right"><div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:${s.clr}">${wrOf(s.up)}% WR</div><div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${pnlOf(s.up)>=0?'var(--pos)':'var(--neg)'}">${fmtPnl(pnlOf(s.up))}</div></div>
              </div>`:''}
              ${s.down.length?`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0">
                <div><div style="font-size:12px;color:var(--ink);font-weight:600">${s.downDesc}</div><div style="font-size:10px;color:var(--muted)">n=${s.down.length}</div></div>
                <div style="text-align:right"><div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:${s.clr}">${wrOf(s.down)}% WR</div><div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${pnlOf(s.down)>=0?'var(--pos)':'var(--neg)'}">${fmtPnl(pnlOf(s.down))}</div></div>
              </div>`:''}
              ${!s.up.length&&!s.down.length?'<div style="color:var(--muted);font-size:12px;padding:10px 0">No data</div>':''}
            </div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head" style="margin-bottom:16px">
            <div class="card-title">Volatility Profile at Entry</div>
            <div class="card-sub">NIFTY range on entry day</div>
          </div>
          ${volBars||'<div style="color:var(--muted);font-size:12px">No range data</div>'}
          ${winAvgRange||lossAvgRange?`<div style="border-top:1px dashed var(--border);padding-top:12px;margin-top:10px">
            <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:8px">Exit-day range</div>
            <div style="display:flex;gap:10px">
              <div style="flex:1;text-align:center;background:var(--surface-2);border:1px solid var(--border);border-radius:7px;padding:10px">
                <div style="font-size:10px;color:var(--muted)">Wins exit on</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--pos)">${winAvgRange}</div>
                <div style="font-size:10px;color:var(--muted)">avg pts</div>
              </div>
              <div style="flex:1;text-align:center;background:var(--surface-2);border:1px solid var(--border);border-radius:7px;padding:10px">
                <div style="font-size:10px;color:var(--muted)">Losses exit on</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--neg)">${lossAvgRange}</div>
                <div style="font-size:10px;color:var(--muted)">avg pts</div>
              </div>
            </div>
          </div>`:''}
        </div>
      </div>

      <!-- ROW 3: Timeline -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-head" style="margin-bottom:14px">
          <div class="card-title">NIFTY Price vs Your Trade Timeline</div>
          <div class="card-sub">Blue line = NIFTY daily close · ▲ Green = Win entry · ▲ Red = Loss entry</div>
        </div>
        <div class="chart-h200"><canvas id="cNiftyTimeline"></canvas></div>
      </div>

      <!-- ROW 4: Trade table + Zone summary -->
      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-bottom:14px">
        <div class="card">
          <div class="card-head" style="margin-bottom:10px">
            <div class="card-title">Trade-Level Market Context</div>
            <div class="card-sub">Every trade enriched with NIFTY conditions</div>
          </div>
          <div style="overflow:auto;max-height:320px">
            <table class="tbl">
              <thead><tr>
                <th>Symbol</th><th>Type</th><th class="num">P&L</th><th>Result</th>
                <th class="num">Gap %</th><th>Context</th><th class="num">NIFTY during</th><th>Aligned</th>
              </tr></thead>
              <tbody id="tMCBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-head" style="margin-bottom:10px">
            <div class="card-title">P&L by NIFTY Zone</div>
            <div class="card-sub">Where your edge lives by market level</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px">${zoneSummaryHTML}</div>
        </div>
      </div>

      <!-- ROW 5: Bubble + OHLC rules -->
      <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:14px;margin-bottom:14px">
        <div class="card">
          <div class="card-head" style="margin-bottom:14px">
            <div class="card-title">Gap% vs P&L</div>
            <div class="card-sub">Each bubble = one trade · size = NIFTY day range</div>
          </div>
          <div class="chart-h240"><canvas id="cContextBubble"></canvas></div>
        </div>
        <div class="card">
          <div class="card-head" style="margin-bottom:14px">
            <div class="card-title">OHLC-Derived Trading Rules</div>
            <div class="card-sub">Derived from your actual history vs market data</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${ohlcRules.slice(0,6).map(r=>`<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start">
              <div style="font-size:18px;flex-shrink:0;line-height:1">${r.icon}</div>
              <div style="flex:1">
                <div style="font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:3px">${r.title}</div>
                <div style="font-size:11.5px;color:var(--ink-2);line-height:1.55">${r.body}</div>
              </div>
              <span class="ins-verdict v-${r.cls}" style="flex-shrink:0">${r.verdict}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>`;

    // ── CHARTS ─────────────────────────────────────────────────────────────

    // Zone P&L chart
    setTimeout(() => {
      const ctx1 = document.getElementById('cZonePnl');
      if (ctx1) {
        charts['zonePnl']?.destroy();
        const pnls = zones.map(z => Math.round(zonePnl[z]||0));
        charts['zonePnl'] = new Chart(ctx1, {
          type:'bar',
          data:{ labels:zones, datasets:[{ data:pnls, backgroundColor:pnls.map(v=>v>=0?posCol2():negCol2()), borderRadius:6, maxBarThickness:52 }] },
          options:{ responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{display:false}, tooltip:{...tipOpts,callbacks:{label:c=>{const z=zones[c.dataIndex];return[`P&L: ${fmtPnl(c.raw)}`,`WR: ${zoneN[z]?((zoneWin[z]||0)/zoneN[z]*100).toFixed(0):0}%  |  n=${zoneN[z]||0}`];}}} },
            scales:{ x:{ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:11}},grid:{display:false}}, y:{ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'},grid:{color:gridC()}} }
          }
        });
      }

      // NIFTY Timeline
      const ctx2 = document.getElementById('cNiftyTimeline');
      if (ctx2) {
        charts['niftyTimeline']?.destroy();
        const closes = allDates.map(d => NDAILY[d].close);
        const winPts=[], lossPts=[];
        ETRADES.forEach(t => {
          const di = allDates.findIndex(d => d >= t.open_date);
          if (di >= 0) {
            const pt = { x:di, y:NDAILY[allDates[di]]?.open||closes[di], sym:(t.sym||'').slice(0,18), pnl:t.pnl };
            if (t.win) winPts.push(pt); else lossPts.push(pt);
          }
        });
        const maxTicks = tradingDays <= 30 ? allDates.length : Math.min(15, allDates.length);
        charts['niftyTimeline'] = new Chart(ctx2, {
          type:'line',
          data:{
            labels: allDates.map(d => { const dt=new Date(d); return tradingDays<=45?`${dt.getDate()} ${dt.toLocaleString('default',{month:'short'})}`:dt.toLocaleString('default',{month:'short'}); }),
            datasets:[
              { label:'NIFTY Close', data:closes, borderColor:'rgba(77,159,255,0.7)', borderWidth:1.5, backgroundColor:'rgba(77,159,255,0.05)', fill:true, pointRadius:0, tension:0.2, order:3 },
              { label:'Win entry', data:winPts.map(p=>({x:p.x,y:p.y})), type:'scatter', backgroundColor:posCol2(), borderColor:'#fff', borderWidth:1.5, pointRadius:7, pointStyle:'triangle', order:1, parsing:false },
              { label:'Loss entry', data:lossPts.map(p=>({x:p.x,y:p.y})), type:'scatter', backgroundColor:negCol2(), borderColor:'#fff', borderWidth:1.5, pointRadius:7, pointStyle:'triangle', order:2, parsing:false },
            ]
          },
          options:{
            responsive:true, maintainAspectRatio:false,
            interaction:{mode:'nearest',axis:'x',intersect:false},
            plugins:{
              legend:{labels:{color:fontC(),font:{family:"'Inter Tight',sans-serif",size:10},boxWidth:8,boxHeight:8,padding:14}},
              tooltip:{...tipOpts,callbacks:{label:c=>{if(c.dataset.label==='NIFTY Close')return`NIFTY: ${(c.raw?.toFixed?.(0)||c.raw)}`;const arr=c.dataset.label==='Win entry'?winPts:lossPts;const pt=arr[c.dataIndex];return pt?[`${pt.sym}`,`P&L: ${fmtPnl(pt.pnl)}`]:'';}}}
            },
            scales:{
              x:{ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:9},maxTicksLimit:maxTicks,maxRotation:0},grid:{color:gridC()}},
              y:{ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>v.toLocaleString('en-IN')},grid:{color:gridC()}}
            }
          }
        });
      }

      // Bubble
      const ctx3 = document.getElementById('cContextBubble');
      if (ctx3) {
        charts['ctxBubble']?.destroy();
        const bdata = ETRADES.map(t=>({x:t.od_nifty_gap||0,y:t.pnl,r:Math.max(4,Math.min(18,(t.od_nifty_range||150)/30)),sym:(t.sym||'').slice(0,18),win:t.win,pnl:t.pnl,gap:t.od_nifty_gap,range:t.od_nifty_range}));
        charts['ctxBubble'] = new Chart(ctx3, {
          type:'bubble',
          data:{datasets:[
            {label:'Win', data:bdata.filter(d=>d.win), backgroundColor:'rgba(31,107,78,0.6)', borderColor:posCol2(), borderWidth:1},
            {label:'Loss',data:bdata.filter(d=>!d.win),backgroundColor:'rgba(168,54,44,0.6)', borderColor:negCol2(), borderWidth:1},
          ]},
          options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{labels:{color:fontC(),font:{family:"'Inter Tight',sans-serif",size:10},boxWidth:8}},tooltip:{...tipOpts,callbacks:{label:c=>{const d=c.raw;return[`${d.sym}`,`Gap: ${(d.gap||0).toFixed(2)}%`,`P&L: ${fmtPnl(d.pnl)}`,`Range: ${Math.round(d.range||0)}pts`];}}}},
            scales:{x:{title:{display:true,text:'NIFTY Gap at Entry (%)',color:fontC(),font:{size:10}},ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>v+'%'},grid:{color:gridC()}},y:{title:{display:true,text:'Trade P&L (₹)',color:fontC(),font:{size:10}},ticks:{color:fontC(),font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>'₹'+(v/1000).toFixed(0)+'k'},grid:{color:gridC()}}}
          }
        });
      }

      // Enriched trade table
      const tbody = document.getElementById('tMCBody');
      if (tbody) {
        const ctxLbl = {big_gap_up:'🔴 Big Gap-Up',gap_up:'🟡 Gap-Up',big_gap_down:'🟢 Big Gap-Down',gap_down:'🔵 Gap-Down',neutral_open:'⚪ Neutral'};
        tbody.innerHTML = [...ETRADES].sort((a,b)=>b.pnl-a.pnl).map(t => {
          const aligned = (t.type==='CE'&&(t.nifty_ret_during||0)>0)||(t.type==='PE'&&(t.nifty_ret_during||0)<0);
          const gap = (t.od_nifty_gap||0).toFixed(2);
          const nd  = (t.nifty_ret_during||0).toFixed(1);
          return `<tr>
            <td style="font-size:11.5px">${(t.sym||'').slice(0,24)}</td>
            <td><span class="tag ${t.type==='CE'?'ce':'pe'}">${t.type||'—'}</span></td>
            <td class="num"><span class="${t.pnl>=0?'pos':'neg'}">${fmtPnl(t.pnl)}</span></td>
            <td><span class="tag ${t.win?'win':'loss'}">${t.win?'Win':'Loss'}</span></td>
            <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${(t.od_nifty_gap||0)>0?'var(--pos)':'var(--neg)'}">${gap}%</td>
            <td><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--surface-2);color:var(--ink-2)">${ctxLbl[t.market_ctx]||t.market_ctx||'—'}</span></td>
            <td class="num" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${nd>=0?'var(--pos)':'var(--neg)'}">${nd}%</td>
            <td style="text-align:center;font-size:13px">${aligned?'<span style="color:var(--pos)">✓</span>':'<span style="color:var(--neg)">✗</span>'}</td>
          </tr>`;
        }).join('');
      }
    }, 50);
  }

  // ── OHLC RULES BUILDER ─────────────────────────────────────────────────
  function buildOhlcRules({ gapBuckets, worstZone, bestZone, zones, zoneMap, zonePnl, zoneWin, zoneN, ETRADES }) {
    const fmtPnl = n => (n>=0?'+':'−')+'₹'+Math.abs(Math.round(n)).toLocaleString('en-IN');
    const wrOf   = arr => arr.length ? ((arr.filter(t=>t.win).length/arr.length)*100).toFixed(0) : null;
    const pnlOf  = arr => arr.reduce((a,t)=>a+t.pnl,0);
    const rules  = [];

    const bgu = gapBuckets.big_gap_up.trades;
    if (bgu.length>0) rules.push({ icon:'🚫', title:`Never enter on big gap-up (>+1%)`, body:`${bgu.length} trades after NIFTY gapped >1%. WR: ${wrOf(bgu)}%, P&L: ${fmtPnl(pnlOf(bgu))}. IV spikes on gap-ups mean inflated premium with no cushion.`, verdict:'Avoid', cls:'bad' });

    const mgu = gapBuckets.gap_up.trades;
    if (mgu.length>0&&Number(wrOf(mgu))>=60) rules.push({ icon:'✅', title:`Moderate gap-up (+0.3–1%) is sweet spot`, body:`${mgu.length} trades: ${wrOf(mgu)}% WR, ${fmtPnl(pnlOf(mgu))}. Directional but not euphoric.`, verdict:'Best entry condition', cls:'good' });

    const gd = [...gapBuckets.big_gap_down.trades, ...gapBuckets.gap_down.trades];
    if (gd.length>0) { const wr=wrOf(gd); rules.push({ icon:Number(wr)>=55?'⬇️':'⚠️', title:`Gap-down entries: ${wr}% WR across ${gd.length} trades`, body:`${fmtPnl(pnlOf(gd))}. ${Number(wr)>=55?'Oversold bounces working.':'Catching falling knives.'}`, verdict:Number(wr)>=55?'Contrarian edge':'Review direction', cls:Number(wr)>=55?'good':'bad' }); }

    const intra  = ETRADES.filter(t=>t.k==='intra');
    const posi   = ETRADES.filter(t=>t.k!=='intra');
    if (intra.length&&posi.length) { const iWR=wrOf(intra),pWR=wrOf(posi); const better=Number(iWR)>Number(pWR)?'Intraday':'Positional'; rules.push({ icon:'⏰', title:`${better} trades outperform`, body:`Intraday: ${iWR}% WR · Positional: ${pWR}% WR.`, verdict:`Favour ${better}`, cls:'info' }); }

    const hvt = ETRADES.filter(t=>(t.od_nifty_range||0)>300);
    if (hvt.length>0) { const wr=wrOf(hvt); rules.push({ icon:'📐', title:`High-vol days (>300pt): ${wr}% WR`, body:`${hvt.length} trades on days NIFTY ranged >300 pts.`, verdict:Number(wr)>=70?'Ride volatility':'Caution on high-vol', cls:Number(wr)>=70?'good':'bad' }); }

    while (rules.length<3) rules.push({ icon:'📊', title:'More data = sharper rules', body:'Upload more months to generate additional statistically significant rules.', verdict:'Keep trading', cls:'info' });
    return rules.slice(0,6);
  }

  Object.assign(window.TA, { drawMarketContext });
})();
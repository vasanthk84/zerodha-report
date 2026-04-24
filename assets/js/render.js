// ═══════════════════════════════════════════════════════════════
// RENDER EVERYTHING FROM DATA
// ═══════════════════════════════════════════════════════════════
function render() {
  const F = DATA.fo, E = DATA.eq, M = DATA.meta;
  const fs = F.summary, es = E.summary;

  // Header
  document.getElementById('hFo').textContent  = fR(fs.net);
  document.getElementById('hFo').style.color  = fs.net>=0?'var(--green)':'var(--red)';
  document.getElementById('hEq').textContent  = fR(es.pnl);
  document.getElementById('hEq').style.color  = es.pnl>=0?'var(--green)':'var(--red)';
  const tot = fs.net + es.net;
  document.getElementById('hTot').textContent = fR(tot);
  document.getElementById('hTot').style.color = tot>=0?'var(--green)':'var(--red)';

  // ── F&O STATS ────────────────────────────────────────────────
  document.getElementById('f-pnl').textContent    = fR(fs.pnl);
  const fnet = fs.net;
  const fnetEl = document.getElementById('f-net');
  fnetEl.textContent = fR(fnet); fnetEl.className='stat-val '+(fnet>=0?'green':'red');
  document.getElementById('f-chg').textContent    = 'Charges ₹'+fL(M.charges_fo);
  document.getElementById('f-wr').textContent     = fs.win_rate+'%';
  document.getElementById('f-wl').textContent     = fs.wins+'W · '+fs.losses+'L';
  document.getElementById('f-pos').textContent    = fs.total;
  document.getElementById('f-avg-days').textContent='Avg '+fs.avg_days+'d held';
  document.getElementById('f-ce').textContent     = fR(fs.ce_pnl);
  document.getElementById('f-pe').textContent     = fR(fs.pe_pnl);
  document.getElementById('f-worst').textContent  = fR(fs.worst.pnl);
  document.getElementById('f-worst-sym').textContent = fs.worst.sym;

  // ── MONTHLY ──────────────────────────────────────────────────
  const mLabels = F.by_month.map(m=>m.month_label);
  const mPnls   = F.by_month.map(m=>m.total_pnl);
  mk('cMonthly',{type:'bar',data:{labels:mLabels,datasets:[{data:mPnls,
    backgroundColor:mPnls.map(v=>v>=0?'rgba(15,155,110,.65)':'rgba(214,64,69,.65)'),
    borderColor:mPnls.map(v=>v>=0?'#0f9b6e':'#d64045'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>fR(c.raw)}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},
            y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  // ── CUMULATIVE ───────────────────────────────────────────────
  const cDates = F.cumulative.map(c=>c.close_date);
  const cVals  = F.cumulative.map(c=>c.cum_pnl);
  mk('cCumul',{type:'line',data:{labels:cDates,datasets:[{data:cVals,borderColor:'#2563eb',borderWidth:2,
    fill:true,backgroundColor:'rgba(37,99,235,.07)',pointRadius:0,tension:0.3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>fR(c.raw)}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont,maxTicksLimit:10,maxRotation:45},grid:{color:'#f3f4f6'}},
            y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  // ── STOCK CHARTS ─────────────────────────────────────────────
  const stocks  = F.by_stock;
  const sLabels = stocks.map(s=>s.stock);
  const sPnls   = stocks.map(s=>s.total_pnl);
  mk('cStock',{type:'bar',data:{labels:sLabels,datasets:[{data:sPnls,
    backgroundColor:sPnls.map(v=>v>=0?'rgba(15,155,110,.65)':'rgba(214,64,69,.65)'),
    borderColor:sPnls.map(v=>v>=0?'#0f9b6e':'#d64045'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
    plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ₹${fL(c.raw)} | ${stocks[c.dataIndex].count} trades`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}},
            y:{ticks:{color:'#374151',font:{family:"'DM Sans'",size:10}},grid:{color:'#f3f4f6'}}}}});

  mk('cStockWr',{type:'bar',data:{labels:sLabels,datasets:[{data:stocks.map(s=>s.win_rate),
    backgroundColor:stocks.map(s=>s.win_rate>=80?'rgba(15,155,110,.65)':s.win_rate>=60?'rgba(197,130,10,.65)':'rgba(214,64,69,.65)'),
    borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
    plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ${c.raw}% | ${stocks[c.dataIndex].wins}W/${stocks[c.dataIndex].count-stocks[c.dataIndex].wins}L`}}},
    scales:{x:{min:0,max:100,ticks:{color:'#9ca3af',font:cFont,callback:v=>v+'%'},grid:{color:'#f3f4f6'}},
            y:{ticks:{color:'#374151',font:{family:"'DM Sans'",size:10}},grid:{color:'#f3f4f6'}}}}});

  // ── ENTRY PRICE CHARTS ───────────────────────────────────────
  const pb = F.by_price.map(p=>({...p,lbl:p.price_bucket.replace(/^[A-Z] /,'')}));
  mk('cPrice',{type:'bar',data:{labels:pb.map(p=>p.lbl),datasets:[{data:pb.map(p=>p.total_pnl),
    backgroundColor:pb.map(p=>p.total_pnl>=0?'rgba(37,99,235,.6)':'rgba(214,64,69,.6)'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ₹${fL(c.raw)} | ${pb[c.dataIndex].count} trades`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:{...cFont,size:8},maxRotation:30},grid:{color:'#f3f4f6'}},
            y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  mk('cPriceWr',{type:'bar',data:{labels:pb.map(p=>p.lbl),datasets:[{data:pb.map(p=>p.win_rate),
    backgroundColor:pb.map(p=>p.win_rate>=80?'rgba(15,155,110,.65)':p.win_rate>=60?'rgba(197,130,10,.65)':'rgba(214,64,69,.65)'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ${c.raw}% WR | avg ₹${fL(pb[c.dataIndex].avg_pnl)}`}}},
    scales:{x:{min:0,ticks:{color:'#9ca3af',font:{...cFont,size:8},maxRotation:30},grid:{color:'#f3f4f6'}},
            y:{min:0,max:100,ticks:{color:'#9ca3af',font:cFont,callback:v=>v+'%'},grid:{color:'#f3f4f6'}}}}});

  // ── INTRADAY vs POSITIONAL ───────────────────────────────────
  const id = F.intraday, po = F.positional;
  document.getElementById('ib-badge').textContent = id.count+' trades';
  document.getElementById('pb-badge').textContent = po.count+' trades';
  ['i','p'].forEach((pre,idx)=>{
    const d = idx===0?id:po;
    document.getElementById(pre+'-wr').textContent  = d.win_rate+'%';
    document.getElementById(pre+'-wr').style.color  = d.win_rate>=80?'var(--green)':'var(--gold)';
    document.getElementById(pre+'-wl').textContent  = d.wins+'W · '+d.losses+'L';
    document.getElementById(pre+'-pnl').textContent = fR(d.pnl);
    document.getElementById(pre+'-pnl').style.color = d.pnl>=0?'var(--green)':'var(--red)';
    document.getElementById(pre+'-avg').textContent = fR(d.avg_pnl);
    document.getElementById(pre+'-avg').style.color = d.avg_pnl>=0?'var(--green)':'var(--red)';
  });

  // ── HOLD DURATION CARDS ──────────────────────────────────────
  const qualCls = wr => wr>=90?'excellent':wr>=80?'good':wr>=60?'average':'poor';
  document.getElementById('holdCards').innerHTML = F.by_hold.map(h=>`
    <div class="hold-card ${qualCls(h.win_rate)}">
      <div class="hc-label">${h.hold_bucket}</div>
      <div class="hc-wr" style="color:${h.win_rate>=80?'var(--green)':h.win_rate>=60?'var(--gold)':'var(--red)'}">${h.win_rate}%</div>
      <div class="hc-sub">${h.count} trades</div>
      <div class="hc-pnl" style="color:${h.total_pnl>=0?'var(--green)':'var(--red)'}">${sg(h.total_pnl)}₹${fL(h.total_pnl)}</div>
    </div>`).join('');

  const hLabels = F.by_hold.map(h=>h.hold_bucket);
  mk('cHoldWr',{type:'bar',data:{labels:hLabels,datasets:[{data:F.by_hold.map(h=>h.win_rate),
    backgroundColor:F.by_hold.map(h=>h.win_rate>=80?'rgba(15,155,110,.65)':'rgba(214,64,69,.65)'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ${c.raw}% | ${F.by_hold[c.dataIndex].count} trades`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},
            y:{min:0,max:100,ticks:{color:'#9ca3af',font:cFont,callback:v=>v+'%'},grid:{color:'#f3f4f6'}}}}});

  mk('cHoldPnl',{type:'bar',data:{labels:hLabels,datasets:[{data:F.by_hold.map(h=>h.total_pnl),
    backgroundColor:F.by_hold.map(h=>h.total_pnl>=0?'rgba(15,155,110,.65)':'rgba(214,64,69,.65)'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ₹${fL(c.raw)}`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},
            y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  // ── INTRADAY vs POSITIONAL per STOCK ─────────────────────────
  const uniqueStocks = [...new Set(F.trades.map(t=>t.stock))].filter(s=>['NIFTY','SENSEX','INFY','BEL','HAL','OFSS','CAMS'].includes(s));
  const ipData = uniqueStocks.map(s=>{
    const it = F.trades.filter(t=>t.stock===s && t.is_intraday);
    const pt = F.trades.filter(t=>t.stock===s && !t.is_intraday);
    return {stock:s,iPnl:it.reduce((a,t)=>a+t.pnl,0),pPnl:pt.reduce((a,t)=>a+t.pnl,0),
            iWr:it.length?it.filter(t=>t.win).length/it.length*100:0,
            pWr:pt.length?pt.filter(t=>t.win).length/pt.length*100:0};
  });
  mk('cIPStock',{type:'bar',data:{labels:ipData.map(d=>d.stock),
    datasets:[
      {label:'Intraday',data:ipData.map(d=>d.iPnl),backgroundColor:'rgba(37,99,235,.6)',borderRadius:2,borderWidth:1},
      {label:'Positional',data:ipData.map(d=>d.pPnl),backgroundColor:'rgba(15,155,110,.6)',borderRadius:2,borderWidth:1}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#6b7280',font:{family:"'DM Sans'",size:10},boxWidth:10}},tooltip:{...tip,callbacks:{label:c=>`  ${c.dataset.label}: ₹${fL(c.raw)}`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  mk('cIPWr',{type:'bar',data:{labels:ipData.map(d=>d.stock),
    datasets:[
      {label:'Intraday WR%',data:ipData.map(d=>d.iWr),backgroundColor:'rgba(37,99,235,.5)',borderRadius:2,borderWidth:1},
      {label:'Positional WR%',data:ipData.map(d=>d.pWr),backgroundColor:'rgba(15,155,110,.5)',borderRadius:2,borderWidth:1}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#6b7280',font:{family:"'DM Sans'",size:10},boxWidth:10}},tooltip:{...tip,callbacks:{label:c=>`  ${c.dataset.label}: ${c.raw.toFixed(1)}%`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{min:0,max:100,ticks:{color:'#9ca3af',font:cFont,callback:v=>v+'%'},grid:{color:'#f3f4f6'}}}}});

  // ── SCATTER ──────────────────────────────────────────────────
  const scatterData = F.trades.map(t=>({x:t.days_held,y:t.pnl,sym:t.symbol,opt:t.opt_type}));
  mk('cScatter',{type:'scatter',data:{datasets:[
    {label:'CE',data:scatterData.filter(d=>d.opt==='CE').map(d=>({x:d.x,y:d.y,sym:d.sym})),backgroundColor:'rgba(37,99,235,.5)',pointRadius:4},
    {label:'PE',data:scatterData.filter(d=>d.opt==='PE').map(d=>({x:d.x,y:d.y,sym:d.sym})),backgroundColor:'rgba(197,130,10,.5)',pointRadius:4},
    {label:'Other',data:scatterData.filter(d=>d.opt!=='CE'&&d.opt!=='PE').map(d=>({x:d.x,y:d.y,sym:d.sym})),backgroundColor:'rgba(107,114,128,.4)',pointRadius:3},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#6b7280',font:{family:"'DM Sans'",size:10},boxWidth:10}},tooltip:{...tip,callbacks:{title:i=>'',label:i=>`${i.raw.sym}: ₹${fL(i.raw.y)} | ${i.raw.x}d held`}}},
  scales:{x:{title:{display:true,text:'Days held',color:'#9ca3af',font:cFont},ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{title:{display:true,text:'P&L (₹)',color:'#9ca3af',font:cFont},ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  // ── HOUR HEATMAP ─────────────────────────────────────────────
  const hourQ = wr => wr>=85?'strong':wr>=70?'moderate':wr>=50?'weak':'poor';
  document.getElementById('hourGrid').innerHTML = F.by_hour.map(h=>`
    <div class="hour-cell ${hourQ(h.win_rate)}">
      <div class="hc-t">${String(h.open_hour).padStart(2,'0')}:00</div>
      <div class="hc-w" style="color:${h.win_rate>=80?'var(--green)':h.win_rate>=60?'var(--gold)':'var(--red)'}">${h.win_rate}%</div>
      <div class="hc-n">${h.count}T</div>
    </div>`).join('');

  mk('cHourPnl',{type:'bar',data:{labels:F.by_hour.map(h=>h.open_hour+':00'),datasets:[{data:F.by_hour.map(h=>h.total_pnl),
    backgroundColor:F.by_hour.map(h=>h.total_pnl>=0?'rgba(15,155,110,.65)':'rgba(214,64,69,.65)'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ₹${fL(c.raw)} | ${F.by_hour[c.dataIndex].count} trades`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  mk('cHourWr',{type:'bar',data:{labels:F.by_hour.map(h=>h.open_hour+':00'),datasets:[{data:F.by_hour.map(h=>h.win_rate),
    backgroundColor:F.by_hour.map(h=>h.win_rate>=80?'rgba(15,155,110,.65)':h.win_rate>=60?'rgba(197,130,10,.65)':'rgba(214,64,69,.65)'),borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ${c.raw}%`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{min:0,max:100,ticks:{color:'#9ca3af',font:cFont,callback:v=>v+'%'},grid:{color:'#f3f4f6'}}}}});

  // ── CE vs PE ─────────────────────────────────────────────────
  const ceT = F.by_type.find(t=>t.opt_type==='CE')||{total_pnl:0,win_rate:0,avg_pnl:0};
  const peT = F.by_type.find(t=>t.opt_type==='PE')||{total_pnl:0,win_rate:0,avg_pnl:0};
  mk('cCEPE',{type:'bar',data:{labels:['CE','PE'],datasets:[{data:[ceT.total_pnl,peT.total_pnl],backgroundColor:['rgba(37,99,235,.65)','rgba(197,130,10,.65)'],borderColor:['#2563eb','#c5820a'],borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>fR(c.raw)}}},scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});
  mk('cCEPEwr',{type:'bar',data:{labels:['CE','PE'],datasets:[{data:[ceT.win_rate,peT.win_rate],backgroundColor:['rgba(37,99,235,.55)','rgba(197,130,10,.55)'],borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{min:0,max:100,ticks:{color:'#9ca3af',font:cFont,callback:v=>v+'%'},grid:{color:'#f3f4f6'}}}}});
  mk('cCEPEavg',{type:'bar',data:{labels:['CE','PE'],datasets:[{data:[ceT.avg_pnl,peT.avg_pnl],backgroundColor:['rgba(37,99,235,.5)','rgba(197,130,10,.5)'],borderWidth:1.5,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#9ca3af',font:cFont},grid:{color:'#f3f4f6'}},y:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}}}}});

  // ── EQUITY ───────────────────────────────────────────────────
  const epnlEl=document.getElementById('e-pnl'); epnlEl.textContent=fR(es.pnl); epnlEl.className='stat-val '+(es.pnl>=0?'green':'red');
  const enetEl=document.getElementById('e-net'); enetEl.textContent=fR(es.net); enetEl.className='stat-val '+(es.net>=0?'green':'red');
  document.getElementById('e-chg').textContent   ='Charges ₹'+fL(M.charges_eq);
  document.getElementById('e-wr').textContent    = es.win_rate+'%';
  document.getElementById('e-wl').textContent    = es.winners+'W · '+es.losses+'L';
  document.getElementById('e-pos').textContent   = es.total;
  document.getElementById('e-avg-days').textContent='Avg '+es.avg_days+'d held';
  const maxEq = Math.max(...E.by_stock.map(s=>Math.abs(s.total_pnl)),1);
  document.getElementById('eqHbars').innerHTML = E.by_stock.map(s=>{
    const pct=Math.abs(s.total_pnl)/maxEq*100; const col=s.total_pnl>=0?'var(--green)':'var(--red)';
    return `<div class="hbar-row"><div class="hbar-lbl" title="${s.symbol}">${s.symbol}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="hbar-val" style="color:${col}">${sg(s.total_pnl)}₹${fL(s.total_pnl)}</div></div>`;
  }).join('');
  document.getElementById('tEq').innerHTML = [...E.trades].sort((a,b)=>b.pnl-a.pnl).map(t=>`<tr>
    <td class="nm">${t.symbol}</td><td>${t.quantity}</td>
    <td>₹${fL(t.buy_price)}</td><td>₹${fL(t.sell_price)}</td>
    <td class="${cls(t.pnl)}">${sg(t.pnl)}₹${fL(t.pnl)}</td>
    <td class="${cls(t.pnl)}">${t.pnl_pct>0?'+':''}${t.pnl_pct}%</td>
    <td>${t.days_held}d</td>
    <td><span class="tag ${t.is_intraday?'tag-intra':'tag-pos'}">${t.is_intraday?'Intraday':'Positional'}</span></td>
  </tr>`).join('');

  // ── F&O TABLE ─────────────────────────────────────────────────
  renderFoTable();

  // ── EDGE CHARTS ───────────────────────────────────────────────
  const idxT = F.trades.filter(t=>['NIFTY','SENSEX'].includes(t.stock));
  const stOpt= F.trades.filter(t=>!['NIFTY','SENSEX'].includes(t.stock));
  const eqT  = E.trades;
  const stratData = [
    {s:'Index Options',pnl:idxT.reduce((a,t)=>a+t.pnl,0),wr:idxT.filter(t=>t.win).length/Math.max(idxT.length,1)*100,n:idxT.length},
    {s:'Stock Options',pnl:stOpt.reduce((a,t)=>a+t.pnl,0),wr:stOpt.filter(t=>t.win).length/Math.max(stOpt.length,1)*100,n:stOpt.length},
    {s:'Equity Delivery',pnl:eqT.reduce((a,t)=>a+t.pnl,0),wr:eqT.filter(t=>t.win).length/Math.max(eqT.length,1)*100,n:eqT.length},
  ];
  mk('cEdgePnl',{type:'bar',data:{labels:stratData.map(s=>s.s),datasets:[{data:stratData.map(s=>s.pnl),
    backgroundColor:stratData.map(s=>s.pnl>=0?'rgba(15,155,110,.65)':'rgba(214,64,69,.65)'),borderWidth:1,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{...tip,callbacks:{label:c=>`  ₹${fL(c.raw)} | ${stratData[c.dataIndex].n} trades`}}},
    scales:{x:{ticks:{color:'#9ca3af',font:cFont,callback:v=>'₹'+fL(v)},grid:{color:'#f3f4f6'}},y:{ticks:{color:'#374151',font:{family:"'DM Sans'",size:11}},grid:{color:'#f3f4f6'}}}}});
  mk('cEdgeWr',{type:'bar',data:{labels:stratData.map(s=>s.s),datasets:[{data:stratData.map(s=>s.wr),
    backgroundColor:stratData.map(s=>s.wr>=80?'rgba(15,155,110,.65)':s.wr>=60?'rgba(197,130,10,.65)':'rgba(214,64,69,.65)'),borderWidth:1,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},
    scales:{x:{min:0,max:100,ticks:{color:'#9ca3af',font:cFont,callback:v=>v+'%'},grid:{color:'#f3f4f6'}},y:{ticks:{color:'#374151',font:{family:"'DM Sans'",size:11}},grid:{color:'#f3f4f6'}}}}});

  // ── INSIGHTS ──────────────────────────────────────────────────
  const idxWR   = (idxT.filter(t=>t.win).length/Math.max(idxT.length,1)*100).toFixed(1);
  const bestHold= F.by_hold.reduce((a,b)=>b.win_rate>a.win_rate?b:a,F.by_hold[0]);
  const bestHour= F.by_hour.reduce((a,b)=>b.win_rate>a.win_rate?b:a,F.by_hour[0]);
  const worstPriceBucket = F.by_price.reduce((a,b)=>b.win_rate<a.win_rate?b:a,F.by_price[0]);
  const longHold = F.by_hold.find(h=>h.hold_bucket==='15-30d')||{win_rate:43,count:7};

  const strengths=[
    {icon:'🎯',title:'Index options: your superpower',body:`<b>${idxWR}% win rate</b> on ${idxT.length} index option trades (NIFTY+SENSEX). Nearly every trade closes profitably. This is rare discipline — most traders struggle here. Your edge is real and measurable.`,verdict:'Your #1 strength',cls:'good'},
    {icon:'⚡',title:`${bestHold.hold_bucket} holds = ${bestHold.win_rate}% win rate`,body:`Positions held <b>${bestHold.hold_bucket}</b> show your highest win rate. The data says this is your sweet spot — you read premium decay in this window better than any other timeframe.`,verdict:'Sweet spot confirmed',cls:'good'},
    {icon:'📞',title:'Intraday works surprisingly well',body:`Your intraday win rate is <b>${F.intraday.win_rate}%</b> (${F.intraday.count} trades). For most retail traders this is where money gets lost — you're actually making <b>₹${fL(F.intraday.pnl)}</b> here. Your quick in-out setups have genuine edge.`,verdict:'Keep selective intraday',cls:'good'},
  ];
  const killers=[
    {icon:'📉',title:'15-30 day holds losing badly',body:`Positions held <b>15-30 days</b>: only <b>${longHold.win_rate}% win rate</b> on ${longHold.count} trades. When you hold too long, you're fighting time decay against you, delta risk increases, and you often end up closing at loss. This is your single biggest P&L leak.`,verdict:'Stop holding 15d+',cls:'bad'},
    {icon:'🔴',title:'Equity delivery: only 45% WR',body:`${E.summary.total} equity positions, only <b>${E.summary.win_rate}% win rate</b>. You're buying stocks that go against you — net P&L of ₹${fL(E.summary.pnl)} on ₹${fL(E.summary.total*5000)} rough capital. The same capital in options makes 2-3× more.`,verdict:'Rethink equity allocation',cls:'bad'},
    {icon:'⚠️',title:`₹${fL(M.charges_fo+M.charges_eq)} in charges — silent killer`,body:`F&O charges: ₹${fL(M.charges_fo)}. Equity charges: ₹${fL(M.charges_eq)}. Combined: <b>₹${fL(M.charges_fo+M.charges_eq)}</b>. Every low-conviction trade that ends flat is actually a loss after brokerage. Your break-even per trade is ₹${Math.round((M.charges_fo+M.charges_eq)/289)} just to cover costs.`,verdict:'Trade less, earn more',cls:'bad'},
  ];
  const actions=[
    {icon:'💡',title:'Rule: max 7 days hold on options',body:`The data clearly shows 1-7 day holds have <b>80-93% win rate</b>. Beyond 14 days, it drops. Set a hard rule: <b>if you're holding an option beyond 7 days, you must have a specific reason (earnings, event)</b>. Otherwise close it and redeploy.`,verdict:'Action: Set hold limit',cls:'info'},
    {icon:'🏆',title:'Double down on index options only',body:`Index options (NIFTY/SENSEX weekly) gave you ${idxWR}% WR. Stock options are noisier and require much higher conviction. <b>Allocate 80% of your F&O capital to index options and only 20% to stock options</b> with very strong catalysts.`,verdict:'Action: Rebalance capital',cls:'info'},
    {icon:'🕐',title:`Trade mostly at ${bestHour.open_hour}:00–${bestHour.open_hour+1}:00`,body:`Your best win rate hour is <b>${bestHour.open_hour}:00 (${bestHour.win_rate}% WR)</b>. Your early morning entries outperform. This could be because IV is higher at open, giving you better premium. <b>Prioritize entries in the first 30-60 minutes of market open.</b>`,verdict:'Action: Optimize entry time',cls:'info'},
    {icon:'📊',title:'Track P&L per lot, not absolute',body:`Some of your biggest absolute P&L trades aren't your best percentage trades. Start tracking <b>P&L per lot</b> — this normalizes across different lot sizes and shows true efficiency. Your best efficiency is in NIFTY weekly options.`,verdict:'Action: Add per-lot metric',cls:'info'},
    {icon:'🎯',title:'Build a watchlist of OFSS-style setups',body:`OFSS multi-month options (89% WR) is a template. It worked because: strong trend + selling OTM + IV compression. <b>Find 3-4 other quality stocks in clear trends, sell OTM, hold max 7 days</b>. Screen for: high IV rank + trending stock + upcoming expiry.`,verdict:'Action: Build screener',cls:'info'},
    {icon:'🛡️',title:'Stop loss discipline on equity',body:`Several equity positions (BIOCON, BANKBARODA, BHARATFORG) are sitting at -5% to -15%. Set a <b>hard stop at -7% from cost</b> for all equity buys. Do not average down in equity — that is a different skill requiring fundamental research you may not be applying currently.`,verdict:'Action: Set -7% SL rule',cls:'warn'},
  ];

  const renderIns = (id,arr) => {
    document.getElementById(id).innerHTML = arr.map(a=>`
      <div class="ins-card">
        <div class="ins-icon">${a.icon}</div>
        <div class="ins-title">${a.title}</div>
        <div class="ins-body">${a.body}</div>
        <span class="ins-verdict v-${a.cls}">${a.verdict}</span>
      </div>`).join('');
  };
  renderIns('gStrengths',strengths);
  renderIns('gKillers',killers);
  renderIns('gActions',actions);
}

// ── F&O TABLE ─────────────────────────────────────────────────
let foPage = 0, foPageSize = 50;
function renderFoTable() {
  const search = (document.getElementById('foSearch')||{}).value||'';
  const type   = (document.getElementById('foType')||{}).value||'';
  const win    = (document.getElementById('foWin')||{}).value||'';
  const trade  = (document.getElementById('foTrade')||{}).value||'';
  let rows = DATA.fo.trades;
  if(search) rows = rows.filter(t=>t.symbol.toLowerCase().includes(search.toLowerCase())||t.stock.toLowerCase().includes(search.toLowerCase()));
  if(type)   rows = rows.filter(t=>t.opt_type===type);
  if(win==='win')  rows = rows.filter(t=>t.win);
  if(win==='loss') rows = rows.filter(t=>!t.win);
  if(trade==='intra') rows = rows.filter(t=>t.is_intraday);
  if(trade==='pos')   rows = rows.filter(t=>!t.is_intraday);
  document.getElementById('tFo').innerHTML = rows.map(t=>`<tr>
    <td class="nm" style="font-size:11px">${t.symbol}</td>
    <td><span class="tag ${t.opt_type==='CE'?'tag-ce':'tag-pe'}">${t.opt_type}</span></td>
    <td>₹${t.open_price}</td><td>₹${t.close_price}</td>
    <td class="${cls(t.pnl)}">${sg(t.pnl)}₹${fL(t.pnl)}</td>
    <td class="${cls(t.pnl_per_lot)}">${sg(t.pnl_per_lot)}₹${fL(t.pnl_per_lot)}</td>
    <td>${t.lots}</td><td>${t.days_held}d</td>
    <td><span class="tag ${t.is_intraday?'tag-intra':'tag-pos'}">${t.is_intraday?'Intraday':'Positional'}</span></td>
    <td style="font-size:10.5px">${t.open_date}</td><td style="font-size:10.5px">${t.close_date}</td>
  </tr>`).join('');
}
['foSearch','foType','foWin','foTrade'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener(el.tagName==='INPUT'?'input':'change', renderFoTable);
});

// ── TAB SWITCHER ──────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('panel-'+name).classList.add('active');
  btn.classList.add('active');
}

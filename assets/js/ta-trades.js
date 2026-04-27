/* ===== Trade Analytics — Trades panel ===== */
(() => {
  const { $, $$ } = window.TA;
  // tw is NEVER destructured — always window.TA.tw (needs mutation visibility)

  window.TA.tState = { q: '', type: '', win: '', kind: '', sort: { col: 'close', dir: -1 } };

  function tagFor(t) {
    return {
      CE: '<span class="tag tag-ce">CE</span>',
      PE: '<span class="tag tag-pe">PE</span>'
    }[t] || '';
  }

  function renderTrades() {
    const S = window.SEED; if (!S) return;
    const tState = window.TA.tState;
    let rows = (S.trades || []).filter(t => {
      if (tState.q && !(t.sym.toLowerCase().includes(tState.q) || (t.stk || '').toLowerCase().includes(tState.q))) return false;
      if (tState.type && t.type !== tState.type) return false;
      if (tState.win === 'win' && !t.win) return false;
      if (tState.win === 'loss' && t.win) return false;
      if (tState.kind && t.k !== tState.kind) return false;
      return true;
    });
    const c = tState.sort.col, d = tState.sort.dir;
    rows.sort((a, b) => { const av = a[c], bv = b[c]; return (av > bv ? 1 : av < bv ? -1 : 0) * d; });

    $('#tBody').innerHTML = rows.map(t => {
      const pnlCls = t.pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
      const pctCls = t.pct >= 0 ? 'pnl-pos' : 'pnl-neg';
      const lots = t.lots || '—';
      const pnlLot = (t.lots && t.lots > 0) ? Math.round(t.pnl / t.lots) : '—';
      const pnlLotFmt = typeof pnlLot === 'number' ? `<span class="${pnlCls}">${pnlLot >= 0 ? '+' : '−'}₹${Math.abs(pnlLot).toLocaleString('en-IN')}</span>` : '—';
      return `<tr>
        <td class="sym">${t.sym}</td>
        <td>${tagFor(t.type)}</td>
        <td class="num">${(+t.entry || 0).toFixed(2)}</td>
        <td class="num">${(+t.exit || 0).toFixed(2)}</td>
        <td class="num"><span class="${pnlCls}">${t.pnl >= 0 ? '+' : '−'}₹${Math.abs(t.pnl).toLocaleString('en-IN')}</span></td>
        <td class="num">${pnlLotFmt}</td>
        <td class="num">${lots}</td>
        <td class="num"><span class="${pctCls}">${t.pct >= 0 ? '+' : ''}${(+t.pct || 0).toFixed(1)}%</span></td>
        <td class="num">${t.d}</td>
        <td><span class="tag ${t.k === 'intra' ? 'tag-intra' : 'tag-pos'}">${t.k === 'intra' ? 'Intraday' : 'Positional'}</span></td>
        <td><span class="tag ${t.win ? 'tag-win' : 'tag-loss'}">${t.win ? 'Win' : 'Loss'}</span></td>
        <td class="num">${t.open_date || '—'}</td>
        <td class="num">${t.close}</td>
      </tr>`;
    }).join('');
    $('#tCount').textContent = `Showing ${rows.length} of ${(S.trades || []).length}`;
  }

  // Wire search input
  $('#tSearch').addEventListener('input', e => { window.TA.tState.q = e.target.value.trim().toLowerCase(); renderTrades(); });

  // Wire seg filter buttons
  $$('.trades-ctrl .seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      window.TA.tState[seg.dataset.filter] = b.dataset.val;
      renderTrades();
    });
  });

  // Wire sort-header click listeners
  $$('.tbl thead th').forEach((th, i) => {
    const cols = ['sym', 'type', 'entry', 'exit', 'pnl', 'pct', 'd', 'k', 'win', 'close'];
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = cols[i];
      window.TA.tState.sort.dir = (window.TA.tState.sort.col === col) ? -window.TA.tState.sort.dir : -1;
      window.TA.tState.sort.col = col;
      renderTrades();
    });
  });

  Object.assign(window.TA, { tagFor, renderTrades });
})();

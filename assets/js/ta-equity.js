/* ===== Trade Analytics — Equity panel ===== */
(() => {
  // tw is NEVER destructured — always window.TA.tw (needs mutation visibility)

  function renderEquity() {
    const E = window.SEED?.equity; if (!E) return;
    const fmt = n => (n >= 0 ? '+' : '−') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

    set('eqCount', `${E.total} positions`);
    set('eqGross', `${E.gross >= 0 ? '+' : '−'}${Math.abs(Math.round(E.gross)).toLocaleString('en-IN')}<span class="unit">₹</span>`);
    const netEl = document.getElementById('eqNet');
    if (netEl) {
      netEl.innerHTML = `${E.net >= 0 ? '+' : '−'}${Math.abs(Math.round(E.net)).toLocaleString('en-IN')}<span class="unit">₹</span>`;
      netEl.style.color = E.net >= 0 ? 'var(--pos)' : 'var(--neg)';
    }
    set('eqChg', `Charges ₹${Math.round(E.charges).toLocaleString('en-IN')}`);
    set('eqWr', `${E.wr}<span class="unit">%</span>`);
    const bar = document.getElementById('eqWrBar');
    if (bar) { bar.style.width = E.wr + '%'; bar.style.background = E.wr >= 60 ? 'var(--pos)' : 'var(--neg)'; }
    set('eqWrSub', `${E.wins} wins · ${E.losses} losses`);
    set('eqHold', `${E.avgHold}<span class="unit">d</span>`);

    // Verdict grade
    const verdictEl = document.getElementById('eqVerdict');
    const verdictSub = document.getElementById('eqVerdictSub');
    if (verdictEl) {
      const grade = E.charges >= E.gross ? 'D' : E.wr >= 65 ? 'B+' : E.wr >= 55 ? 'B−' : E.wr >= 45 ? 'C' : 'C−';
      verdictEl.textContent = grade;
    }
    if (verdictSub) {
      verdictSub.textContent = E.charges >= E.gross ? 'Charges exceed gross gains' : E.wr >= 60 ? 'Win rate is solid' : 'Win rate needs work';
    }

    // Charges warning
    const warn = document.getElementById('eqChargesWarn');
    if (warn) warn.hidden = !(E.charges > E.gross);

    // Dynamic Observations
    const obsList = document.getElementById('eqObservations');
    if (obsList) {
      const foWr = window.SEED?.extras?.winRate || 0;
      const sortedStocks = [...(E.stocks || [])].sort((a, b) => b.pnl - a.pnl);
      const winners = sortedStocks.filter(s => s.pnl > 0);
      const losers = sortedStocks.filter(s => s.pnl < 0);
      const obs = [];

      if (E.gross > 0) {
        const chargePct = E.charges / E.gross * 100;
        if (E.charges >= E.gross) {
          obs.push({ cls: 'neg', title: 'Charges wiped out your entire gain.',
            body: `Gross gain ₹${Math.round(E.gross).toLocaleString('en-IN')} but charges ₹${Math.round(E.charges).toLocaleString('en-IN')} turned net P&L negative. Each trade needs to earn more just to break even.` });
        } else if (chargePct > 35) {
          const topNames = winners.slice(0, 2).map(s => s.sym).join(' and ') || 'Your winners';
          obs.push({ cls: 'neg', title: 'Winners barely clear costs.',
            body: `${topNames} lead gross gains of ₹${Math.round(E.gross).toLocaleString('en-IN')} — but charges ate ₹${Math.round(E.charges).toLocaleString('en-IN')} (${chargePct.toFixed(0)}% of gross). Trading less frequently would improve net significantly.` });
        } else {
          const topNames = winners.slice(0, 2).map(s => s.sym).join(' and ') || 'Top stocks';
          obs.push({ cls: 'pos', title: 'Gross gains are healthy.',
            body: `${topNames} drove gross gains of ₹${Math.round(E.gross).toLocaleString('en-IN')} with charges at only ${chargePct.toFixed(0)}% of gross — a manageable cost ratio.` });
        }
      } else if (E.total > 0) {
        obs.push({ cls: 'neg', title: 'Equity book is gross-negative.',
          body: `Gross P&L is ₹${Math.round(E.gross).toLocaleString('en-IN')} before charges of ₹${Math.round(E.charges).toLocaleString('en-IN')}. The positions themselves are losing — review stock selection.` });
      }

      if (E.total > 0) {
        if (E.avgHold > 20 && E.wr < 55) {
          obs.push({ cls: 'neg', title: 'Long holds, thin edge.',
            body: `Average hold is ${E.avgHold} days but win rate is only ${E.wr}%.${foWr ? ` Compare to F&O's ${foWr}% — this book isn't pulling its weight.` : ' Consider tighter exit rules.'}` });
        } else if (E.wr >= 60) {
          obs.push({ cls: 'pos', title: `${E.wr}% win rate is solid for equity.`,
            body: `${E.total} positions with ${E.avgHold} day average hold.${foWr ? (E.wr >= foWr ? ` Even beating F&O's ${foWr}% win rate.` : ` F&O higher at ${foWr}%, but equity is holding its own.`) : ''}` });
        } else {
          obs.push({ cls: 'neg', title: `${E.wr}% win rate needs improvement.`,
            body: `${E.total} positions, ${E.avgHold} day average hold, only ${E.wr}% win rate.${foWr ? ` F&O delivers ${foWr}% WR — the same capital works harder there.` : ' Tighten entry criteria or reduce position count.'}` });
        }
      }

      if (losers.length > 0) {
        const worstNames = losers.slice(-2).map(s => s.sym).join(' and ');
        obs.push({ cls: 'pos', title: 'Consider F&O on the same themes.',
          body: `${worstNames} dragged equity. Similar sector plays via F&O tend to offer shorter holds, defined risk, and${foWr ? ` your existing ${foWr}%` : ' higher'} win rates vs equity's ${E.wr}%.` });
      } else if (winners.length > 0) {
        obs.push({ cls: 'pos', title: 'All equity names closed profitable.',
          body: `Every position in the book closed green — rare discipline. Keep position sizes measured and watch charges as you scale up.` });
      }

      if (obs.length === 0) {
        obs.push({ cls: 'neg', title: 'Upload equity data to see observations.',
          body: 'No equity positions found. Upload your Equity P&amp;L CSV to generate insights.' });
      }

      obsList.innerHTML = obs.map(o =>
        `<li class="ins ${o.cls}"><div class="ins-rail"></div><div class="ins-copy"><b>${o.title}</b><span>${o.body}</span></div></li>`
      ).join('');
    }

    const maxAbs = Math.max(...E.stocks.map(s => Math.abs(s.pnl))) || 1;
    document.getElementById('eqStocks').innerHTML = E.stocks
      .slice().sort((a, b) => b.pnl - a.pnl)
      .map(s => {
        const pct = (Math.abs(s.pnl) / maxAbs) * 100;
        return `<div class="bkt">
          <div class="bkt-lbl">${s.sym}<small>${s.n} trade${s.n !== 1 ? 's' : ''} · ${s.wr}% WR</small></div>
          <div class="bkt-track"><div class="bkt-fill ${s.pnl < 0 ? 'neg' : ''}" style="width:${pct}%"></div></div>
          <div class="bkt-val ${s.pnl >= 0 ? 'pos' : 'neg'}">${fmt(s.pnl)}</div>
        </div>`;
      }).join('');

    // Equity trades table
    const eqTrades = E.trades || [];
    const eqTBody = document.getElementById('eqTBody');
    const eqTCount = document.getElementById('eqTCount');
    if (eqTBody) {
      if (eqTrades.length) {
        const sorted = [...eqTrades].sort((a, b) => (b.close || '').localeCompare(a.close || ''));
        eqTBody.innerHTML = sorted.map(t => {
          const pnlCls = t.pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
          const pctCls = (t.pct || 0) >= 0 ? 'pnl-pos' : 'pnl-neg';
          return `<tr>
            <td class="sym">${t.sym}</td>
            <td class="num">${t.qty || '—'}</td>
            <td class="num">${(+t.entry || 0).toFixed(2)}</td>
            <td class="num">${(+t.exit || 0).toFixed(2)}</td>
            <td class="num"><span class="${pnlCls}">${t.pnl >= 0 ? '+' : '−'}₹${Math.abs(Math.round(t.pnl)).toLocaleString('en-IN')}</span></td>
            <td class="num"><span class="${pctCls}">${(t.pct || 0) >= 0 ? '+' : ''}${(+t.pct || 0).toFixed(1)}%</span></td>
            <td class="num">${t.d}</td>
            <td><span class="tag ${t.win ? 'tag-win' : 'tag-loss'}">${t.win ? 'Win' : 'Loss'}</span></td>
            <td class="num">${t.close || '—'}</td>
          </tr>`;
        }).join('');
        if (eqTCount) eqTCount.textContent = `${eqTrades.length} equity position${eqTrades.length !== 1 ? 's' : ''}`;
      } else {
        eqTBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">Upload Equity CSVs to see trade log</td></tr>`;
        if (eqTCount) eqTCount.textContent = 'No trade data — upload Equity CSVs';
      }
    }
  }

  Object.assign(window.TA, { renderEquity });
})();

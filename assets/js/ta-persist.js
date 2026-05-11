/* ===== Persistence: save/restore SEED via Upstash Redis (/api/seed) ===== */
/* Only active when served over HTTP/HTTPS — silently skipped when opened as a local file. */
(() => {
  const IS_SERVED = location.protocol !== 'file:';

  // Brief status message in the chrome clock area, self-clearing after 2.5 s
  function flash(msg, isError) {
    const el = document.getElementById('istClock');
    if (!el) return;
    const prev = el.textContent;
    el.style.transition = 'color 0.2s';
    el.style.color = isError ? 'var(--neg)' : 'var(--pos)';
    el.textContent = msg;
    setTimeout(() => {
      el.style.color = '';
      // Clock will self-correct on next second tick
    }, 2500);
  }

  // Strip large derived fields before saving — niftyDaily can be multi-MB
  // (user can re-upload the OHLC JSON to restore market-context features)
  function stripForStorage(seed) {
    const s = { ...seed };
    delete s.niftyDaily;
    delete s.enrichedTrades;
    return s;
  }

  window.TA.saveSeed = async function () {
    if (!window.SEED || !IS_SERVED) return;
    try {
      const r = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stripForStorage(window.SEED))
      });
      if (r.ok) flash('✓ Saved to cloud');
      else flash('⚠ Cloud save failed', true);
    } catch (e) {
      console.warn('[persist] save failed', e);
    }
  };

  window.TA.loadSeed = async function () {
    if (!IS_SERVED) return;
    try {
      const r = await fetch('/api/seed');
      if (r.status === 204) return;   // nothing stored yet
      if (!r.ok) return;
      const seed = await r.json();
      if (!seed || !seed.hero) return; // invalid/empty payload
      window.SEED = seed;
      if (window.DASHBOARD_REDRAW) window.DASHBOARD_REDRAW();
      flash('✓ Data restored from cloud');
    } catch (e) {
      console.warn('[persist] load failed', e);
    }
  };

  window.TA.clearSeed = async function () {
    if (!IS_SERVED) return;
    try {
      await fetch('/api/seed', { method: 'DELETE' });
      window.SEED = null;
      flash('✓ Cloud data cleared');
    } catch (e) {
      console.warn('[persist] clear failed', e);
    }
  };

  // Auto-restore on page load
  window.TA.loadSeed();
})();

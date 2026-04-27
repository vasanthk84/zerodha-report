/* ===== Trade Analytics — shared namespace ===== */
window.TA = {
  charts: {},
  tw: { ...(window.TWEAK_DEFAULTS || {}) },
  $:  (q, el) => (el || document).querySelector(q),
  $$: (q, el) => [...(el || document).querySelectorAll(q)],
  fontCol: () => getComputedStyle(document.body).getPropertyValue('--muted').trim(),
  gridCol: () => getComputedStyle(document.body).getPropertyValue('--border').trim(),
  posCol:  () => getComputedStyle(document.body).getPropertyValue('--pos').trim(),
  negCol:  () => getComputedStyle(document.body).getPropertyValue('--neg').trim(),
  accCol:  () => getComputedStyle(document.body).getPropertyValue('--accent').trim(),
  goldCol: () => getComputedStyle(document.body).getPropertyValue('--gold').trim(),
  tipCommon: {
    backgroundColor: 'rgba(26,24,21,.94)',
    titleColor: '#f5f1ea', bodyColor: '#f5f1ea',
    borderColor: 'rgba(255,255,255,.08)', borderWidth: 1,
    padding: 10, cornerRadius: 6,
    titleFont: { family: 'Inter Tight', size: 11, weight: 600 },
    bodyFont:  { family: 'JetBrains Mono', size: 11 }
  }
};

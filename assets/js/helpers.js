// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const fL = n => { const a=Math.abs(n); if(a>=1e7) return (n/1e7).toFixed(2)+'Cr'; if(a>=1e5) return (n/1e5).toFixed(1)+'L'; if(a>=1000) return (n/1e3).toFixed(1)+'K'; return n.toFixed(0); };
const fR = n => '₹'+fL(n);
const sg = n => n>=0?'+':'';
const pc = (w,t) => t>0 ? (w/t*100).toFixed(1)+'%' : '0%';
const cls = n => n>=0?'pp':'pn';
const cFont = {family:"'DM Mono',monospace",size:9};
const tip = {backgroundColor:'#fff',borderColor:'#e2e6ed',borderWidth:1,titleColor:'#111827',bodyColor:'#374151',padding:10};
let charts = {};
function mk(id,cfg){ if(charts[id]) charts[id].destroy(); charts[id]=new Chart(document.getElementById(id),cfg); return charts[id]; }

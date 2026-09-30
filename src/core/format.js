// Formateador único de números (sección 5, «Notación de números grandes»).
// Hasta 999.999 se muestran completos con punto de miles; a partir de ahí,
// sufijos M, B, T y después aa, ab, ac… con un máximo de 4 cifras significativas.

const NAMED_SUFFIXES = ['', 'K', 'M', 'B', 'T'];

// Sufijo para el grupo de miles `tier` (tier 1 = K, 2 = M, 5 = aa, 6 = ab…).
export function suffixFor(tier) {
  if (tier < NAMED_SUFFIXES.length) return NAMED_SUFFIXES[tier];
  const i = tier - NAMED_SUFFIXES.length;
  const a = 'a'.charCodeAt(0);
  return String.fromCharCode(a + Math.floor(i / 26)) + String.fromCharCode(a + (i % 26));
}

function groupThousands(intString) {
  return intString.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Trunca (no redondea) para no mostrar nunca más de lo que hay.
function truncate(value, decimals) {
  const f = Math.pow(10, decimals);
  return Math.floor(value * f + 1e-9) / f;
}

function withComma(value, decimals) {
  return value.toFixed(decimals).replace(/\.?0+$/, '').replace('.', ',');
}

export function formatNumber(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + formatNumber(-n);
  if (n < 1e6) return groupThousands(String(Math.floor(n + 1e-9)));
  const tier = Math.floor(Math.log10(n) / 3);
  let value = n / Math.pow(1000, tier);
  // value está en [1, 1000): 4 cifras significativas.
  const decimals = value >= 100 ? 1 : value >= 10 ? 2 : 3;
  value = truncate(value, decimals);
  return withComma(value, decimals) + suffixFor(tier);
}

export function formatMoney(n) {
  return '$' + formatNumber(n);
}

// Los costes se redondean hacia arriba: si ves «$18» con $18 puedes comprarlo.
export function formatCost(n) {
  if (!Number.isFinite(n)) return '—';
  return n < 1e6 ? formatMoney(Math.ceil(n - 1e-9)) : formatMoney(n);
}

// Ritmos (unidades o monedas por segundo): permiten decimales cuando son pequeños.
export function formatRate(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 100 && n !== Math.floor(n)) return withComma(truncate(n, 1), 1) || '0';
  return formatNumber(n);
}

// Duraciones: «12 s», «4 min 12 s», «6 h 12 min», «2 d 3 h».
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '∞';
  const s = Math.max(0, Math.ceil(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return sec > 0 ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

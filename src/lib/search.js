// Ranks items for "type a few letters" search. Works with English and Sinhala.
// "ma" → Madol Doova, Maths… (titles starting with the letters come first, then any word
// starting with them, then titles containing them, then author / publisher / subject / ISBN).
const bare = (s) => String(s || '').replace(/[\s-]/g, '').toLowerCase();

export function scoreProduct(p, query, variants = []) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return 0;
  const qb = bare(q);
  const en = (p.nameEn || '').toLowerCase();
  const si = (p.nameSi || '').toLowerCase();
  if (variants.some((v) => v.barcode === q || v.barcode === qb || (v.sku || '').toLowerCase() === q)) return 1000;
  if (en.startsWith(q)) return 500 - Math.min(en.length, 100) / 1000;
  if (si.startsWith(q)) return 480;
  const words = en.split(/[\s,()/-]+/);
  if (words.some((w) => w.startsWith(q))) return 400;
  if (si.split(/\s+/).some((w) => w.startsWith(q))) return 380;
  // every typed word must match the start of some word: "gra 5 sch" → "Grade 5 scholarship papers"
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => words.some((w) => w.startsWith(part)))) return 350;
  if (en.includes(q)) return 300;
  if (si.includes(q)) return 280;
  const author = (p.author || '').toLowerCase();
  if (author && (author.startsWith(q) || author.split(/[\s.]+/).some((w) => w.startsWith(q)))) return 260;
  if (author.includes(q)) return 240;
  if ([p.brand, p.subject, p.grade, p.language, p.edition].some((x) => (x || '').toLowerCase().includes(q))) return 150;
  if (qb.length >= 4 && variants.some((v) => (v.barcode || '').includes(qb))) return 100;
  return 0;
}

export function searchProducts(products, query, vBy = {}, limit = Infinity) {
  const out = [];
  for (const p of products) {
    const s = scoreProduct(p, query, vBy[p.id] || []);
    if (s > 0) out.push([s, p]);
  }
  out.sort((a, b) => b[0] - a[0] || a[1].nameEn.localeCompare(b[1].nameEn));
  return out.slice(0, limit).map((x) => x[1]);
}

// Types in the order people expect: 40, 80, 120 pages… then A3, A4, A5, then names.
export function sortSizes(list) {
  const key = (s) => {
    const u = String(s).trim().toUpperCase();
    const n = parseFloat(u);
    if (!Number.isNaN(n)) return [0, n, u];
    const a = u.match(/^([AB])(\d)\b/);
    if (a) return [1, (a[1] === 'B' ? 10 : 0) + Number(a[2]), u];
    return [2, 0, u];
  };
  return [...new Set(list.filter(Boolean))].sort((a, b) => {
    const ka = key(a); const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  });
}

// "Martin Wickramasinghe · Grade 8 · Sinhala" — the small line under a title.
export const bookLine = (p) => [p.author, p.grade, p.language].filter(Boolean).join(' · ');

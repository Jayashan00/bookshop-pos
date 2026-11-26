import { db } from '../db/db';
import { useCart } from '../store/cart';
import { round2, sum } from './util';

// A school book list holds items and quantities. These helpers price a list from the
// current shelf prices and put the whole list on the bill in one go.
export async function listLines(list) {
  const out = [];
  for (const it of list.items || []) {
    const v = await db.variants.get(it.variantId);
    const p = v ? await db.products.get(v.productId) : null;
    out.push({ ...it, v, p, missing: !v || !p || p.active === false });
  }
  return out;
}

export const listTotal = (lines) => round2(sum(lines.filter((l) => !l.missing), (l) => l.qty * l.v.price));

// sets = how many children the list is bought for (2 sets = every quantity doubled)
export async function addListToCart(list, sets = 1) {
  const lines = await listLines(list);
  let added = 0; const short = []; let missing = 0;
  for (const l of lines) {
    if (l.missing) { missing += 1; continue; }
    const qty = round2(l.qty * sets);
    if (!l.p.service && (Number(l.v.stock) || 0) < qty) short.push(l.p.nameEn + ([l.v.size, l.v.color].filter(Boolean).length ? ` (${[l.v.size, l.v.color].filter(Boolean).join(', ')})` : ''));
    useCart.getState().addVariant(l.v, l.p, qty);
    added += 1;
  }
  return { added, short, missing };
}

// The same numbers a bill would show, for printing a list as a quotation.
export function quoteFromLines(lines, sets = 1) {
  const rows = lines.filter((l) => !l.missing).map((l) => {
    const qty = round2(l.qty * sets); const gross = round2(qty * l.v.price);
    return { nameEn: l.p.nameEn, nameSi: l.p.nameSi, author: l.p.author, size: l.v.size, color: l.v.color, unit: l.p.unit, qty, price: l.v.price, gross, lineDisc: 0, net: gross };
  });
  const subtotal = round2(sum(rows, (r) => r.gross));
  return { lines: rows, subtotal, discount: 0, tax: 0, total: subtotal };
}

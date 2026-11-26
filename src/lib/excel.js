import { db } from '../db/db';
import { getSettings } from '../store/settings';
import { round2, sum, dayKey, pad } from './util';

// Builds a real Excel workbook (.xlsx) of the shop's data for a period.
// Sheets: Summary, Bills, Bill items, Payments, Returns, Stock now, Stock movements,
// Deliveries, Expenses, Customers, Suppliers, Vouchers, Customer orders, Supplier returns, Book lists.

const day = (t) => (t ? dayKey(t) : '');
const time = (t) => (t ? `${pad(new Date(t).getHours(), 2)}:${pad(new Date(t).getMinutes(), 2)}` : '');

function sheet(XLSX, rows, widths, moneyCols = []) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'No records in this period' }]);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  if (rows.length && moneyCols.length) {
    const keys = Object.keys(rows[0]);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (const name of moneyCols) {
      const c = keys.indexOf(name); if (c < 0) continue;
      for (let r = 1; r <= range.e.r; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') cell.z = '#,##0.00'; }
    }
  }
  if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
}

export async function buildWorkbook(from, to, label) {
  const XLSX = await import('xlsx');
  const s = getSettings();
  const inRange = (t) => t >= from && t <= to;
  const [sales, returns, moves, purchases, expenses, products, variants, categories, customers, suppliers, vouchers, users, orders, supRets, booklists] = await Promise.all([
    db.sales.where('date').between(from, to, true, true).toArray(),
    db.returns.where('date').between(from, to, true, true).toArray(),
    db.stockMoves.where('date').between(from, to, true, true).toArray(),
    db.purchases.where('date').between(from, to, true, true).toArray(),
    db.expenses.where('date').between(from, to, true, true).toArray(),
    db.products.toArray(), db.variants.toArray(), db.categories.toArray(),
    db.customers.toArray(), db.suppliers.toArray(), db.vouchers.toArray(), db.users.toArray(),
    db.orders.where('date').between(from, to, true, true).toArray(),
    db.supplierReturns.where('date').between(from, to, true, true).toArray(),
    db.booklists.toArray(),
  ]);
  const P = Object.fromEntries(products.map((x) => [x.id, x]));
  const V = Object.fromEntries(variants.map((x) => [x.id, x]));
  const C = Object.fromEntries(categories.map((x) => [x.id, x]));
  const S = Object.fromEntries(suppliers.map((x) => [x.id, x]));
  const U = Object.fromEntries(users.map((x) => [x.id, x.name]));
  const valid = sales.filter((x) => x.status !== 'void').sort((a, b) => a.date - b.date);
  const methods = ['cash', 'card', 'qr', 'bank', 'credit', 'voucher', 'points'];
  const mName = { cash: 'Cash', card: 'Card', qr: 'LankaQR', bank: 'Bank', credit: 'Credit', voucher: 'Voucher', points: 'Points' };

  const netSales = round2(sum(valid, (x) => x.total) - sum(returns, (r) => r.amount));
  const cogs = round2(sum(valid, (x) => sum(x.items, (i) => i.cost * (i.qty - (i.returnedQty || 0)))));
  const exp = round2(sum(expenses, (e) => e.amount));
  const summary = [
    { Item: 'Shop', Value: s.shop.nameEn }, { Item: 'Period', Value: label },
    { Item: 'From', Value: day(from) }, { Item: 'To', Value: day(to) }, { Item: 'Created', Value: `${day(Date.now())} ${time(Date.now())}` },
    { Item: 'Bills', Value: valid.length }, { Item: 'Cancelled bills', Value: sales.length - valid.length },
    { Item: 'Sales before discount', Value: round2(sum(valid, (x) => x.subtotal)) },
    { Item: 'Discounts', Value: round2(sum(valid, (x) => x.itemDiscount + x.billDiscount)) },
    { Item: 'Sales', Value: round2(sum(valid, (x) => x.total)) },
    { Item: 'Refunds', Value: round2(sum(returns, (r) => r.amount)) },
    { Item: 'Net sales', Value: netSales },
    { Item: 'Cost of items sold', Value: cogs }, { Item: 'Gross profit', Value: round2(netSales - cogs) },
    { Item: 'Expenses', Value: exp }, { Item: 'Profit after expenses', Value: round2(netSales - cogs - exp) },
    // cash received minus change given = cash kept
    ...methods.map((m) => ({ Item: `Paid by ${mName[m]}`, Value: round2(sum(valid, (x) => sum(x.payments.filter((p) => p.method === m), (p) => p.amount)) - (m === 'cash' ? sum(valid, (x) => x.change) : 0)) })),
    { Item: 'Stock value now (cost)', Value: round2(sum(variants, (v) => Math.max(0, v.stock) * v.cost)) },
    { Item: 'Stock value now (selling)', Value: round2(sum(variants, (v) => Math.max(0, v.stock) * v.price)) },
    { Item: 'Customer orders taken', Value: orders.length }, { Item: 'Order advances taken', Value: round2(sum(orders, (o) => o.advance)) },
    { Item: 'Returned to suppliers (cost)', Value: round2(sum(supRets, (r) => r.total)) },
    { Item: 'Items in stock now', Value: round2(sum(variants, (v) => Math.max(0, v.stock))) },
  ];

  const bills = sales.sort((a, b) => a.date - b.date).map((x) => {
    const row = { 'Bill no': x.billNo, Date: day(x.date), Time: time(x.date), Counter: x.terminal || '', Cashier: x.cashierName, Customer: x.customerName || '', Phone: x.customerPhone || '',
      Items: x.items.length, Subtotal: x.subtotal, Discount: round2(x.itemDiscount + x.billDiscount), Tax: x.tax, Total: x.total };
    methods.forEach((m) => { row[mName[m]] = round2(sum(x.payments.filter((p) => p.method === m), (p) => p.amount)); });
    row.Change = x.change; row.Status = x.status; row.Returned = x.returnedAmount || 0; row['Points earned'] = x.pointsEarned || 0;
    return row;
  });
  const items = [];
  sales.forEach((x) => x.items.forEach((i) => items.push({
    'Bill no': x.billNo, Date: day(x.date), Time: time(x.date), Status: x.status,
    'Title / item (English)': i.nameEn, 'Title / item (Sinhala)': i.nameSi || '', Category: C[i.categoryId]?.nameEn || '', Author: i.author || P[i.productId]?.author || '', 'Publisher / brand': P[i.productId]?.brand || '', Type: i.size, 'Colour / ruling': i.color, 'Barcode / ISBN': i.barcode,
    Qty: i.qty, Unit: i.unit, Price: i.price, Discount: i.discount, Net: i.net, 'Cost each': i.cost, Profit: round2(i.net - i.cost * i.qty), 'Returned qty': i.returnedQty || 0,
  })));
  const payments = [];
  sales.forEach((x) => x.payments.forEach((p) => payments.push({ 'Bill no': x.billNo, Date: day(x.date), Time: time(x.date), Method: mName[p.method] || p.method, Amount: p.amount, Reference: p.ref || '' })));
  const rets = returns.map((r) => ({ 'Return no': r.returnNo, 'Bill no': r.billNo, Date: day(r.date), Time: time(r.date), By: r.userName, Reason: r.reason, 'Refund as': r.refundMethod, 'Credit note': r.voucherCode || '', Amount: r.amount, Items: r.items.map((i) => `${i.nameEn} ${[i.size, i.color].filter(Boolean).join('/')} ×${i.qty}`).join('; ') }));
  const stock = variants.filter((v) => !(P[v.productId] || {}).service).map((v) => { const p = P[v.productId] || {}; return {
    'Title / item (English)': p.nameEn || '', 'Title / item (Sinhala)': p.nameSi || '', Category: C[p.categoryId]?.nameEn || '', Author: p.author || '', 'Publisher / brand': p.brand || '', Language: p.language || '', Grade: p.grade || '', Subject: p.subject || '', Type: v.size, 'Colour / ruling': v.color, 'Barcode / ISBN': v.barcode,
    Unit: p.unit || 'pcs', Stock: v.stock, 'Reorder at': v.reorderLevel, 'Cost price': v.cost, 'Selling price': v.price, MRP: v.mrp || 0,
    'Value (cost)': round2(Math.max(0, v.stock) * v.cost), 'Value (selling)': round2(Math.max(0, v.stock) * v.price), Active: p.active === false ? 'No' : 'Yes',
  }; }).sort((a, b) => (a.Category + a['Title / item (English)'] + a.Type).localeCompare(b.Category + b['Title / item (English)'] + b.Type));
  const mv = moves.sort((a, b) => a.date - b.date).map((m) => { const v = V[m.variantId] || {}; const p = P[v.productId] || {}; return {
    Date: day(m.date), Time: time(m.date), Type: m.type, 'Title / item (English)': p.nameEn || '', 'Item type': v.size || '', 'Colour / ruling': v.color || '', 'Barcode / ISBN': v.barcode || '', Qty: m.qty, Reference: m.ref || '', By: U[m.userId] || '' }; });
  const grn = [];
  purchases.forEach((pu) => pu.items.forEach((it) => { const v = V[it.variantId] || {}; const p = P[v.productId] || {}; grn.push({
    GRN: pu.grnNo, Date: day(pu.date), Supplier: S[pu.supplierId]?.name || '', Invoice: pu.invoiceNo || '', 'Title / item (English)': p.nameEn || '', Type: v.size || '', 'Colour / ruling': v.color || '',
    Qty: Number(it.qty), 'Cost each': Number(it.cost), 'Line total': round2(Number(it.qty) * Number(it.cost)), 'GRN total': pu.total, 'Paid now': pu.paid }); }));
  const ex = expenses.sort((a, b) => a.date - b.date).map((e) => ({ Date: day(e.date), Type: e.category, Amount: e.amount, 'Paid by': e.paidBy, 'From drawer': e.fromDrawer ? 'Yes' : 'No', Note: e.note || '' }));
  const cust = customers.map((c) => ({ Name: c.name, Phone: c.phone, Type: c.type || 'person', 'Discount %': c.discountPct || 0, Email: c.email || '', Address: c.address || '', NIC: c.nic || '', Birthday: c.birthday || '', Points: c.points || 0, 'Owes (credit)': c.creditBalance || 0, 'Total spent': c.totalSpent || 0, Visits: c.visits || 0, 'Last visit': day(c.lastVisit) }));
  const sup = suppliers.map((x) => ({ Name: x.name, Contact: x.contact || '', Phone: x.phone, Address: x.address || '', 'We owe': x.balance || 0 }));
  const vou = vouchers.map((v) => ({ Code: v.code, Kind: v.type === 'creditNote' ? 'Credit note' : v.type === 'advance' ? 'Order advance' : 'Gift voucher', Amount: v.amount, Balance: v.balance, Status: v.status, Issued: day(v.issuedAt), 'Valid until': day(v.expiresAt), Reference: v.ref || '' }));

  const ord = [];
  orders.sort((a, b) => a.date - b.date).forEach((o) => o.items.forEach((it) => ord.push({ 'Order no': o.orderNo, Date: day(o.date), Customer: o.customerName, Phone: o.phone || '', Title: it.title, 'Author / publisher': it.author || '', Qty: Number(it.qty) || 0, 'Price each': Number(it.price) || 0, Advance: o.advance || 0, 'Advance slip': o.voucherCode || '', Status: o.status, Note: o.note || '' })));
  const sret = [];
  supRets.sort((a, b) => a.date - b.date).forEach((r) => r.items.forEach((it) => { const v = V[it.variantId] || {}; const p = P[v.productId] || {}; sret.push({ 'Return no': r.returnNo, Date: day(r.date), Supplier: S[r.supplierId]?.name || '', 'Title / item (English)': p.nameEn || '', Type: v.size || '', 'Barcode / ISBN': v.barcode || '', Qty: Number(it.qty), 'Cost each': Number(it.cost), 'Line total': round2(Number(it.qty) * Number(it.cost)), Note: r.note || '' }); }));
  const bl = [];
  booklists.forEach((l) => (l.items || []).forEach((it) => { const v = V[it.variantId] || {}; const p = P[v.productId] || {}; bl.push({ List: l.name, School: l.school || '', Grade: l.grade || '', Year: l.year || '', 'Title / item (English)': p.nameEn || '(removed)', Type: [v.size, v.color].filter(Boolean).join(' / '), Qty: Number(it.qty), 'Price each': v.price || 0, Amount: round2(Number(it.qty) * (v.price || 0)) }); }));

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: `${s.shop.nameEn} – ${label}`, Author: 'Nodemor POS', CreatedDate: new Date() };
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, summary, [30, 34], ['Value']), 'Summary');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, bills, [12, 11, 7, 8, 18, 18, 12, 6, 11, 10, 9, 11, 10, 10, 10, 10, 10, 10, 10, 9, 10, 9, 8], ['Subtotal', 'Discount', 'Tax', 'Total', 'Cash', 'Card', 'LankaQR', 'Bank', 'Credit', 'Voucher', 'Points', 'Change', 'Returned']), 'Bills');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, items, [12, 11, 7, 10, 30, 26, 18, 20, 18, 12, 12, 15, 6, 5, 10, 9, 11, 10, 10, 8], ['Price', 'Discount', 'Net', 'Cost each', 'Profit']), 'Bill items');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, payments, [12, 11, 7, 10, 12, 16], ['Amount']), 'Payments');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, rets, [12, 12, 11, 7, 16, 12, 12, 12, 10, 50], ['Amount']), 'Returns');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, stock, [30, 26, 18, 20, 18, 10, 10, 13, 12, 12, 15, 6, 8, 9, 10, 11, 9, 13, 14, 7], ['Cost price', 'Selling price', 'MRP', 'Value (cost)', 'Value (selling)']), 'Stock now');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, mv, [11, 7, 14, 30, 12, 12, 15, 7, 16, 16]), 'Stock movements');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, grn, [11, 11, 24, 12, 30, 12, 12, 7, 10, 11, 11, 10], ['Cost each', 'Line total', 'GRN total', 'Paid now']), 'Deliveries');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, ex, [11, 14, 11, 9, 11, 30], ['Amount']), 'Expenses');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, cust, [26, 12, 11, 10, 20, 20, 13, 11, 7, 11, 12, 7, 11], ['Owes (credit)', 'Total spent']), 'Customers');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, sup, [26, 18, 12, 22, 12], ['We owe']), 'Suppliers');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, vou, [12, 13, 10, 10, 9, 11, 11, 16], ['Amount', 'Balance']), 'Vouchers');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, ord, [11, 11, 22, 12, 32, 20, 6, 10, 10, 12, 10, 26], ['Price each', 'Advance']), 'Customer orders');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, sret, [11, 11, 24, 30, 12, 15, 7, 10, 11, 26], ['Cost each', 'Line total']), 'Supplier returns');
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, bl, [26, 24, 10, 7, 30, 20, 6, 10, 11], ['Price each', 'Amount']), 'Book lists');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
}

export const xlsxBlob = (buf) => new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

export async function downloadExcel(from, to, label, filename) {
  const buf = await buildWorkbook(from, to, label);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(xlsxBlob(buf)); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const monthRange = (t = Date.now()) => { const x = new Date(t); return [new Date(x.getFullYear(), x.getMonth(), 1).getTime(), new Date(x.getFullYear(), x.getMonth() + 1, 0, 23, 59, 59, 999).getTime()]; };
export const monthKey = (t = Date.now()) => dayKey(t).slice(0, 7);

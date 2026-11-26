import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListPlus, Plus, Copy, Trash2, Save, Printer, CheckCircle2 } from 'lucide-react';
import { db, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { generateBarcode, isIsbn } from '../lib/barcode';
import { uid, round2, UNITS } from '../lib/util';
import { toast, confirmDialog, ProductIcon } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { recommendIcons } from '../icons/catalog';
import { costCode } from '../lib/costcode';
import Suggest from '../components/Suggest';
import { searchProducts, sortSizes } from '../lib/search';
import { ItemIcon } from '../icons/catalog';

const DRAFT_KEY = 'bookpos-quickadd-draft';
const blank = (prev) => ({
  key: uid(), nameEn: prev?.nameEn || '', nameSi: prev?.nameSi || '', categoryId: prev?.categoryId || '', unit: prev?.unit || 'pcs',
  author: prev?.author || '', brand: prev?.brand || '',
  size: '', color: prev?.color || '', cost: prev?.cost || '', price: prev?.price || '', qty: '', barcode: '', catTouched: !!prev?.catTouched,
});

// Fast entry for loading a whole shop: one row = one book, or one type/colour of a stationery item.
// Rows with the same name become one product. Each row gets its own barcode,
// and price labels print with one copy for every piece (books with an ISBN need none).
export default function QuickAdd() {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const allProducts = useLiveQuery(() => db.products.toArray(), []) || [];
  const allVariants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const [rows, setRows] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (Array.isArray(d) && d.length) return d; } catch { /* */ }
    return [blank(), blank(), blank()];
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const tableRef = useRef(null);

  // keep the typed rows safe if the page is refreshed or the power goes off
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(rows)); } catch { /* */ } }, [rows]);
  useEffect(() => {
    if (categories.length) setRows((rs) => rs.map((r) => (r.categoryId ? r : { ...r, categoryId: categories[0].id })));
  }, [categories.length]); // eslint-disable-line

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  // Learn which category each kind of item usually goes in, from the shop's own products.
  const catGuess = useMemo(() => {
    const count = {};
    allProducts.forEach((p) => { (count[p.icon] ||= {}); count[p.icon][p.categoryId] = (count[p.icon][p.categoryId] || 0) + 1; });
    const out = {};
    Object.entries(count).forEach(([icon, m]) => { out[icon] = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; });
    categories.forEach((c) => { if (!out[c.icon]) out[c.icon] = c.id; });
    return out;
  }, [allProducts, categories]);
  // ---- suggestions: products already in the shop + names typed earlier on this sheet ----
  const vBy = useMemo(() => { const m = {}; allVariants.forEach((v) => (m[v.productId] ||= []).push(v)); return m; }, [allVariants]);
  // what was added recently (newest first): stock additions from this page and deliveries
  const recentMoves = useLiveQuery(async () => {
    const out = [];
    await db.stockMoves.orderBy('date').reverse().until(() => out.length >= 400).each((m) => { if (m.type === 'opening' || m.type === 'purchase') out.push(m); });
    return out;
  }, []) || [];
  const lastAdded = useMemo(() => {
    const vToP = Object.fromEntries(allVariants.map((v) => [v.id, v.productId]));
    const m = {};
    recentMoves.forEach((mv) => { const pid = vToP[mv.variantId]; if (pid && !m[pid]) m[pid] = mv.date; });
    allProducts.forEach((p) => { if (!m[p.id] && p.createdAt) m[p.id] = p.createdAt; });
    return m;
  }, [recentMoves, allVariants, allProducts]);
  const whenTxt = (ts) => { if (!ts) return ''; const d = new Date(ts); const today = new Date(); const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; return d.toDateString() === today.toDateString() ? `${t('qa.today')} ${hm}` : `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${hm}`; };
  const allSizes = useMemo(() => sortSizes(allVariants.map((v) => v.size)), [allVariants]);
  const allColors = useMemo(() => [...new Set(allVariants.map((v) => v.color).filter(Boolean))].sort(), [allVariants]);
  const allAuthors = useMemo(() => [...new Set(allProducts.map((p) => p.author).filter(Boolean))].sort(), [allProducts]);
  const allBrands = useMemo(() => [...new Set(allProducts.map((p) => p.brand).filter(Boolean))].sort(), [allProducts]);
  const suggestFor = (rowIndex) => (text) => {
    const active = allProducts.filter((p) => p.active !== false);
    // empty box: every item, most recently added first; typing: every match, best first
    const found = (text.trim()
      ? searchProducts(active, text, vBy, 300)
      : [...active].sort((a, b) => (lastAdded[b.id] || 0) - (lastAdded[a.id] || 0)).slice(0, 300)
    ).map((p) => ({ kind: 'product', p }));
    const known = new Set(found.map((x) => x.p.nameEn.toLowerCase()).concat(allProducts.map((p) => p.nameEn.toLowerCase())));
    const q = text.trim().toLowerCase();
    const typed = [];
    rows.forEach((r, j) => {
      const n = r.nameEn.trim();
      if (j !== rowIndex && n && !known.has(n.toLowerCase()) && (n.toLowerCase().includes(q) || (r.nameSi || '').includes(text.trim()))) { known.add(n.toLowerCase()); typed.push({ kind: 'row', r }); }
    });
    return [...found, ...typed.slice(0, 3)];
  };
  const pick = (i, it) => setRows((rs) => rs.map((r, j) => {
    if (j !== i) return r;
    if (it.kind === 'row') {
      const src = it.r;
      return { ...r, nameEn: src.nameEn, nameSi: src.nameSi, author: src.author || '', brand: src.brand || '', categoryId: src.categoryId, unit: src.unit, price: r.price || src.price, cost: r.cost || src.cost, catTouched: true, productId: '' };
    }
    const p = it.p; const vs = (vBy[p.id] || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const last = vs[0] || {};
    return { ...r, nameEn: p.nameEn, nameSi: p.nameSi || '', author: p.author || '', brand: p.brand || '', categoryId: p.categoryId, unit: p.unit || 'pcs', price: r.price || (last.price != null ? String(last.price) : ''), cost: r.cost || (last.cost ? String(last.cost) : ''), catTouched: true, productId: p.id };
  }));
  const focusSize = (i) => setTimeout(() => tableRef.current?.querySelectorAll('tbody tr')[i]?.querySelector('input[data-col=size]')?.focus(), 30);
  const renderSuggestion = (it) => {
    if (it.kind === 'row') return <div className="flex items-center gap-2 text-sm"><span className="badge badge-gold">{t('qa.thisSheet')}</span><b className="truncate">{it.r.nameEn}</b><span className="muted truncate">{it.r.nameSi}</span></div>;
    const p = it.p; const vs = vBy[p.id] || []; const c = catMap[p.categoryId];
    const prices = vs.map((v) => v.price); const stock = vs.reduce((a, v) => a + (Number(v.stock) || 0), 0);
    return (
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: (c?.color || '#1F2A5C') + '18', color: c?.color }}><ItemIcon id={p.icon} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">{p.nameEn} {p.nameSi ? <span className="muted font-normal">· {p.nameSi}</span> : null}</p>
          <p className="text-xs muted truncate">{[c ? t.name(c) : '', p.author].filter(Boolean).join(' · ')}{vs.length > 1 ? ` · ${t('qa.sizesHave')}: ${sortSizes(vs.map((v) => v.size || v.color)).slice(0, 6).join(', ') || '—'}` : ''}</p>
        </div>
        <div className="text-right text-xs shrink-0"><b>{prices.length ? `Rs. ${Math.min(...prices).toLocaleString()}` : ''}</b><p className="muted">{t('labels.stock')} {stock}</p>{lastAdded[p.id] ? <p className="text-indigo-600 dark:text-indigo-300 font-bold">{whenTxt(lastAdded[p.id])}</p> : null}</div>
      </div>
    );
  };

  const set = (i, k, v) => setRows((rs) => rs.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    if (k === 'categoryId') next.catTouched = true;
    if ((k === 'nameEn' || k === 'nameSi') && r.productId) { next.productId = ''; }
    if ((k === 'nameEn' || k === 'nameSi') && !r.catTouched) {
      // same name already typed above → same category; otherwise guess from the kind of item
      const same = rs.find((x, xi) => xi !== i && x.nameEn.trim() && x.nameEn.trim().toLowerCase() === next.nameEn.trim().toLowerCase());
      const existing = allProducts.find((p) => p.nameEn.trim().toLowerCase() === next.nameEn.trim().toLowerCase());
      const guess = existing?.categoryId || same?.categoryId || catGuess[recommendIcons(`${next.nameEn} ${next.nameSi}`)[0]];
      if (guess && catMap[guess]) next.categoryId = guess;
    }
    return next;
  }));
  const addRow = (n = 1, from) => setRows((rs) => [...rs, ...Array.from({ length: n }, () => blank(from || rs[rs.length - 1]))]);
  const filled = rows.filter((r) => r.nameEn.trim());
  const totalQty = round2(filled.reduce((s, r) => s + (Number(r.qty) || 0), 0));
  const iconFor = (r) => recommendIcons(`${r.nameEn} ${r.nameSi}`)[0] || catMap[r.categoryId]?.icon || 'tag';

  const onKey = (e, i, last) => {
    if (e.key === 'Enter' && last) {
      e.preventDefault();
      if (i === rows.length - 1) addRow(1, rows[i]);
      setTimeout(() => tableRef.current?.querySelectorAll('tbody tr')[i + 1]?.querySelector('input[data-col=size]')?.focus(), 30);
    }
  };

  const save = async () => {
    const bad = filled.findIndex((r) => !(Number(r.price) > 0) || !r.categoryId);
    if (!filled.length) return toast.err(t('qa.empty'));
    if (bad >= 0) return toast.err(t('qa.rowErr', { n: rows.indexOf(filled[bad]) + 1 }));
    const codes = filled.map((r) => r.barcode.replace(/[\s-]/g, '')).filter(Boolean);
    if (new Set(codes).size !== codes.length) return toast.err(t('prod.barcodeDup'));
    setSaving(true);
    try {
      const products = await db.products.toArray();
      const byName = Object.fromEntries(products.map((p) => [p.nameEn.trim().toLowerCase(), p]));
      const queue = []; let newItems = 0; let restocked = 0;
      for (const r of filled) {
        const qty = round2(Number(r.qty) || 0);
        let p = byName[r.nameEn.trim().toLowerCase()];
        if (!p) {
          p = { id: uid(), nameEn: r.nameEn.trim(), nameSi: r.nameSi.trim(), categoryId: r.categoryId, icon: iconFor(r), unit: r.unit, author: (r.author || '').trim(), brand: (r.brand || '').trim(), language: '', grade: '', subject: '', edition: '', service: false, supplierId: '', description: '', active: true, createdAt: Date.now() };
          await db.products.add(p); byName[p.nameEn.toLowerCase()] = p;
        } else {
          const patch = {};
          if (!p.nameSi && r.nameSi.trim()) patch.nameSi = r.nameSi.trim();
          if (!p.author && (r.author || '').trim()) patch.author = r.author.trim();
          if (!p.brand && (r.brand || '').trim()) patch.brand = r.brand.trim();
          if (Object.keys(patch).length) await db.products.update(p.id, patch);
        }
        const size = r.size.trim(); const color = r.color.trim();
        const code = /^[\d\s-]+$/.test(r.barcode) ? r.barcode.replace(/[\s-]/g, '') : r.barcode.trim(); // ISBN typed with dashes
        let v = await db.variants.where('productId').equals(p.id).filter((x) => (x.size || '') === size && (x.color || '') === color).first();
        // a scanned ISBN that is already in the system is the same book: add to its stock
        if (!v && code) {
          const used = await db.variants.where('barcode').equals(code).first();
          if (used && used.productId === p.id) v = used;
          else if (used) { toast.err(t('prod.barcodeUsed', { code })); continue; }
        }
        if (v) {
          // same item, size and colour already in the system: add the pieces to its stock
          await db.variants.update(v.id, { stock: round2((Number(v.stock) || 0) + qty), price: Number(r.price), ...(Number(r.cost) ? { cost: Number(r.cost) } : {}) });
          if (qty) await db.stockMoves.add({ id: uid(), variantId: v.id, date: Date.now(), type: 'purchase', qty, ref: 'Quick add', userId: user.id });
          v = { ...v, price: Number(r.price) }; restocked++;
        } else {
          v = { id: uid(), productId: p.id, size, color, barcode: code || await generateBarcode(settings.labels.format, settings.labels.prefix), sku: '', cost: Number(r.cost) || 0, price: Number(r.price), mrp: 0, wholesale: 0, stock: qty, reorderLevel: settings.stock.lowDefault };
          await db.variants.add(v);
          if (qty) await db.stockMoves.add({ id: uid(), variantId: v.id, date: Date.now(), type: 'opening', qty, ref: 'Quick add', userId: user.id });
          newItems++;
        }
        // one price label per piece; books with a printed ISBN barcode and services need none
        if (!isIsbn(v.barcode) && !p.service) queue.push({ variantId: v.id, copies: p.unit === 'pcs' ? Math.max(1, Math.round(qty)) : 1 });
      }
      audit(user.id, 'quick-add', `${newItems} new, ${restocked} restocked`);
      setResult({ newItems, restocked, queue, tags: queue.reduce((s, x) => s + x.copies, 0) });
      setRows([blank(), blank(), blank()].map((r) => ({ ...r, categoryId: filled[filled.length - 1].categoryId })));
      toast.ok(t('qa.saved', { items: newItems + restocked }));
    } finally { setSaving(false); }
  };

  const printNow = () => {
    sessionStorage.setItem('bookpos-label-queue', JSON.stringify(result.queue));
    nav('/app/labels?queue=1');
  };

  const inp = 'input !min-h-[2.5rem] !px-2';
  return (
    <Page wide>
      <PageHeader title={t('nav.quickAdd')} subtitle={t('qa.subtitle')} help="quickAdd" icon={<ListPlus size={24} />}
        actions={<>
          <button className="btn btn-ghost" onClick={async () => { if (await confirmDialog({ message: t('qa.clearMsg'), danger: true })) setRows([blank(), blank(), blank()]); }}>{t('qa.clearAll')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={18} /> {t('qa.save')}</button>
        </>} />

      {result ? (
        <div className="rounded-2xl p-5 mb-4 bg-leaf-50 dark:bg-leaf-700/20 flex flex-wrap items-center gap-4">
          <CheckCircle2 size={36} className="text-leaf-600" />
          <div className="flex-1 min-w-[14rem]">
            <p className="font-display text-xl font-bold">{t('qa.doneTitle', { items: result.newItems + result.restocked })}</p>
            <p className="muted">{t('qa.doneText', { newItems: result.newItems, restocked: result.restocked, tags: result.tags })}</p>
          </div>
          {result.tags ? <button className="btn btn-accent btn-lg" onClick={printNow}><Printer /> {t('qa.printNow', { n: result.tags })}</button> : null}
          <button className="btn btn-ghost" onClick={() => setResult(null)}>{t('common.close')}</button>
        </div>
      ) : null}

      <div className="rounded-2xl p-4 mb-4 bg-indigo-50 dark:bg-indigo-800/40 text-sm">{t('qa.hint')}</div>

      <div className="card overflow-x-auto" ref={tableRef}>
        <table className="table text-sm [&_td]:!px-1.5 [&_th]:!px-1.5">
          <thead><tr>
            <th className="hidden 2xl:table-cell">#</th><th /><th>{t('prod.nameEn')}</th><th>{t('prod.nameSi')}</th><th>{t('prod.category')}</th><th>{t('prod.author')}</th><th>{t('prod.brandShort')}</th>
            <th>{t('prod.size')}</th><th>{t('prod.color')}</th><th>{t('prod.price')}</th><th>{t('qa.qty')}</th><th>{t('prod.cost')}</th><th>{t('prod.unit')}</th><th>{t('qa.barcodeOpt')}</th><th />
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="muted font-bold hidden 2xl:table-cell">{i + 1}</td>
                <td>{r.nameEn ? <ProductIcon icon={iconFor(r)} color={catMap[r.categoryId]?.color} size={34} /> : null}</td>
                <td><Suggest className={`${inp} w-40`} value={r.nameEn} onChange={(v) => set(i, 'nameEn', v)} placeholder="Madol Doova"
                  getItems={suggestFor(i)} renderItem={renderSuggestion} minChars={0} onPick={(it) => { pick(i, it); focusSize(i); }} /></td>
                <td><Suggest className={`${inp} w-32`} value={r.nameSi} onChange={(v) => set(i, 'nameSi', v)} placeholder="මඩොල් දූව"
                  getItems={suggestFor(i)} renderItem={renderSuggestion} minChars={0} onPick={(it) => { pick(i, it); focusSize(i); }} /></td>
                <td><select className={`${inp} w-32`} value={r.categoryId} onChange={(e) => set(i, 'categoryId', e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{t.name(c)}</option>)}</select></td>
                <td><input className={`${inp} w-28`} list="qa-authors" value={r.author || ''} onChange={(e) => set(i, 'author', e.target.value)} /></td>
                <td><input className={`${inp} w-24`} list="qa-brands" value={r.brand || ''} onChange={(e) => set(i, 'brand', e.target.value)} /></td>
                <td><input className={`${inp} w-24`} data-col="size" list={`qa-size-${r.key}`} value={r.size} onChange={(e) => set(i, 'size', e.target.value)} placeholder="80 pages" />
                  <datalist id={`qa-size-${r.key}`}>{[...new Set([...(r.productId ? sortSizes((vBy[r.productId] || []).map((v) => v.size)) : []), ...allSizes])].filter(Boolean).map((x) => <option key={x} value={x} />)}</datalist></td>
                <td><input className={`${inp} w-20`} list="qa-colors" value={r.color} onChange={(e) => set(i, 'color', e.target.value)} placeholder="Blue" /></td>
                <td><input className={`${inp} w-20 font-bold`} inputMode="decimal" value={r.price} onChange={(e) => set(i, 'price', e.target.value)} /></td>
                <td><input className={`${inp} w-16 font-bold`} inputMode="decimal" value={r.qty} onChange={(e) => set(i, 'qty', e.target.value)} onKeyDown={(e) => onKey(e, i, true)} /></td>
                <td><input className={`${inp} w-20`} inputMode="decimal" value={r.cost} onChange={(e) => set(i, 'cost', e.target.value)} />{r.cost ? <div className="text-[11px] font-bold text-saffron-700 dark:text-saffron-300 text-center tracking-wider">{costCode(r.cost, settings.labels.costCode)}</div> : null}</td>
                <td><select className={`${inp} w-[5.5rem]`} value={r.unit} onChange={(e) => set(i, 'unit', e.target.value)}>{UNITS.map((u) => <option key={u} value={u}>{t('unit.' + u)}</option>)}</select></td>
                <td><input className={`${inp} w-[8.5rem] font-mono`} data-scan-target="1" value={r.barcode} onChange={(e) => set(i, 'barcode', e.target.value)} placeholder={t('qa.auto')} /></td>
                <td className="whitespace-nowrap">
                  <button className="icon-btn !w-9 !h-9" title={t('qa.copyRow')} aria-label={t('qa.copyRow')} onClick={() => setRows((rs) => [...rs.slice(0, i + 1), { ...blank(r), size: '', qty: '' }, ...rs.slice(i + 1)])}><Copy size={16} /></button>
                  <button className="icon-btn !w-9 !h-9 text-maroon-600" aria-label={t('common.remove')} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <datalist id="qa-colors">{allColors.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="qa-authors">{allAuthors.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="qa-brands">{allBrands.map((x) => <option key={x} value={x} />)}</datalist>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button className="btn btn-outline" onClick={() => addRow(1)}><Plus size={18} /> {t('qa.addRow')}</button>
        <button className="btn btn-outline" onClick={() => addRow(10)}><Plus size={18} /> {t('qa.add10')}</button>
        <span className="flex-1" />
        <span className="badge badge-blue text-sm">{t('qa.totals', { rows: filled.length, qty: totalQty })}</span>
        <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}><Save /> {t('qa.save')}</button>
      </div>
      <div className="card mt-5 overflow-hidden">
        <div className="px-4 py-3 border-b line flex items-center gap-2"><p className="font-display text-lg font-bold flex-1">{t('qa.recentTitle')}</p><span className="text-sm muted">{t('qa.recentHint')}</span></div>
        {!recentMoves.length ? <p className="muted p-4">{t('qa.recentNone')}</p> : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto scroll-thin">
            <table className="table text-sm">
              <thead><tr><th>{t('qa.when')}</th><th>{t('prod.product')}</th><th>{t('prod.size')} / {t('prod.color')}</th><th className="text-right">{t('qa.added')}</th><th className="text-right">{t('prod.price')}</th><th className="text-right">{t('labels.stock')}</th></tr></thead>
              <tbody>{recentMoves.slice(0, 40).map((m) => {
                const v = allVariants.find((x) => x.id === m.variantId); const p = v && allProducts.find((x) => x.id === v.productId); if (!p) return null;
                return (
                  <tr key={m.id}><td className="whitespace-nowrap font-bold">{whenTxt(m.date)}</td>
                    <td><div className="flex items-center gap-2"><ProductIcon icon={p.icon} color={catMap[p.categoryId]?.color} size={28} /><span><b>{p.nameEn}</b> <span className="muted">{p.nameSi}</span></span></div></td>
                    <td>{[v.size, v.color].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="text-right font-bold text-leaf-600">+{m.qty}</td><td className="text-right">{Number(v.price).toLocaleString()}</td><td className="text-right muted">{v.stock}</td></tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LibraryBig as Shirt, Plus, Pencil, Trash2, Barcode, Sparkles, Upload, Download, X, Wand2 } from 'lucide-react';
import { db, removeRecord, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { generateBarcode } from '../lib/barcode';
import { money, num, uid, round2, sum, toCSV, downloadText, UNITS } from '../lib/util';
import { Modal, toast, Field, SearchBox, ProductIcon, Empty, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import IconPicker from '../components/IconPicker';
import { recommendIcons, ItemIcon } from '../icons/catalog';
import { costCode } from '../lib/costcode';
import Suggest from '../components/Suggest';
import { searchProducts, sortSizes, bookLine } from '../lib/search';
import { ArrowUpDown, Search as SearchIcon, Layers } from 'lucide-react';

// Quick fills for the two things an item can vary by.
const SIZE_PRESETS = {
  pages: ['40 pages', '80 pages', '120 pages', '160 pages', '200 pages'],
  paper: ['A5', 'A4', 'A3'],
  pencil: ['HB', '2B', '4B', '6B'],
  tip: ['0.5 mm', '0.7 mm', '1.0 mm'],
  pack: ['12 colours', '24 colours', '36 colours'],
};
const COLOR_PRESETS = {
  ruling: ['Single ruled', 'Double ruled', 'Square ruled', 'Unruled'],
  ink: ['Blue', 'Black', 'Red'],
  medium: ['Sinhala medium', 'English medium', 'Tamil medium'],
};
export const LANGUAGES = ['Sinhala', 'English', 'Tamil'];
export const GRADES = ['Pre-school', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'O/L', 'Grade 12', 'Grade 13', 'A/L'];
const blankLine = (f, settings) => ({ id: uid(), productId: f.id, size: '', color: '', barcode: '', sku: '', cost: '', price: '', mrp: '', wholesale: 0, stock: '', reorderLevel: settings.stock.lowDefault });

function ChipInput({ values, onChange, placeholder }) {
  const [v, setV] = useState('');
  const add = (x) => { const s = x.trim(); if (s && !values.includes(s)) onChange([...values, s]); setV(''); };
  return (
    <div className="input !h-auto py-2 flex flex-wrap gap-1.5 items-center">
      {values.map((x) => (
        <span key={x} className="badge badge-blue text-sm !py-1">{x}<button type="button" onClick={() => onChange(values.filter((y) => y !== x))} aria-label="remove"><X size={14} /></button></span>
      ))}
      <input className="flex-1 min-w-[6rem] bg-transparent outline-none" value={v} placeholder={placeholder}
        onChange={(e) => { if (e.target.value.endsWith(',')) add(e.target.value.slice(0, -1)); else setV(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(v); } if (e.key === 'Backspace' && !v && values.length) onChange(values.slice(0, -1)); }}
        onBlur={() => v && add(v)} />
    </div>
  );
}

export function ProductForm({ open, product, onClose, onSaved, defaultCategoryId }) {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) || [];
  const [f, setF] = useState(null);
  const [vars, setVars] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [iconTouched, setIconTouched] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [bulk, setBulk] = useState({ cost: '', price: '', mrp: '', stock: '' });

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (product) {
        setF({ ...product });
        const vs = await db.variants.where('productId').equals(product.id).toArray();
        setVars(vs.map((v) => ({ ...v, _orig: true })));
        setIconTouched(true);
      } else {
        const nf = { id: uid(), nameEn: '', nameSi: '', categoryId: defaultCategoryId || categories[0]?.id || '', icon: 'book', unit: 'pcs', author: '', brand: '', language: '', grade: '', subject: '', edition: '', service: false, supplierId: '', description: '', active: true, createdAt: Date.now() };
        setF(nf);
        setVars([blankLine(nf, settings)]); setIconTouched(false); // a book is one line: scan its ISBN, type the price
      }
      setSizes([]); setColors([]); setShowPicker(false); setBulk({ cost: '', price: '', mrp: '', stock: '' });
    })();
  }, [open, product]); // eslint-disable-line

  // opened before the categories finished loading: take the first one
  useEffect(() => { if (open && f && !f.categoryId && categories[0]) setF((x) => ({ ...x, categoryId: categories[0].id })); }, [open, f?.categoryId, categories.length]); // eslint-disable-line

  const recs = useMemo(() => (f ? recommendIcons(`${f.nameEn} ${f.nameSi}`, 4) : []), [f?.nameEn, f?.nameSi]); // eslint-disable-line
  useEffect(() => {
    if (!f || iconTouched) return;
    const cat = categories.find((c) => c.id === f.categoryId);
    const next = recs[0] || cat?.icon || 'tag';
    if (next !== f.icon) setF((x) => ({ ...x, icon: next }));
  }, [recs, f?.categoryId, iconTouched, categories]); // eslint-disable-line

  if (!open || !f) return null;
  const cat = categories.find((c) => c.id === f.categoryId);
  const set = (k, v) => setF({ ...f, [k]: v });
  const setVar = (i, k, v) => setVars(vars.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const generate = async () => {
    const sz = sizes.length ? sizes : [''];
    const cl = colors.length ? colors : [''];
    // drop the empty starter line when real types are being made
    const next = vars.filter((x) => x._orig || x.size || x.color || String(x.barcode).trim() || Number(x.price) > 0);
    for (const s of sz) for (const c of cl) {
      if (next.some((x) => x.size === s && x.color === c)) continue;
      next.push({ id: uid(), productId: f.id, size: s, color: c, barcode: await generateBarcode(settings.labels.format, settings.labels.prefix), sku: '', cost: Number(bulk.cost) || 0, price: Number(bulk.price) || 0, mrp: Number(bulk.mrp) || 0, wholesale: 0, stock: Number(bulk.stock) || 0, reorderLevel: settings.stock.lowDefault });
    }
    setVars(next); setSizes([]); setColors([]);
  };
  const addSingle = () => setVars([...vars, { ...blankLine(f, settings), cost: bulk.cost, price: bulk.price }]);
  const applyBulk = () => setVars(vars.map((v) => ({ ...v, ...(bulk.cost !== '' ? { cost: Number(bulk.cost) } : {}), ...(bulk.price !== '' ? { price: Number(bulk.price) } : {}), ...(bulk.mrp !== '' ? { mrp: Number(bulk.mrp) } : {}), ...(bulk.stock !== '' && !v._orig ? { stock: Number(bulk.stock) } : {}) })));

  const save = async (andLabels) => {
    if (!f.nameEn.trim()) return toast.err(t('prod.nameRequired'));
    if (!f.categoryId) return toast.err(t('prod.catRequired'));
    if (!vars.length) return toast.err(t('prod.variantRequired'));
    if (vars.some((v) => !(Number(v.price) > 0))) return toast.err(t('prod.priceRequired'));
    // lines without a barcode or ISBN get a shop-made barcode now
    for (const v of vars) if (!String(v.barcode || '').trim()) v.barcode = await generateBarcode(settings.labels.format, settings.labels.prefix);
    for (const v of vars) v.barcode = /^[\d\s-]+$/.test(String(v.barcode)) ? String(v.barcode).replace(/[\s-]/g, '') : String(v.barcode).trim(); // ISBN typed with dashes
    const codes = vars.map((v) => String(v.barcode).trim());
    if (codes.some((c) => !c) || new Set(codes).size !== codes.length) return toast.err(t('prod.barcodeDup'));
    for (const v of vars) {
      const other = await db.variants.where('barcode').equals(String(v.barcode).trim()).first();
      if (other && other.id !== v.id) return toast.err(t('prod.barcodeUsed', { code: v.barcode }));
    }
    const existing = product ? await db.variants.where('productId').equals(product.id).toArray() : [];
    const removed = existing.filter((e) => !vars.some((v) => v.id === e.id));
    await db.transaction('rw', [db.products, db.variants, db.stockMoves, db.deletions], async () => {
      await db.products.put({ ...f, nameEn: f.nameEn.trim(), nameSi: (f.nameSi || '').trim(), author: (f.author || '').trim(), brand: (f.brand || '').trim(), service: !!f.service });
      for (const v of vars) {
        const { _orig, ...clean } = v;
        const row = { ...clean, productId: f.id, barcode: String(v.barcode).trim(), cost: Number(v.cost) || 0, price: Number(v.price) || 0, mrp: Number(v.mrp) || 0, wholesale: Number(v.wholesale) || 0, stock: f.service ? 0 : Number(v.stock) || 0, reorderLevel: f.service ? 0 : Number(v.reorderLevel) || 0 };
        await db.variants.put(row);
        if (!_orig && row.stock) await db.stockMoves.add({ id: uid(), variantId: row.id, date: Date.now(), type: 'opening', qty: row.stock, ref: 'New product', userId: user.id });
      }
      for (const r of removed) { await db.variants.delete(r.id); await db.deletions.put({ id: 'variants:' + r.id, table: 'variants', recordId: r.id, updatedAt: Date.now() }); }
    });
    audit(user.id, product ? 'product-edit' : 'product-add', f.nameEn);
    toast.ok(t('prod.saved'));
    if (existing.some((e) => e.labelledAt && vars.some((v) => v.id === e.id && Number(v.price) !== e.labelPrice)) && !andLabels) toast.info(t('prod.reprintHint'));
    onSaved?.(f, andLabels);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={product ? t('prod.edit') : t('prod.add')} size="xl" icon={<Shirt size={20} />}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-outline" onClick={() => save(true)}><Barcode size={18} /> {t('prod.saveAndLabels')}</button>
        <button className="btn btn-primary" onClick={() => save(false)}>{t('common.save')}</button>
      </>}>
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('prod.nameEn')}><input className="input" value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} placeholder="e.g. Madol Doova / CR book" /></Field>
            <Field label={t('prod.nameSi')}><input className="input" value={f.nameSi} onChange={(e) => set('nameSi', e.target.value)} placeholder="උදා: මඩොල් දූව" /></Field>
            <Field label={t('prod.category')}>
              <select className="input" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{t.name(c)}</option>)}
              </select>
            </Field>
            <Field label={t('prod.unit')} hint={t('prod.unitHint')}>
              <select className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{t('unit.' + u)}</option>)}
              </select>
            </Field>
            <Field label={t('prod.author')}><input className="input" value={f.author || ''} onChange={(e) => set('author', e.target.value)} placeholder="Martin Wickramasinghe" /></Field>
            <Field label={t('prod.brand')}><input className="input" value={f.brand || ''} onChange={(e) => set('brand', e.target.value)} placeholder="Publisher / Atlas, Casio…" /></Field>
            <Field label={t('prod.language')}><input className="input" list="pf-lang" value={f.language || ''} onChange={(e) => set('language', e.target.value)} /><datalist id="pf-lang">{LANGUAGES.map((x) => <option key={x} value={x} />)}</datalist></Field>
            <Field label={t('prod.grade')}><input className="input" list="pf-grade" value={f.grade || ''} onChange={(e) => set('grade', e.target.value)} placeholder="Grade 5, O/L, A/L…" /><datalist id="pf-grade">{GRADES.map((x) => <option key={x} value={x} />)}</datalist></Field>
            <Field label={t('prod.subject')}><input className="input" value={f.subject || ''} onChange={(e) => set('subject', e.target.value)} placeholder="Mathematics, Science…" /></Field>
            <Field label={t('prod.edition')}><input className="input" value={f.edition || ''} onChange={(e) => set('edition', e.target.value)} placeholder="2027 / 3rd edition" /></Field>
            <Field label={t('prod.supplier')}>
              <select className="input" value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
                <option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <div className="space-y-1 sm:mt-6">
              <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="w-5 h-5" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> {t('prod.active')}</label>
              <label className="flex items-center gap-2 font-bold" title={t('prod.serviceHint')}><input type="checkbox" className="w-5 h-5" checked={!!f.service} onChange={(e) => set('service', e.target.checked)} /> {t('prod.service')}</label>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-2)' }}>
          <p className="label">{t('prod.icon')}</p>
          <div className="flex items-center gap-3">
            <ProductIcon icon={f.icon} color={cat?.color} size={72} />
            <div className="flex-1">
              {!iconTouched && recs[0] ? <p className="text-sm font-bold text-saffron-700 dark:text-saffron-300 flex items-center gap-1"><Sparkles size={14} /> {t('prod.autoIcon')}</p> : null}
              <button className="btn btn-outline btn-sm mt-1" onClick={() => setShowPicker(!showPicker)}>{showPicker ? t('common.done') : t('prod.changeIcon')}</button>
            </div>
          </div>
          {!showPicker && recs.length > 1 ? (
            <div className="flex gap-2 mt-3">{recs.map((id) => (
              <button key={id} onClick={() => { set('icon', id); setIconTouched(true); }} className={`rounded-xl p-2 border-2 ${f.icon === id ? 'border-indigo-600' : 'border-transparent'}`} style={{ background: 'var(--surface)', color: cat?.color }} aria-label={id}><ItemIcon id={id} size={28} /></button>
            ))}</div>
          ) : null}
          {showPicker ? <div className="mt-3"><IconPicker value={f.icon} text={`${f.nameEn} ${f.nameSi}`} color={cat?.color} onChange={(id) => { set('icon', id); setIconTouched(true); }} /></div> : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed line p-4">
        <p className="font-display text-lg font-bold mb-1">{t('prod.variants')}</p>
        <p className="muted text-sm mb-3">{t('prod.variantsHint')}</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <span className="label">{t('prod.sizes')}</span>
            <ChipInput values={sizes} onChange={setSizes} placeholder={t('prod.typeEnter')} />
            <div className="flex flex-wrap gap-1.5 mt-2">{Object.entries(SIZE_PRESETS).map(([k, list]) => <button key={k} className="btn btn-ghost btn-sm" onClick={() => setSizes([...new Set([...sizes, ...list])])}>{t('sizes.' + k)}</button>)}</div>
          </div>
          <div>
            <span className="label">{t('prod.colors')}</span>
            <ChipInput values={colors} onChange={setColors} placeholder={t('prod.typeEnter')} />
            <div className="flex flex-wrap gap-1.5 mt-2">{Object.entries(COLOR_PRESETS).map(([k, list]) => <button key={k} className="btn btn-ghost btn-sm" onClick={() => setColors([...new Set([...colors, ...list])])}>{t('colors.' + k)}</button>)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {['cost', 'price', 'mrp', 'stock'].filter((k) => k !== 'stock' || !f.service).map((k) => <Field key={k} label={t('prod.' + k)} hint={k === 'cost' && Number(bulk.cost) > 0 ? `${t('cc.code')}: ${costCode(bulk.cost, settings.labels.costCode)}` : undefined}><input className="input" inputMode="decimal" value={bulk[k]} onChange={(e) => setBulk({ ...bulk, [k]: e.target.value })} /></Field>)}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-primary" onClick={generate}><Wand2 size={18} /> {t('prod.generate')}</button>
          <button className="btn btn-outline" onClick={addSingle}><Plus size={18} /> {t('prod.addOne')}</button>
          {vars.length ? <button className="btn btn-ghost" onClick={applyBulk}>{t('prod.applyAll')}</button> : null}
        </div>
        {vars.length ? (
          <div className="overflow-x-auto mt-4">
            <table className="table text-sm">
              <thead><tr><th>{t('prod.size')}</th><th>{t('prod.color')}</th><th>{t('prod.barcode')}</th><th>{t('prod.cost')}</th><th>{t('prod.price')}</th><th>{t('prod.mrp')}</th><th>{t('prod.stock')}</th><th>{t('prod.reorder')}</th><th /></tr></thead>
              <tbody>{vars.map((v, i) => (
                <tr key={v.id}>
                  <td><input className="input !min-h-[2.25rem] w-28" value={v.size} onChange={(e) => setVar(i, 'size', e.target.value)} /></td>
                  <td><input className="input !min-h-[2.25rem] w-28" value={v.color} onChange={(e) => setVar(i, 'color', e.target.value)} /></td>
                  <td><input className="input !min-h-[2.25rem] w-44 font-mono" data-scan-target="1" value={v.barcode} placeholder={t('qa.auto')} onChange={(e) => setVar(i, 'barcode', e.target.value)} title={t('prod.barcodeHint')} /></td>
                  {['cost', 'price', 'mrp'].map((k) => <td key={k}><input className="input !min-h-[2.25rem] w-24" inputMode="decimal" value={v[k]} onChange={(e) => setVar(i, k, e.target.value)} />{k === 'cost' && Number(v.cost) > 0 ? <div className="text-[11px] font-bold text-saffron-700 dark:text-saffron-300 text-center tracking-wider">{costCode(v.cost, settings.labels.costCode)}</div> : null}</td>)}
                  <td><input className="input !min-h-[2.25rem] w-20" inputMode="decimal" value={f.service ? '' : v.stock} disabled={v._orig || f.service} title={v._orig ? t('prod.stockViaInventory') : ''} onChange={(e) => setVar(i, 'stock', e.target.value)} /></td>
                  <td><input className="input !min-h-[2.25rem] w-16" inputMode="numeric" value={v.reorderLevel} onChange={(e) => setVar(i, 'reorderLevel', e.target.value)} /></td>
                  <td><button className="icon-btn" onClick={() => setVars(vars.filter((_, j) => j !== i))} aria-label={t('common.remove')}><Trash2 size={18} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </div>
      <Field label={t('prod.description')} className="mt-4"><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
    </Modal>
  );
}

function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export default function Products() {
  const t = useT();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(params.get('category') || 'all');
  const [stockF, setStockF] = useState('all');
  const [sort, setSort] = useState(() => { try { return localStorage.getItem('bookpos-prod-sort') || 'name'; } catch { return 'name'; } });
  const [showHidden, setShowHidden] = useState(false);
  const since30 = useMemo(() => Date.now() - 30 * 864e5, []);
  const sold30 = useLiveQuery(async () => {
    const m = {};
    await db.sales.where('date').above(since30).each((x) => { if (x.status === 'void') return; x.items.forEach((i) => { m[i.productId] = (m[i.productId] || 0) + (i.unit === 'pcs' ? i.qty : 1); }); });
    return m;
  }, [since30]) || {};
  useEffect(() => { try { localStorage.setItem('bookpos-prod-sort', sort); } catch { /* */ } }, [sort]);
  const [edit, setEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => { if (params.get('new')) { setEdit(null); setFormOpen(true); params.delete('new'); setParams(params, { replace: true }); } }, []); // eslint-disable-line

  const cMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const vBy = useMemo(() => { const m = {}; variants.forEach((v) => (m[v.productId] ||= []).push(v)); return m; }, [variants]);
  const stockOf = (p) => round2(sum(vBy[p.id] || [], (v) => v.stock));
  const priceOf = (p) => { const ps = (vBy[p.id] || []).map((v) => v.price); return ps.length ? Math.min(...ps) : 0; };
  const stockState = (p) => { if (p.service) return 'ok'; const vs = vBy[p.id] || []; const st = stockOf(p); return st <= 0 ? 'out' : vs.some((v) => v.stock <= (v.reorderLevel ?? 5)) ? 'low' : 'ok'; };
  const list = useMemo(() => {
    let rows = products.filter((p) => (showHidden || p.active !== false) && (cat === 'all' || p.categoryId === cat) && (stockF === 'all' || stockState(p) === stockF));
    if (q.trim()) rows = searchProducts(rows, q, vBy); // best matches first when searching
    const by = {
      name: (a, b) => a.nameEn.localeCompare(b.nameEn), nameDesc: (a, b) => b.nameEn.localeCompare(a.nameEn),
      priceLow: (a, b) => priceOf(a) - priceOf(b), priceHigh: (a, b) => priceOf(b) - priceOf(a),
      stockHigh: (a, b) => stockOf(b) - stockOf(a), stockLow: (a, b) => stockOf(a) - stockOf(b),
      newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0), best: (a, b) => (sold30[b.id] || 0) - (sold30[a.id] || 0),
    }[sort];
    if (!q.trim() && by) rows = [...rows].sort(by);
    return rows;
  }, [products, q, cat, stockF, sort, showHidden, vBy, sold30]); // eslint-disable-line
  const counts = useMemo(() => ({
    all: products.filter((p) => showHidden || p.active !== false).length,
    low: products.filter((p) => (showHidden || p.active !== false) && stockState(p) === 'low').length,
    out: products.filter((p) => (showHidden || p.active !== false) && stockState(p) === 'out').length,
  }), [products, vBy, showHidden]); // eslint-disable-line

  const del = async (p) => {
    const sold = await db.sales.filter((s) => s.items.some((i) => i.productId === p.id)).first();
    if (sold) {
      if (await confirmDialog({ title: t('prod.hideTitle'), message: t('prod.hideMsg') })) { await db.products.update(p.id, { active: false }); toast.ok(t('prod.hidden')); }
      return;
    }
    if (!(await confirmDialog({ title: t('prod.deleteTitle'), message: t('prod.deleteMsg', { name: t.name(p) }), danger: true, okText: t('common.delete') }))) return;
    for (const v of vBy[p.id] || []) await removeRecord('variants', v.id);
    await removeRecord('products', p.id);
    audit(user.id, 'product-delete', p.nameEn);
    toast.ok(t('common.deleted'));
  };

  // Excel (.xlsx) export. Reads straight from the database when clicked, so it always has
  // every product (or just the ones shown, when a search or filter is on).
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const [ps, vs, cs] = await Promise.all([db.products.toArray(), db.variants.toArray(), db.categories.toArray()]);
    const shownIds = new Set(list.map((p) => p.id));
    const filtered = q.trim() || cat !== 'all' || stockF !== 'all';
    const P2 = Object.fromEntries(ps.map((p) => [p.id, p])); const C2 = Object.fromEntries(cs.map((c) => [c.id, c]));
    const rows = vs.filter((v) => P2[v.productId] && (!filtered || shownIds.has(v.productId)))
      .map((v) => { const p = P2[v.productId]; return {
        'Title / item (English)': p.nameEn, 'Title / item (Sinhala)': p.nameSi || '', Category: C2[p.categoryId]?.nameEn || '', Author: p.author || '', 'Publisher / brand': p.brand || '', Language: p.language || '', Grade: p.grade || '', Subject: p.subject || '', Edition: p.edition || '', Type: v.size || '', 'Colour / ruling': v.color || '',
        'Barcode / ISBN': v.barcode, Unit: p.unit || 'pcs', 'Cost price': Number(v.cost) || 0, 'Cost code': costCode(v.cost, settings.labels.costCode), 'Selling price': Number(v.price) || 0, MRP: Number(v.mrp) || 0,
        Stock: Number(v.stock) || 0, 'Reorder at': v.reorderLevel ?? '', 'Stock value (cost)': round2(Math.max(0, v.stock) * v.cost), Service: p.service ? 'Yes' : '', Active: p.active === false ? 'No' : 'Yes',
      }; })
      .sort((a, b) => (a.Category + a['Title / item (English)'] + a.Type).localeCompare(b.Category + b['Title / item (English)'] + b.Type));
    if (!rows.length) return toast.info(t('prod.exportNothing'));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [32, 28, 20, 22, 18, 10, 10, 14, 9, 14, 14, 16, 6, 11, 10, 12, 9, 8, 10, 14, 8, 7].map((w) => ({ wch: w }));
    ws['!autofilter'] = { ref: ws['!ref'] };
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Books and items');
    const day = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `products-${day}${filtered ? '-filtered' : ''}.xlsx`, { compression: true });
    toast.ok(t('prod.exported', { n: rows.length }));
  };

  const doImport = async (file) => {
    const rows = parseCSV(await file.text());
    if (rows.length < 2) return toast.err(t('prod.importEmpty'));
    const head = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
    const col = (r, k) => (r[head.indexOf(k)] ?? '').trim();
    let created = 0; let updated = 0;
    const productByName = Object.fromEntries(products.map((p) => [p.nameEn.toLowerCase(), p]));
    for (const r of rows.slice(1)) {
      const nameEn = col(r, 'nameEn'); if (!nameEn) continue;
      let catRow = categories.find((c) => c.nameEn.toLowerCase() === col(r, 'category').toLowerCase());
      if (!catRow && col(r, 'category')) { catRow = { id: uid(), nameEn: col(r, 'category'), nameSi: '', icon: recommendIcons(col(r, 'category'))[0] || 'tag', color: '#1F2A5C', sort: categories.length + 1 }; await db.categories.add(catRow); categories.push(catRow); }
      let p = productByName[nameEn.toLowerCase()];
      if (!p) {
        p = { id: uid(), nameEn, nameSi: col(r, 'nameSi'), categoryId: catRow?.id || categories[0]?.id, icon: recommendIcons(`${nameEn} ${col(r, 'nameSi')}`)[0] || catRow?.icon || 'book', unit: UNITS.includes(col(r, 'unit')) ? col(r, 'unit') : 'pcs', author: col(r, 'author'), brand: col(r, 'publisher') || col(r, 'brand'), language: col(r, 'language'), grade: col(r, 'grade'), subject: col(r, 'subject'), edition: col(r, 'edition'), service: /^(yes|y|1|true)$/i.test(col(r, 'service')), supplierId: '', description: '', active: true, createdAt: Date.now() };
        await db.products.add(p); productByName[nameEn.toLowerCase()] = p;
      }
      const rawCode = col(r, 'barcode') || col(r, 'isbn');
      const code = (/^[\d\s-]+$/.test(rawCode) ? rawCode.replace(/[\s-]/g, '') : rawCode) || await generateBarcode(settings.labels.format, settings.labels.prefix);
      const existing = await db.variants.where('barcode').equals(code).first();
      const row = { productId: p.id, size: col(r, 'size'), color: col(r, 'color'), barcode: code, cost: Number(col(r, 'cost')) || 0, price: Number(col(r, 'price')) || 0, mrp: Number(col(r, 'mrp')) || 0, stock: Number(col(r, 'stock')) || 0 };
      if (existing) {
        const delta = round2(row.stock - (Number(existing.stock) || 0));
        await db.variants.update(existing.id, row); updated++;
        if (delta) await db.stockMoves.add({ id: uid(), variantId: existing.id, date: Date.now(), type: 'correction', qty: delta, ref: 'Import', userId: user.id });
      } else {
        const id = uid();
        await db.variants.add({ id, sku: '', wholesale: 0, reorderLevel: settings.stock.lowDefault, ...row }); created++;
        if (row.stock) await db.stockMoves.add({ id: uid(), variantId: id, date: Date.now(), type: 'opening', qty: row.stock, ref: 'Import', userId: user.id });
      }
    }
    toast.ok(t('prod.imported', { created, updated }));
    setImportOpen(false);
  };

  return (
    <Page>
      <PageHeader title={t('nav.products')} subtitle={t('prod.count', { n: products.length, v: variants.length })} help="products" icon={<Shirt size={24} />}
        actions={<>
          <button className="btn btn-outline" onClick={() => setImportOpen(true)}><Upload size={18} /> {t('common.import')}</button>
          <button className="btn btn-outline" onClick={exportExcel}><Download size={18} /> {t('prod.exportExcel')}</button>
          <button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('prod.add')}</button>
        </>} />
      <div className="card p-3 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[16rem]">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 muted pointer-events-none" size={20} />
            <Suggest className="input pl-11" value={q} onChange={setQ} placeholder={t('prod.searchPh')} inputProps={{ 'data-scan-target': '1', type: 'search' }}
              getItems={(text) => searchProducts(products.filter((p) => showHidden || p.active !== false), text, vBy, 8)}
              onPick={(p) => { setEdit(p); setFormOpen(true); }}
              renderItem={(p) => { const c = cMap[p.categoryId]; return (
                <div className="flex items-center gap-2.5">
                  <ProductIcon icon={p.icon} color={c?.color} size={34} />
                  <div className="min-w-0 flex-1"><p className="font-bold text-sm truncate">{p.nameEn}{p.nameSi ? <span className="muted font-normal"> · {p.nameSi}</span> : null}</p><p className="text-xs muted truncate">{[c ? t.name(c) : '', p.author, p.grade].filter(Boolean).join(' · ')}</p></div>
                  <div className="text-right text-xs"><b>{num(priceOf(p))}</b><p className="muted">{t('labels.stock')} {stockOf(p)}</p></div>
                </div>); }} />
          </div>
          <label className="flex items-center gap-2 rounded-xl px-3 border-2 line" style={{ background: 'var(--surface)' }}>
            <ArrowUpDown size={18} className="muted" />
            <select className="bg-transparent outline-none font-bold min-h-[2.5rem]" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('prod.sortBy')}>
              {['name', 'nameDesc', 'priceLow', 'priceHigh', 'stockHigh', 'stockLow', 'newest', 'best'].map((k) => <option key={k} value={k}>{t('prod.sort.' + k)}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
          <button onClick={() => setCat('all')} className={`shrink-0 h-10 px-3 rounded-xl font-bold text-sm border-2 ${cat === 'all' ? 'bg-indigo-700 text-white border-indigo-700' : 'line'}`}><Layers size={16} className="inline -mt-0.5" /> {t('pos.all')}</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 h-10 px-3 rounded-xl font-bold text-sm flex items-center gap-1.5 border-2 ${cat === c.id ? 'text-white' : 'line'}`} style={cat === c.id ? { background: c.color, borderColor: c.color } : undefined}>
              <ItemIcon id={c.icon} size={17} /> {t.name(c)} <span className="opacity-70">{products.filter((p) => p.categoryId === c.id && (showHidden || p.active !== false)).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[['all', 'pos.all', counts.all, 'badge-blue'], ['low', 'inv.low', counts.low, 'badge-gold'], ['out', 'inv.out', counts.out, 'badge-red']].map(([k, l, n, b]) => (
            <button key={k} onClick={() => setStockF(k)} className={`btn btn-sm ${stockF === k ? 'btn-primary' : 'btn-ghost'}`}>{t(l)} <span className={`badge ${b}`}>{n}</span></button>
          ))}
          <label className="flex items-center gap-2 text-sm font-bold ml-1"><input type="checkbox" className="w-4 h-4" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> {t('prod.showHidden')}</label>
          <span className="flex-1" />
          <span className="text-sm muted font-bold">{t('prod.showing', { n: list.length })}</span>
          {(q || cat !== 'all' || stockF !== 'all') ? <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setCat('all'); setStockF('all'); }}>{t('prod.clearFilters')}</button> : null}
        </div>
      </div>
      <div className="card overflow-x-auto">
        {!list.length ? <Empty icon={<Shirt size={28} />} title={t('prod.none')} text={t('prod.noneText')} action={<button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('prod.add')}</button>} /> : (
          <table className="table">
            <thead><tr><th>{t('prod.product')}</th><th>{t('prod.category')}</th><th>{t('prod.typesCol')}</th><th className="text-right">{t('prod.price')}</th><th className="text-right">{t('prod.stock')}</th><th /></tr></thead>
            <tbody>
              {list.map((p) => {
                const vs = vBy[p.id] || []; const c = cMap[p.categoryId];
                const prices = vs.map((v) => v.price); const st = round2(sum(vs, (v) => v.stock));
                return (
                  <tr key={p.id} className={`cursor-pointer ${p.active === false ? 'opacity-50' : ''}`} onClick={() => { setEdit(p); setFormOpen(true); }}>
                    <td><div className="flex items-center gap-3"><ProductIcon icon={p.icon} color={c?.color} size={44} /><div><p className="font-bold">{p.nameEn} {sold30[p.id] ? <span className="badge badge-green ml-1">{t('prod.sold30', { n: Math.round(sold30[p.id]) })}</span> : null}{p.active === false ? <span className="badge badge-red ml-1">{t('prod.hiddenBadge')}</span> : null}</p><p className="text-sm muted">{[p.nameSi, bookLine(p), p.brand].filter(Boolean).join(' · ')}</p></div></div></td>
                    <td>{c ? t.name(c) : '—'}</td>
                    <td><span className="text-sm">{vs.length > 1 ? `${vs.length} · ${sortSizes(vs.map((v) => v.size || v.color)).slice(0, 5).join(', ')}` : <span className="font-mono text-xs">{vs[0]?.barcode}</span>}</span></td>
                    <td className="text-right font-bold">{prices.length ? (Math.min(...prices) === Math.max(...prices) ? num(prices[0]) : `${num(Math.min(...prices))}+`) : '—'}</td>
                    <td className="text-right">{p.service ? <span className="badge badge-blue">{t('prod.serviceBadge')}</span> : <span className={`badge ${st <= 0 ? 'badge-red' : vs.some((v) => v.stock <= v.reorderLevel) ? 'badge-gold' : 'badge-green'}`}>{st}{p.unit === 'm' ? ' m' : ''}</span>}</td>
                    <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" title={t('nav.labels')} onClick={() => nav(`/app/labels?product=${p.id}`)} aria-label={t('nav.labels')}><Barcode size={19} /></button>
                      <button className="icon-btn" onClick={() => { setEdit(p); setFormOpen(true); }} aria-label={t('common.edit')}><Pencil size={19} /></button>
                      <button className="icon-btn text-maroon-600" onClick={() => del(p)} aria-label={t('common.delete')}><Trash2 size={19} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <ProductForm open={formOpen} product={edit} onClose={() => setFormOpen(false)} onSaved={(p, labels) => labels && nav(`/app/labels?product=${p.id}`)} />
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('prod.importTitle')} icon={<Upload size={20} />}>
        <p className="mb-3">{t('prod.importHelp')}</p>
        <pre className="text-xs rounded-xl p-3 overflow-x-auto mb-3" style={{ background: 'var(--surface-2)' }}>nameEn,nameSi,category,unit,author,publisher,language,grade,subject,edition,size,color,barcode,cost,price,mrp,stock{'\n'}Madol Doova,මඩොල් දූව,Novels &amp; fiction,pcs,Martin Wickramasinghe,Lakbima Books,Sinhala,,,,,,9789550000012,455,650,650,12{'\n'}CR book,සී.ආර්. පොත,Exercise books,pcs,,Atlas,,,,,120 pages,Single ruled,,215,270,,144</pre>
        <button className="btn btn-ghost btn-sm mb-3" onClick={() => downloadText('books-template.csv', '\uFEFFnameEn,nameSi,category,unit,author,publisher,language,grade,subject,edition,size,color,barcode,cost,price,mrp,stock\n', 'text/csv')}><Download size={16} /> {t('prod.template')}</button>
        <input type="file" accept=".csv,text/csv" className="input py-2" onChange={(e) => e.target.files[0] && doImport(e.target.files[0])} />
      </Modal>
    </Page>
  );
}

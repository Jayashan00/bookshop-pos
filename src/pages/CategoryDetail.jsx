import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Plus, Barcode, Boxes, TrendingUp, Coins, Tag, AlertTriangle, ArrowUpDown, LibraryBig as Shirt, Trophy } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { money, num, round2, sum } from '../lib/util';
import { costCode } from '../lib/costcode';
import { searchProducts, sortSizes } from '../lib/search';
import { Modal, toast, Field, SearchBox, ProductIcon, Empty, Stat } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import IconPicker from '../components/IconPicker';
import { ProductForm } from './Products';

const COLORS = ['#1F2A5C', '#3D4C92', '#8C1C3A', '#B02A4C', '#C4840C', '#9A640C', '#138A6C', '#0B5A47', '#744B0E', '#6E1530', '#172046', '#5E6DAF'];

// One category: what is in it, how it sells, and quick actions for its products.
export default function CategoryDetail() {
  const t = useT();
  const { id } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const cat = useLiveQuery(() => db.categories.get(id), [id]);
  const products = useLiveQuery(() => db.products.where('categoryId').equals(id).toArray(), [id]) || [];
  const variants = useLiveQuery(async () => {
    const ids = (await db.products.where('categoryId').equals(id).primaryKeys());
    return ids.length ? db.variants.where('productId').anyOf(ids).toArray() : [];
  }, [id]) || [];
  const since = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }, []);
  const sales = useLiveQuery(async () => {
    const m = {}; let qty = 0; let revenue = 0; let profit = 0;
    await db.sales.where('date').above(since).each((x) => {
      if (x.status === 'void') return;
      x.items.forEach((i) => {
        if (i.categoryId !== id) return;
        const q = i.qty - (i.returnedQty || 0);
        m[i.productId] = (m[i.productId] || 0) + q;
        qty += i.unit === 'pcs' ? q : 1; revenue += i.paidUnit * q; profit += (i.paidUnit - i.cost) * q;
      });
    });
    return { byProduct: m, qty, revenue: round2(revenue), profit: round2(profit) };
  }, [id, since]) || { byProduct: {}, qty: 0, revenue: 0, profit: 0 };

  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [stockF, setStockF] = useState('all');
  const [edit, setEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [catEdit, setCatEdit] = useState(null);

  const vBy = useMemo(() => { const m = {}; variants.forEach((v) => (m[v.productId] ||= []).push(v)); return m; }, [variants]);
  const stockOf = (p) => round2(sum(vBy[p.id] || [], (v) => v.stock));
  const priceOf = (p) => { const ps = (vBy[p.id] || []).map((v) => v.price); return ps.length ? Math.min(...ps) : 0; };
  const state = (p) => (p.service ? 'ok' : stockOf(p) <= 0 ? 'out' : (vBy[p.id] || []).some((v) => v.stock <= (v.reorderLevel ?? 5)) ? 'low' : 'ok');

  const summary = useMemo(() => ({
    products: products.filter((p) => p.active !== false).length,
    hidden: products.filter((p) => p.active === false).length,
    variants: variants.length,
    pieces: round2(sum(variants, (v) => Math.max(0, v.stock))),
    cost: round2(sum(variants, (v) => Math.max(0, v.stock) * v.cost)),
    retail: round2(sum(variants, (v) => Math.max(0, v.stock) * v.price)),
    low: products.filter((p) => p.active !== false && state(p) === 'low').length,
    out: products.filter((p) => p.active !== false && state(p) === 'out').length,
    best: products.slice().sort((a, b) => (sales.byProduct[b.id] || 0) - (sales.byProduct[a.id] || 0))[0],
  }), [products, variants, sales]); // eslint-disable-line

  const list = useMemo(() => {
    let rows = products.filter((p) => stockF === 'all' || (stockF === 'hidden' ? p.active === false : p.active !== false && state(p) === stockF));
    if (q.trim()) return searchProducts(rows, q, vBy);
    const by = { name: (a, b) => a.nameEn.localeCompare(b.nameEn), priceLow: (a, b) => priceOf(a) - priceOf(b), priceHigh: (a, b) => priceOf(b) - priceOf(a),
      stockHigh: (a, b) => stockOf(b) - stockOf(a), stockLow: (a, b) => stockOf(a) - stockOf(b), best: (a, b) => (sales.byProduct[b.id] || 0) - (sales.byProduct[a.id] || 0),
      newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) }[sort];
    rows = [...rows].sort(by); return rows;
  }, [products, q, sort, stockF, vBy, sales]); // eslint-disable-line

  if (cat === undefined) return <Page><p className="muted">{t('common.loading')}</p></Page>;
  if (!cat) return <Page><Empty icon={<Shirt size={28} />} title={t('catd.notFound')} action={<Link className="btn btn-primary" to="/app/categories">{t('nav.categories')}</Link>} /></Page>;

  const saveCat = async () => { if (!catEdit.nameEn.trim()) return toast.err(t('cat.nameRequired')); await db.categories.put(catEdit); toast.ok(t('common.saved')); setCatEdit(null); };

  return (
    <Page>
      <Link to="/app/categories" className="inline-flex items-center gap-1.5 font-bold text-indigo-600 mb-3"><ArrowLeft size={18} /> {t('nav.categories')}</Link>
      <PageHeader title={t.name(cat)} subtitle={t.lang === 'si' ? cat.nameEn : cat.nameSi} help="categories" icon={<ProductIcon icon={cat.icon} color="#ffffff" size={48} />}
        actions={<>
          <button className="btn btn-outline" onClick={() => setCatEdit({ ...cat })}><Pencil size={18} /> {t('catd.editCat')}</button>
          <button className="btn btn-outline" onClick={() => nav(`/app/labels?category=${cat.id}`)}><Barcode size={18} /> {t('catd.printAll')}</button>
          <button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('prod.add')}</button>
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label={t('catd.products')} value={summary.products} sub={`${summary.variants} ${t('prod.sizesColours')}${summary.hidden ? ` · ${summary.hidden} ${t('prod.hiddenBadge')}` : ''}`} icon={<Shirt />} />
        <Stat label={t('inv.units')} value={num(summary.pieces).replace('.00', '')} sub={summary.low || summary.out ? `${summary.low} ${t('inv.low')} · ${summary.out} ${t('inv.out')}` : t('dash.stockOk')} icon={<Boxes />} tone={summary.out ? 'red' : summary.low ? 'gold' : 'green'} />
        <Stat label={t('inv.costValue')} value={money(summary.cost, settings.currency)} sub={`${t('inv.retailValue')}: ${num(summary.retail)}`} icon={<Coins />} tone="gold" />
        <Stat label={t('catd.thisMonth')} value={money(sales.revenue, settings.currency)} sub={`${num(sales.qty).replace('.00', '')} ${t('dash.sold')} · ${t('rep.profit')} ${num(sales.profit)}`} icon={<TrendingUp />} tone="green" />
      </div>
      {summary.best && sales.byProduct[summary.best.id] ? (
        <div className="rounded-2xl px-4 py-3 mb-4 bg-saffron-50 dark:bg-saffron-900/30 flex items-center gap-3">
          <Trophy className="text-saffron-700" /><span className="font-bold">{t('catd.best')}:</span>
          <span className="flex-1 truncate">{t.name(summary.best)} · {Math.round(sales.byProduct[summary.best.id])} {t('dash.sold')}</span>
        </div>
      ) : null}

      <div className="card p-3 mb-3 flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[14rem]"><SearchBox value={q} onChange={setQ} placeholder={t('prod.searchPh')} scanTarget /></div>
        <label className="flex items-center gap-2 rounded-xl px-3 border-2 line"><ArrowUpDown size={18} className="muted" />
          <select className="bg-transparent outline-none font-bold min-h-[2.5rem]" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('prod.sortBy')}>
            {['name', 'priceLow', 'priceHigh', 'stockHigh', 'stockLow', 'best', 'newest'].map((k) => <option key={k} value={k}>{t('prod.sort.' + k)}</option>)}
          </select></label>
        {[['all', 'pos.all'], ['low', 'inv.low'], ['out', 'inv.out'], ['hidden', 'prod.hiddenBadge']].map(([k, l]) => (
          <button key={k} className={`btn btn-sm ${stockF === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStockF(k)}>{t(l)}</button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {!list.length ? <Empty icon={<Shirt size={28} />} title={t('catd.empty')} action={<button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('prod.add')}</button>} /> : (
          <table className="table">
            <thead><tr><th>{t('prod.product')}</th><th>{t('prod.variants')}</th><th className="text-right">{t('prod.price')}</th>{settings.labels.showCostCode ? <th>{t('cc.code')}</th> : null}<th className="text-right">{t('prod.stock')}</th><th className="text-right">{t('catd.soldMonth')}</th><th /></tr></thead>
            <tbody>{list.map((p) => {
              const vs = vBy[p.id] || []; const st = stockOf(p); const prices = vs.map((v) => v.price); const costs = vs.map((v) => v.cost).filter(Boolean);
              return (
                <tr key={p.id} className={`cursor-pointer ${p.active === false ? 'opacity-50' : ''}`} onClick={() => { setEdit(p); setFormOpen(true); }}>
                  <td><div className="flex items-center gap-3"><ProductIcon icon={p.icon} color={cat.color} size={40} /><div><p className="font-bold">{p.nameEn}</p><p className="text-sm muted">{p.nameSi}</p></div></div></td>
                  <td className="text-sm">{sortSizes(vs.map((v) => v.size)).slice(0, 7).join(', ') || '—'}{vs.some((v) => v.color) ? <p className="muted text-xs">{[...new Set(vs.map((v) => v.color).filter(Boolean))].slice(0, 4).join(', ')}</p> : null}</td>
                  <td className="text-right font-bold">{prices.length ? (Math.min(...prices) === Math.max(...prices) ? num(prices[0]) : `${num(Math.min(...prices))}+`) : '—'}</td>
                  {settings.labels.showCostCode ? <td className="font-bold tracking-wider text-sm">{costs.length ? costCode(Math.min(...costs), settings.labels.costCode) : '—'}</td> : null}
                  <td className="text-right"><span className={`badge ${st <= 0 ? 'badge-red' : state(p) === 'low' ? 'badge-gold' : 'badge-green'}`}>{p.service ? '—' : st}{p.unit === 'm' ? ' m' : ''}</span></td>
                  <td className="text-right">{sales.byProduct[p.id] ? Math.round(sales.byProduct[p.id]) : '—'}</td>
                  <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" title={t('nav.labels')} aria-label={t('nav.labels')} onClick={() => nav(`/app/labels?product=${p.id}`)}><Barcode size={19} /></button>
                    <button className="icon-btn" title={t('nav.inventory')} aria-label={t('nav.inventory')} onClick={() => nav(`/app/inventory?q=${encodeURIComponent(p.nameEn)}`)}><Tag size={19} /></button>
                    <button className="icon-btn" aria-label={t('common.edit')} onClick={() => { setEdit(p); setFormOpen(true); }}><Pencil size={19} /></button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
      {summary.out ? <p className="mt-3 text-sm flex items-center gap-1.5 text-maroon-600 font-bold"><AlertTriangle size={16} /> {t('catd.outHint', { n: summary.out })}</p> : null}

      <ProductForm open={formOpen} product={edit} defaultCategoryId={cat.id} onClose={() => setFormOpen(false)} onSaved={(p, labels) => labels && nav(`/app/labels?product=${p.id}`)} />
      <Modal open={!!catEdit} onClose={() => setCatEdit(null)} title={t('cat.edit')} icon={<Pencil size={20} />}
        footer={<><button className="btn btn-ghost" onClick={() => setCatEdit(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={saveCat}>{t('common.save')}</button></>}>
        {catEdit ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t('prod.nameEn')}><input className="input" value={catEdit.nameEn} onChange={(e) => setCatEdit({ ...catEdit, nameEn: e.target.value })} /></Field>
              <Field label={t('prod.nameSi')}><input className="input" value={catEdit.nameSi} onChange={(e) => setCatEdit({ ...catEdit, nameSi: e.target.value })} /></Field>
            </div>
            <div><span className="label">{t('cat.color')}</span>
              <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} onClick={() => setCatEdit({ ...catEdit, color: c })} className={`w-9 h-9 rounded-full border-4 ${catEdit.color === c ? 'border-saffron-400' : 'border-transparent'}`} style={{ background: c }} aria-label={c} />)}</div></div>
            <IconPicker value={catEdit.icon} text={`${catEdit.nameEn} ${catEdit.nameSi}`} color={catEdit.color} onChange={(ic) => setCatEdit({ ...catEdit, icon: ic })} />
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}

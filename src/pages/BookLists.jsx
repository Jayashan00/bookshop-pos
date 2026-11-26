import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListChecks, Plus, Pencil, Trash2, Copy, Printer, ScanBarcode, AlertTriangle } from 'lucide-react';
import { db, removeRecord, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth, can } from '../store/auth';
import { useCart } from '../store/cart';
import { useBarcodeScanner, beep } from '../lib/scanner';
import { codeCandidates } from '../lib/barcode';
import { searchProducts } from '../lib/search';
import { addListToCart, quoteFromLines } from '../lib/booklist';
import { money, num, uid, round2, sum } from '../lib/util';
import { Modal, toast, Field, SearchBox, ProductIcon, Empty, confirmDialog } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { printQuotation } from '../print/templates';
import { GRADES } from './Products';

const variantText = (v) => [v.size, v.color].filter(Boolean).join(' · ');

// One list = the books and stationery a school asks parents to buy for a grade.
function ListForm({ open, list, onClose, products, variants }) {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const [f, setF] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!open) return;
    setQ('');
    setF(list ? { ...list, items: (list.items || []).map((x) => ({ ...x })) } : { id: uid(), name: '', school: '', grade: '', year: String(new Date().getFullYear() + (new Date().getMonth() >= 8 ? 1 : 0)), note: '', items: [], createdAt: Date.now() });
  }, [open, list]);

  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const vMap = useMemo(() => Object.fromEntries(variants.map((v) => [v.id, v])), [variants]);
  const vBy = useMemo(() => { const m = {}; variants.forEach((v) => (m[v.productId] ||= []).push(v)); return m; }, [variants]);

  const add = (v) => setF((x) => {
    const i = x.items.findIndex((it) => it.variantId === v.id);
    return { ...x, items: i >= 0 ? x.items.map((it, j) => (j === i ? { ...it, qty: Number(it.qty) + 1 } : it)) : [...x.items, { variantId: v.id, qty: 1 }] };
  });
  useBarcodeScanner((code) => {
    const c = codeCandidates(code); const v = variants.find((x) => c.includes(x.barcode));
    if (v) { add(v); settings.sound && beep(true); setQ(''); } else { settings.sound && beep(false); toast.err(t('pos.notFound', { code })); }
  }, { enabled: open });

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return searchProducts(products.filter((p) => p.active !== false && !p.service), q, vBy, 12).flatMap((p) => (vBy[p.id] || []).map((v) => ({ p, v }))).slice(0, 30);
  }, [q, products, vBy]);

  if (!open || !f) return null;
  const set = (k, v) => setF({ ...f, [k]: v });
  const setItem = (i, patch) => setF({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const total = round2(sum(f.items, (it) => (Number(it.qty) || 0) * (vMap[it.variantId]?.price || 0)));
  const save = async () => {
    if (!f.name.trim()) return toast.err(t('bl.nameRequired'));
    const items = f.items.map((it) => ({ variantId: it.variantId, qty: round2(Number(it.qty) || 0) })).filter((it) => it.qty > 0);
    if (!items.length) return toast.err(t('bl.itemsRequired'));
    await db.booklists.put({ ...f, name: f.name.trim(), school: (f.school || '').trim(), items });
    audit(user.id, list ? 'booklist-edit' : 'booklist-add', f.name);
    toast.ok(t('common.saved')); onClose();
  };

  return (
    <Modal open onClose={onClose} title={list ? t('bl.edit') : t('bl.add')} size="xl" icon={<ListChecks size={20} />}
      footer={<><span className="mr-auto font-display text-xl font-bold">{t('pos.total')}: {money(total, settings.currency)}</span><button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Field label={t('bl.name')} className="lg:col-span-2"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Grade 6 book list 2027" /></Field>
        <Field label={t('bl.school')} className="lg:col-span-2"><input className="input" value={f.school || ''} onChange={(e) => set('school', e.target.value)} /></Field>
        <Field label={t('prod.grade')}><input className="input" list="bl-grade" value={f.grade || ''} onChange={(e) => set('grade', e.target.value)} /><datalist id="bl-grade">{GRADES.map((x) => <option key={x} value={x} />)}</datalist></Field>
        <Field label={t('bl.year')}><input className="input" inputMode="numeric" value={f.year || ''} onChange={(e) => set('year', e.target.value)} /></Field>
        <Field label={t('common.note')} className="sm:col-span-2"><input className="input" value={f.note || ''} onChange={(e) => set('note', e.target.value)} /></Field>
      </div>
      <SearchBox value={q} onChange={setQ} placeholder={t('bl.itemPh')} scanTarget />
      {results.length ? (
        <div className="mt-2 max-h-60 overflow-y-auto scroll-thin divide-y line">
          {results.map(({ p, v }) => (
            <button key={v.id} onClick={() => add(v)} className="w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-indigo-50 dark:hover:bg-indigo-800 rounded-lg">
              <ProductIcon icon={p.icon} size={34} />
              <span className="flex-1 min-w-0"><b>{t.name(p)}</b> <span className="text-sm muted">{[p.author, variantText(v)].filter(Boolean).join(' · ')}</span></span>
              <b className="text-sm">{num(v.price)}</b><Plus size={18} />
            </button>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto mt-3">
        {!f.items.length ? <Empty icon={<ScanBarcode size={28} />} title={t('bl.empty')} text={t('bl.emptyText')} /> : (
          <table className="table">
            <thead><tr><th>#</th><th>{t('prod.product')}</th><th className="text-right">{t('prod.price')}</th><th>{t('pos.qty')}</th><th className="text-right">{t('quote.amount')}</th><th /></tr></thead>
            <tbody>{f.items.map((it, i) => {
              const v = vMap[it.variantId]; const p = v && pMap[v.productId];
              return (
                <tr key={it.variantId}>
                  <td className="muted font-bold">{i + 1}</td>
                  <td>{p ? <><b>{t.name(p)}</b><p className="text-xs muted">{[p.author, variantText(v)].filter(Boolean).join(' · ')}</p></> : <span className="text-maroon-600 font-bold">{t('bl.removedItem')}</span>}</td>
                  <td className="text-right">{v ? num(v.price) : '—'}</td>
                  <td><input className="input !min-h-[2.25rem] w-20" inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></td>
                  <td className="text-right font-bold">{v ? num((Number(it.qty) || 0) * v.price) : '—'}</td>
                  <td><button className="icon-btn" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} aria-label={t('common.remove')}><Trash2 size={18} /></button></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

export default function BookLists() {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const lists = useLiveQuery(() => db.booklists.toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const variants = useLiveQuery(() => db.variants.toArray(), []) || [];
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [use, setUse] = useState(null); // { list, sets }
  const canEdit = can(user, 'products') || can(user, 'settings');

  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const vMap = useMemo(() => Object.fromEntries(variants.map((v) => [v.id, v])), [variants]);
  const lines = (l) => (l.items || []).map((it) => { const v = vMap[it.variantId]; const p = v && pMap[v.productId]; return { ...it, v, p, missing: !v || !p || p.active === false }; });
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return lists.filter((l) => !s || [l.name, l.school, l.grade, l.year].some((x) => (x || '').toLowerCase().includes(s)))
      .map((l) => { const ls = lines(l); const ok = ls.filter((x) => !x.missing); return { ...l, ls, count: ok.length, total: round2(sum(ok, (x) => x.qty * x.v.price)), short: ok.filter((x) => (Number(x.v.stock) || 0) < x.qty).length, missing: ls.length - ok.length }; })
      .sort((a, b) => (b.year || '').localeCompare(a.year || '') || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [lists, q, vMap, pMap]); // eslint-disable-line

  const del = async (l) => {
    if (!(await confirmDialog({ message: t('bl.deleteMsg', { name: l.name }), danger: true, okText: t('common.delete') }))) return;
    await removeRecord('booklists', l.id); toast.ok(t('common.deleted'));
  };
  const duplicate = async (l) => {
    const { ls, count, total, short, missing, ...clean } = l; // eslint-disable-line no-unused-vars
    const copy = { ...clean, id: uid(), name: `${l.name} (2)`, createdAt: Date.now(), updatedAt: undefined };
    await db.booklists.add(copy); setEdit(copy); setFormOpen(true);
  };
  const print = (l, sets = 1) => {
    const doc = quoteFromLines(l.ls, sets);
    printQuotation({ ...doc, title: l.name, subtitle: [l.school, l.grade, l.year, sets > 1 ? `× ${sets}` : ''].filter(Boolean).join(' · '), note: l.note, userName: user.name }, settings);
  };
  const bill = async () => {
    const { list, sets } = use;
    if (useCart.getState().lines.length && !(await confirmDialog({ message: t('bl.addToCurrent') }))) return;
    const r = await addListToCart(list, sets);
    toast.ok(t('bl.added', { n: r.added, name: list.name }));
    if (r.short.length) toast.err(t('bl.short', { items: r.short.slice(0, 4).join(', ') + (r.short.length > 4 ? '…' : '') }));
    setUse(null); nav('/app/pos');
  };

  return (
    <Page>
      <PageHeader title={t('nav.booklists')} subtitle={t('bl.subtitle')} help="booklists" icon={<ListChecks size={24} />}
        actions={canEdit ? <button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('bl.add')}</button> : null} />
      <div className="mb-4 max-w-md"><SearchBox value={q} onChange={setQ} placeholder={t('bl.searchPh')} /></div>
      {!rows.length ? (
        <div className="card"><Empty icon={<ListChecks size={28} />} title={t('bl.none')} text={t('bl.noneText')} action={canEdit ? <button className="btn btn-primary" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus size={18} /> {t('bl.add')}</button> : null} /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((l) => (
            <div key={l.id} className="card p-4 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-700 text-white grid place-items-center shrink-0"><ListChecks size={24} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold leading-tight">{l.name}</p>
                  <p className="muted text-sm truncate">{[l.school, l.grade, l.year].filter(Boolean).join(' · ') || '—'}</p>
                </div>
              </div>
              <div className="mt-3 text-sm space-y-0.5 flex-1">
                {l.ls.filter((x) => !x.missing).slice(0, 5).map((x) => <p key={x.variantId} className="truncate"><b>{x.qty} ×</b> {t.name(x.p)} <span className="muted">{variantText(x.v)}</span></p>)}
                {l.count > 5 ? <p className="muted">+ {l.count - 5} {t('pos.itemsShort')}</p> : null}
              </div>
              {l.short || l.missing ? <p className="mt-2 badge badge-gold self-start"><AlertTriangle size={13} /> {l.short ? t('bl.shortCount', { n: l.short }) : ''}{l.short && l.missing ? ' · ' : ''}{l.missing ? t('bl.missingCount', { n: l.missing }) : ''}</p> : null}
              <div className="flex items-end justify-between mt-3 pt-3 border-t line">
                <div><p className="text-xs muted font-bold">{l.count} {t('pos.itemsShort')}</p><p className="font-display text-2xl font-extrabold text-indigo-700 dark:text-saffron-300">{money(l.total, settings.currency)}</p></div>
                <div className="flex items-center">
                  <button className="icon-btn" title={t('bl.print')} aria-label={t('bl.print')} onClick={() => print(l)}><Printer size={19} /></button>
                  {canEdit ? <>
                    <button className="icon-btn" title={t('bl.duplicate')} aria-label={t('bl.duplicate')} onClick={() => duplicate(l)}><Copy size={19} /></button>
                    <button className="icon-btn" aria-label={t('common.edit')} onClick={() => { setEdit(lists.find((x) => x.id === l.id)); setFormOpen(true); }}><Pencil size={19} /></button>
                    <button className="icon-btn text-maroon-600" aria-label={t('common.delete')} onClick={() => del(l)}><Trash2 size={19} /></button>
                  </> : null}
                </div>
              </div>
              {can(user, 'pos') ? <button className="btn btn-accent w-full mt-3" onClick={() => setUse({ list: l, sets: 1 })}><ScanBarcode size={18} /> {t('bl.bill')}</button> : null}
            </div>
          ))}
        </div>
      )}

      <ListForm open={formOpen} list={edit} onClose={() => setFormOpen(false)} products={products} variants={variants} />

      <Modal open={!!use} onClose={() => setUse(null)} title={use?.list.name} size="sm" icon={<ListChecks size={20} />}
        footer={<><button className="btn btn-outline mr-auto" onClick={() => print(use.list, use.sets)}><Printer size={18} /> {t('pos.quotation')}</button><button className="btn btn-ghost" onClick={() => setUse(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={bill}>{t('pos.addToBill')}</button></>}>
        {use ? (
          <div className="space-y-3">
            <p className="muted">{t('bl.setsHint')}</p>
            <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={`btn ${use.sets === n ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUse({ ...use, sets: n })}>{n}</button>)}</div>
            <Field label={t('bl.sets')}><input className="input text-2xl text-center" inputMode="numeric" value={use.sets} onChange={(e) => setUse({ ...use, sets: Math.max(1, Math.min(999, Number(e.target.value.replace(/\D/g, '')) || 1)) })} /></Field>
            <p className="text-center font-display text-3xl font-extrabold text-indigo-700 dark:text-saffron-300">{money(use.list.total * use.sets, settings.currency)}</p>
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}

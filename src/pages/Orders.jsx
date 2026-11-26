import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookPlus, Plus, Trash2, Printer, Phone, PackageCheck, Send, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { db, audit } from '../db/db';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { useAuth } from '../store/auth';
import { createOrder } from '../lib/pos';
import { money, num, sum, round2, fmtDate, fmtDateTime } from '../lib/util';
import { Modal, toast, Field, SearchBox, Empty, Tabs, confirmDialog, Stat } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { printOrderSlip } from '../print/templates';

const NEXT = { pending: 'ordered', ordered: 'arrived', arrived: 'collected' };
const BADGE = { pending: 'badge-gold', ordered: 'badge-blue', arrived: 'badge-green', collected: 'badge-blue', cancelled: 'badge-red' };
const NEXT_ICON = { pending: Send, ordered: PackageCheck, arrived: CheckCircle2 };
const orderTotal = (o) => round2(sum(o.items, (i) => (Number(i.qty) || 0) * (Number(i.price) || 0)));
const blankItem = () => ({ title: '', author: '', qty: 1, price: '' });

// A customer wants a book that is not on the shelf: note it, take an advance, bring it down.
function OrderForm({ open, onClose }) {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const customers = useLiveQuery(() => db.customers.toArray(), []) || [];
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), []) || [];
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setBusy(false); setF({ customerName: '', phone: '', customerId: null, supplierId: '', items: [blankItem()], advance: '', advanceMethod: 'cash', note: '' }); } }, [open]);
  if (!open || !f) return null;
  const set = (k, v) => setF({ ...f, [k]: v });
  const setItem = (i, k, v) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const total = orderTotal(f);
  // typing a known customer's name or phone fills the other box
  const onName = (v) => { const c = customers.find((x) => x.name.toLowerCase() === v.trim().toLowerCase()); setF({ ...f, customerName: v, customerId: c?.id || null, phone: c && !f.phone ? c.phone || '' : f.phone }); };
  const onPhone = (v) => { const c = v.trim().length >= 9 ? customers.find((x) => x.phone === v.trim()) : null; setF({ ...f, phone: v, customerId: c?.id || f.customerId, customerName: c && !f.customerName ? c.name : f.customerName }); };
  const save = async (print) => {
    if (busy) return;
    if (!f.customerName.trim()) return toast.err(t('cust.nameRequired'));
    if (!f.phone.trim()) return toast.err(t('ord.phoneRequired'));
    const items = f.items.filter((i) => i.title.trim()).map((i) => ({ title: i.title.trim(), author: (i.author || '').trim(), qty: Math.max(1, Number(i.qty) || 1), price: Number(i.price) || 0 }));
    if (!items.length) return toast.err(t('ord.itemsRequired'));
    setBusy(true);
    try {
      const { order } = await createOrder({ order: { customerName: f.customerName.trim(), phone: f.phone.trim(), customerId: f.customerId, supplierId: f.supplierId, items, advance: Number(f.advance) || 0, advanceMethod: f.advanceMethod, note: f.note.trim() }, user, settings });
      toast.ok(t('ord.saved', { no: order.orderNo }));
      if (print) printOrderSlip(order, settings);
      onClose();
    } catch (e) { toast.err(String(e.message || e)); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('ord.add')} size="lg" icon={<BookPlus size={20} />}
      footer={<><span className="mr-auto font-bold">{t('ord.estTotal')}: {money(total, settings.currency)}</span><button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-outline" onClick={() => save(false)}>{t('common.save')}</button><button className="btn btn-primary" onClick={() => save(true)}><Printer size={18} /> {t('ord.saveAndPrint')}</button></>}>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Field label={t('cust.name')}><input className="input" list="ord-cust" value={f.customerName} onChange={(e) => onName(e.target.value)} /><datalist id="ord-cust">{customers.slice(0, 500).map((c) => <option key={c.id} value={c.name} />)}</datalist></Field>
        <Field label={t('cust.phone')}><input className="input" inputMode="tel" value={f.phone} onChange={(e) => onPhone(e.target.value)} placeholder="07X XXX XXXX" /></Field>
      </div>
      <p className="label">{t('ord.items')}</p>
      <div className="space-y-2">
        {f.items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.6fr_1fr_4.5rem_6.5rem_auto] gap-2 items-center">
            <input className="input" value={it.title} onChange={(e) => setItem(i, 'title', e.target.value)} placeholder={t('ord.titlePh')} />
            <input className="input hidden sm:block" value={it.author} onChange={(e) => setItem(i, 'author', e.target.value)} placeholder={t('ord.authorPh')} />
            <input className="input hidden sm:block text-center" inputMode="numeric" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value.replace(/\D/g, ''))} aria-label={t('pos.qty')} />
            <input className="input hidden sm:block" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value.replace(/[^\d.]/g, ''))} placeholder={t('prod.price')} />
            <button className="icon-btn" onClick={() => setF({ ...f, items: f.items.length > 1 ? f.items.filter((_, j) => j !== i) : [blankItem()] })} aria-label={t('common.remove')}><Trash2 size={18} /></button>
            <div className="grid grid-cols-3 gap-2 col-span-2 sm:hidden">
              <input className="input" value={it.author} onChange={(e) => setItem(i, 'author', e.target.value)} placeholder={t('ord.authorPh')} />
              <input className="input text-center" inputMode="numeric" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value.replace(/\D/g, ''))} aria-label={t('pos.qty')} />
              <input className="input" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value.replace(/[^\d.]/g, ''))} placeholder={t('prod.price')} />
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm mt-2" onClick={() => setF({ ...f, items: [...f.items, blankItem()] })}><Plus size={16} /> {t('ord.addItem')}</button>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <Field label={t('ord.advance')} hint={t('ord.advanceHint')}><input className="input text-xl" inputMode="decimal" value={f.advance} onChange={(e) => set('advance', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></Field>
        <Field label={t('promo.paidWith')}><select className="input" value={f.advanceMethod} onChange={(e) => set('advanceMethod', e.target.value)}>{['cash', 'card', 'qr', 'bank'].map((m) => <option key={m} value={m}>{t('pay.' + m)}</option>)}</select></Field>
        <Field label={t('ord.fromSupplier')}><select className="input" value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label={t('common.note')} className="sm:col-span-3"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder={t('ord.notePh')} /></Field>
      </div>
    </Modal>
  );
}

export default function Orders() {
  const t = useT();
  const settings = useSettings();
  const user = useAuth((s) => s.user);
  const orders = useLiveQuery(() => db.orders.orderBy('date').reverse().toArray(), []) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) || [];
  const sMap = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useState(null);

  const isOpen = (o) => ['pending', 'ordered', 'arrived'].includes(o.status);
  const counts = useMemo(() => ({ pending: orders.filter((o) => o.status === 'pending').length, ordered: orders.filter((o) => o.status === 'ordered').length, arrived: orders.filter((o) => o.status === 'arrived').length, advance: round2(sum(orders.filter(isOpen), (o) => o.advance)) }), [orders]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter((o) => (tab === 'all' || (tab === 'open' ? isOpen(o) : o.status === tab))
      && (!s || o.orderNo.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || (o.phone || '').includes(s) || o.items.some((i) => i.title.toLowerCase().includes(s) || (i.author || '').toLowerCase().includes(s))));
  }, [orders, tab, q]);

  const setStatus = async (o, status) => {
    await db.orders.update(o.id, { status, [status + 'At']: Date.now() });
    audit(user.id, 'order-' + status, o.orderNo);
    toast.ok(t('ord.statusSet', { no: o.orderNo, status: t('ord.s.' + status) }));
    if (status === 'collected' && o.voucherCode) toast.info(t('ord.collectHint', { code: o.voucherCode }));
    setView(null);
  };
  const cancel = async (o) => {
    if (!(await confirmDialog({ title: t('ord.cancelTitle'), message: o.advance > 0 ? t('ord.cancelMsgAdvance', { code: o.voucherCode, amount: num(o.advance) }) : t('ord.cancelMsg', { no: o.orderNo }), danger: true, okText: t('ord.cancel') }))) return;
    await setStatus(o, 'cancelled');
  };

  const Actions = ({ o }) => {
    const nx = NEXT[o.status]; const I = nx ? NEXT_ICON[o.status] : null;
    return (
      <>
        {nx ? <button className={`btn btn-sm ${o.status === 'arrived' ? 'btn-success' : 'btn-primary'}`} onClick={() => setStatus(o, nx)}><I size={16} /> {t('ord.to.' + nx)}</button> : null}
        <button className="icon-btn" onClick={() => printOrderSlip(o, settings)} title={t('ord.printSlip')} aria-label={t('ord.printSlip')}><Printer size={18} /></button>
      </>
    );
  };

  return (
    <Page>
      <PageHeader title={t('nav.orders')} subtitle={t('ord.subtitle')} help="orders" icon={<BookPlus size={24} />}
        actions={<button className="btn btn-primary" onClick={() => setFormOpen(true)}><Plus size={18} /> {t('ord.add')}</button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label={t('ord.s.pending')} value={counts.pending} icon={<BookPlus />} tone="gold" sub={t('ord.hint.pending')} />
        <Stat label={t('ord.s.ordered')} value={counts.ordered} icon={<Send />} sub={t('ord.hint.ordered')} />
        <Stat label={t('ord.s.arrived')} value={counts.arrived} icon={<PackageCheck />} tone="green" sub={t('ord.hint.arrived')} />
        <Stat label={t('ord.advancesHeld')} value={money(counts.advance, settings.currency)} icon={<CheckCircle2 />} tone="red" />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-[16rem]"><SearchBox value={q} onChange={setQ} placeholder={t('ord.searchPh')} /></div>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'open', label: t('ord.tabOpen') }, { id: 'collected', label: t('ord.s.collected') }, { id: 'cancelled', label: t('ord.s.cancelled') }, { id: 'all', label: t('pos.all') }]} />
      </div>
      <div className="card overflow-x-auto">
        {!rows.length ? <Empty icon={<BookPlus size={28} />} title={t('ord.none')} text={t('ord.noneText')} action={<button className="btn btn-primary" onClick={() => setFormOpen(true)}><Plus size={18} /> {t('ord.add')}</button>} /> : (
          <table className="table">
            <thead><tr><th>{t('ord.no')}</th><th>{t('pos.customer')}</th><th>{t('ord.items')}</th><th className="text-right">{t('ord.advance')}</th><th>{t('common.status')}</th><th /></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id}>
                <td><b>{o.orderNo}</b><p className="text-xs muted whitespace-nowrap">{fmtDate(o.date)}</p></td>
                <td><b>{o.customerName}</b>{o.phone ? <p><a className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-300" href={`tel:${o.phone}`}><Phone size={13} />{o.phone}</a></p> : null}</td>
                <td className="max-w-[22rem]">{o.items.map((i, k) => <p key={k} className="truncate"><b>{i.qty} ×</b> {i.title}{i.author ? <span className="muted"> · {i.author}</span> : null}</p>)}{o.note ? <p className="text-xs muted truncate">{o.note}</p> : null}</td>
                <td className="text-right">{o.advance > 0 ? <><b>{num(o.advance)}</b><p className="text-xs muted font-mono">{o.voucherCode}</p></> : '—'}</td>
                <td><span className={`badge ${BADGE[o.status]}`}>{t('ord.s.' + o.status)}</span></td>
                <td className="text-right whitespace-nowrap">
                  <Actions o={o} />
                  <button className="icon-btn" onClick={() => setView(o)} aria-label={t('common.view')}><Eye size={18} /></button>
                  {isOpen(o) ? <button className="icon-btn text-maroon-600" onClick={() => cancel(o)} title={t('ord.cancel')} aria-label={t('ord.cancel')}><XCircle size={18} /></button> : null}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <OrderForm open={formOpen} onClose={() => setFormOpen(false)} />
      <Modal open={!!view} onClose={() => setView(null)} title={view?.orderNo} icon={<BookPlus size={20} />}
        footer={view ? <><button className="btn btn-outline mr-auto" onClick={() => printOrderSlip(view, settings)}><Printer size={18} /> {t('ord.printSlip')}</button>{NEXT[view.status] ? <button className="btn btn-primary" onClick={() => setStatus(view, NEXT[view.status])}>{t('ord.to.' + NEXT[view.status])}</button> : null}</> : null}>
        {view ? (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3"><span className={`badge ${BADGE[view.status]}`}>{t('ord.s.' + view.status)}</span><span className="muted">{fmtDateTime(view.date)} · {view.userName}</span></div>
            <p className="font-display text-xl font-bold">{view.customerName}</p>
            {view.phone ? <a className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-300" href={`tel:${view.phone}`}><Phone size={15} />{view.phone}</a> : null}
            <table className="table mt-3"><tbody>{view.items.map((i, k) => <tr key={k}><td><b>{i.title}</b>{i.author ? <p className="text-sm muted">{i.author}</p> : null}</td><td className="text-right whitespace-nowrap">{i.qty} × {num(i.price)}</td><td className="text-right font-bold">{num(i.qty * i.price)}</td></tr>)}</tbody></table>
            <div className="mt-3 space-y-1 max-w-xs ml-auto">
              <div className="flex justify-between"><span className="muted">{t('ord.estTotal')}</span><b>{num(orderTotal(view))}</b></div>
              <div className="flex justify-between"><span className="muted">{t('ord.advance')}{view.voucherCode ? ` (${view.voucherCode})` : ''}</span><b>{num(view.advance)}</b></div>
              <div className="flex justify-between font-display text-lg font-bold"><span>{t('ord.balance')}</span><span>{money(Math.max(0, orderTotal(view) - view.advance), settings.currency)}</span></div>
            </div>
            {view.supplierId && sMap[view.supplierId] ? <p className="mt-3"><span className="muted">{t('ord.fromSupplier')}:</span> <b>{sMap[view.supplierId]}</b></p> : null}
            {view.note ? <p className="mt-1">{view.note}</p> : null}
            {view.voucherCode && view.status !== 'collected' ? <p className="mt-3 rounded-xl p-3 bg-saffron-50 dark:bg-saffron-900/30 text-sm font-bold">{t('ord.collectHint', { code: view.voucherCode })}</p> : null}
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}

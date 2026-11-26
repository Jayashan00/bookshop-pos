import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Barcode, Printer, Trash2, Plus, Info, Tag, RefreshCw, Layers } from 'lucide-react';
import { db } from '../db/db';
import { useT } from '../i18n';
import { isIsbn } from '../lib/barcode';
import { useSettings } from '../store/settings';
import { useBarcodeScanner, beep } from '../lib/scanner';
import { LABEL_TEMPLATES } from '../lib/print';
import { num } from '../lib/util';

// Remember when each item's tag was printed and at what price, so the shop can find
// items that were never tagged and items whose price changed after printing.
export async function markLabelled(variantIds) {
  const now = Date.now();
  await db.transaction('rw', db.variants, async () => {
    for (const id of variantIds) { const v = await db.variants.get(id); if (v) await db.variants.update(id, { labelledAt: now, labelPrice: v.price }); }
  });
}

import { toast, SearchBox, ProductIcon, Empty, Toggle, Field } from '../components/ui';
import { PageHeader } from '../components/Help';
import { Page } from '../components/Layout';
import { Label, LabelRow, printLabels, printLabelAlignment } from '../print/templates';
import { rowWidth } from '../lib/print';
import { costCode } from '../lib/costcode';
import { searchProducts, sortSizes } from '../lib/search';
import { ItemIcon } from '../icons/catalog';

const sortVariants = (vs) => { const order = sortSizes(vs.map((v) => v.size)); return [...vs].sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size) || String(a.color).localeCompare(String(b.color))); };

const LIST_KEY = 'bookpos-label-list';

export default function Labels() {
  const t = useT();
  const settings = useSettings();
  const cfg = settings.labels;
  const setCfg = (patch) => settings.setSection('labels', patch);
  const [params, setParams] = useSearchParams();
  const products = useLiveQuery(() => db.products.toArray(), []);
  const variants = useLiveQuery(() => db.variants.toArray(), []);
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) || [];
  const today0 = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const addedToday = useLiveQuery(async () => {
    const ids = new Set();
    await db.stockMoves.where('date').aboveOrEqual(today0).each((m) => { if (m.type === 'opening' || m.type === 'purchase') ids.add(m.variantId); });
    return [...ids];
  }, [today0]) || [];

  // The list keeps only: which item, how many copies, ticked or not.
  // Names, sizes and prices are always read live, so a price change never prints an old price.
  const [list, setList] = useState(() => { try { return JSON.parse(sessionStorage.getItem(LIST_KEY) || '[]'); } catch { return []; } });
  useEffect(() => { try { sessionStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* */ } }, [list]);
  const [q, setQ] = useState('');
  const [qCat, setQCat] = useState('');

  const P = useMemo(() => Object.fromEntries((products || []).map((p) => [p.id, p])), [products]);
  const V = useMemo(() => Object.fromEntries((variants || []).map((v) => [v.id, v])), [variants]);
  const cMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const toItem = (v, copies) => { const p = P[v.productId] || {}; return { key: v.id, variantId: v.id, nameEn: p.nameEn || '', nameSi: p.nameSi || '', icon: p.icon, categoryId: p.categoryId, size: v.size, color: v.color, barcode: v.barcode, price: v.price, cost: v.cost, copies }; };
  const copiesFor = (v) => (P[v.productId]?.unit === 'pcs' ? Math.max(1, Math.round(v.stock) || 1) : 1);

  const add = (vs, copiesOf = () => 1) => setList((cur) => {
    const next = cur.map((x) => ({ ...x }));
    for (const v of vs) {
      const ex = next.find((x) => x.variantId === v.id);
      if (ex) { ex.copies = (Number(ex.copies) || 0) + copiesOf(v); ex.sel = true; } else next.push({ variantId: v.id, copies: copiesOf(v), sel: true });
    }
    return next;
  });
  const addMany = (vs) => { if (!vs.length) return toast.info(t('labels.nothing')); add(vs, copiesFor); toast.ok(t('labels.added', { n: vs.length })); };

  // Load from the page address ONCE (e.g. after “Print tags now”), then forget the address.
  // Earlier this re-ran whenever items changed (another counter syncing) and brought back removed rows.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !products || !variants) return;
    loaded.current = true;
    const pid = params.get('product'); const grn = params.get('purchase'); const cid = params.get('category'); const fromQueue = params.get('queue');
    if (!pid && !grn && !cid && !fromQueue) return;
    let fresh = null;
    if (cid) fresh = variants.filter((v) => P[v.productId]?.categoryId === cid && P[v.productId]?.active !== false && !P[v.productId]?.service).map((v) => ({ variantId: v.id, copies: copiesFor(v), sel: true }));
    if (pid) fresh = variants.filter((v) => v.productId === pid).map((v) => ({ variantId: v.id, copies: copiesFor(v), sel: true }));
    if (fromQueue) { try { fresh = JSON.parse(sessionStorage.getItem('bookpos-label-queue') || '[]').map((x) => ({ variantId: x.variantId, copies: x.copies, sel: true })); } catch { fresh = []; } }
    if (fresh) setList(fresh);
    if (grn) db.purchases.get(grn).then((pu) => pu && setList(pu.items.map((it) => ({ variantId: it.variantId, copies: Math.max(1, Math.round(it.qty)), sel: true }))));
    setParams({}, { replace: true });
  }, [products, variants]); // eslint-disable-line

  useBarcodeScanner(async (code) => {
    const v = (variants || []).find((x) => x.barcode === code);
    if (v) { add([v]); settings.sound && beep(true); } else { settings.sound && beep(false); toast.err(t('pos.notFound', { code })); }
  });

  const results = useMemo(() => {
    if (!q.trim() || !products || !variants) return [];
    const vBy = {}; variants.forEach((v) => (vBy[v.productId] ||= []).push(v));
    return searchProducts(products.filter((p) => p.active !== false), q, vBy, 40).map((p) => ({ p, vs: vBy[p.id] || [] }));
  }, [q, products, variants]);

  // rows with live data, grouped by category in the shop's category order
  const rows = list.map((x, i) => ({ ...x, i, v: V[x.variantId] })).filter((x) => x.v);
  const groups = useMemo(() => {
    const g = {};
    rows.forEach((r) => { const c = P[r.v.productId]?.categoryId || '_'; (g[c] ||= []).push(r); });
    Object.values(g).forEach((arr) => arr.sort((a, b) => (P[a.v.productId]?.nameEn || '').localeCompare(P[b.v.productId]?.nameEn || '') || String(a.v.size).localeCompare(String(b.v.size))));
    const order = categories.map((c) => c.id).concat('_');
    return order.filter((id) => g[id]).map((id) => ({ id, cat: cMap[id], rows: g[id] }));
  }, [list, V, P, categories]); // eslint-disable-line
  const selRows = rows.filter((r) => r.sel);
  const selLabels = selRows.reduce((s, r) => s + (Number(r.copies) || 0), 0);
  const allSel = rows.length > 0 && selRows.length === rows.length;
  const setRow = (variantId, patch) => setList((cur) => cur.map((x) => (x.variantId === variantId ? { ...x, ...patch } : x)));
  const setMany = (ids, patch) => { const set = new Set(ids); setList((cur) => cur.map((x) => (set.has(x.variantId) ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x))); };
  const removeIds = (ids) => { const set = new Set(ids); setList((cur) => cur.filter((x) => !set.has(x.variantId))); };

  // Books that carry the publisher's ISBN barcode, and services, need no shop label.
  const needsLabel = (v) => P[v.productId] && !P[v.productId].service && !isIsbn(v.barcode);
  const notLabelled = (variants || []).filter((v) => needsLabel(v) && P[v.productId].active !== false && !v.labelledAt);
  const priceChanged = (variants || []).filter((v) => needsLabel(v) && v.labelledAt && v.labelPrice !== v.price);
  const todayVs = addedToday.map((id) => V[id]).filter(Boolean);

  const doPrint = async () => {
    const items = selRows.filter((r) => Number(r.copies) > 0).map((r) => toItem(r.v, Number(r.copies)));
    if (!items.length) return toast.info(t('labels.nothingSelected'));
    await printLabels(items, settings);
    markLabelled(items.map((x) => x.variantId));
  };
  const tpl = LABEL_TEMPLATES[cfg.template] || LABEL_TEMPLATES['38x25'];
  const multi = tpl.kind === 'multi';
  const previewW = multi ? rowWidth(tpl, cfg) : tpl.w;
  const scale = Math.min(3, (multi ? 330 : 240) / (previewW * 3.78));
  const firstSel = selRows[0];
  const sample = firstSel ? toItem(firstSel.v, 1) : { nameEn: 'Linen kurta top', nameSi: 'ලිනන් කුර්තා ටොප්', size: 'M', color: 'Beige', barcode: '2000000000015', price: 2890, cost: 1500 };
  const previewItems = selRows.flatMap((r) => Array.from({ length: Math.max(0, Number(r.copies) || 0) }, () => toItem(r.v, 1))).slice(0, tpl.cols || 1);
  const Check = ({ checked, indeterminate, onChange, label }) => (
    <input type="checkbox" className="w-5 h-5 accent-indigo-700 cursor-pointer" aria-label={label} checked={checked}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate; }} onChange={(e) => onChange(e.target.checked)} />
  );

  return (
    <Page>
      <PageHeader title={t('nav.labels')} subtitle={t('labels.subtitle')} help="labels" icon={<Barcode size={24} />} />
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4 min-w-0">
          <div className="card p-4">
            <p className="font-bold mb-2">{t('labels.quick')}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn btn-outline" onClick={() => addMany(todayVs)}><Plus size={18} /> {t('labels.addedToday')} <span className={`badge ${todayVs.length ? 'badge-blue' : 'badge-green'}`}>{todayVs.length}</span></button>
              <button className="btn btn-outline" onClick={() => addMany(notLabelled)}><Tag size={18} /> {t('labels.notLabelled')} <span className={`badge ${notLabelled.length ? 'badge-gold' : 'badge-green'}`}>{notLabelled.length}</span></button>
              <button className="btn btn-outline" onClick={() => addMany(priceChanged)}><RefreshCw size={18} /> {t('labels.priceChanged')} <span className={`badge ${priceChanged.length ? 'badge-red' : 'badge-green'}`}>{priceChanged.length}</span></button>
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-2">
              <select className="input !w-auto" value={qCat} onChange={(e) => setQCat(e.target.value)}>
                <option value="">{t('labels.pickCategory')}</option>{categories.map((c) => <option key={c.id} value={c.id}>{t.name(c)}</option>)}
              </select>
              <button className="btn btn-outline" disabled={!qCat} onClick={() => addMany((variants || []).filter((v) => P[v.productId]?.categoryId === qCat && P[v.productId]?.active !== false))}><Layers size={18} /> {t('labels.addCategory')}</button>
            </div>
            <p className="hint mt-2">{t('labels.quickHint')}</p>
          </div>

          <div className="card p-4">
            <SearchBox value={q} onChange={setQ} placeholder={t('labels.searchPh')} scanTarget />
            {results.length ? (
              <div className="mt-2 max-h-80 overflow-y-auto scroll-thin divide-y line">
                {results.map(({ p, vs }) => (
                  <div key={p.id} className="py-2 px-1">
                    <div className="flex items-center gap-3">
                      <ProductIcon icon={p.icon} color={cMap[p.categoryId]?.color} size={34} />
                      <span className="flex-1 min-w-0"><b className="block truncate">{t.name(p)}</b><span className="text-xs muted">{cMap[p.categoryId] ? t.name(cMap[p.categoryId]) : ''}</span></span>
                      {vs.length > 1 ? <button className="btn btn-ghost btn-sm" onClick={() => { addMany(vs); }}><Plus size={16} /> {t('labels.allSizes', { n: vs.length })}</button> : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 pl-11">
                      {sortVariants(vs).map((v) => (
                        <button key={v.id} onClick={() => add([v])} className="rounded-lg border-2 line px-2 py-1 text-xs font-bold hover:border-indigo-500" title={v.barcode}>
                          {[v.size, v.color].filter(Boolean).join(' · ') || t('labels.oneSize')} <span className="muted">({v.stock})</span> +
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted text-sm mt-2">{t('labels.scanHint')}</p>}
          </div>

          <div className="card overflow-hidden">
            {!rows.length ? <Empty icon={<Barcode size={28} />} title={t('labels.empty')} text={t('labels.emptyText')} /> : (<>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b line" style={{ background: 'var(--surface-2)' }}>
                <label className="flex items-center gap-2 font-bold text-sm cursor-pointer"><Check checked={allSel} indeterminate={!allSel && selRows.length > 0} onChange={(v) => setMany(rows.map((r) => r.variantId), { sel: v })} label={t('labels.selectAll')} /> {t('labels.selectAll')}</label>
                <span className="badge badge-blue">{t('labels.selectedCount', { n: selRows.length, total: rows.length, labels: selLabels })}</span>
                <span className="flex-1" />
                <button className="btn btn-ghost btn-sm" disabled={!selRows.length} onClick={() => setMany(selRows.map((r) => r.variantId), { copies: 1 })}>{t('labels.oneEach')}</button>
                <button className="btn btn-ghost btn-sm" disabled={!selRows.length} onClick={() => setMany(selRows.map((r) => r.variantId), (x) => ({ copies: copiesFor(V[x.variantId]) }))}>{t('labels.likeStock')}</button>
                <button className="btn btn-ghost btn-sm text-maroon-600" disabled={!selRows.length} onClick={() => removeIds(selRows.map((r) => r.variantId))}><Trash2 size={16} /> {t('labels.removeSelected')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setList([])}>{t('labels.clearAll')}</button>
              </div>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scroll-thin">
                <table className="table text-sm">
                  <thead><tr><th className="w-10" /><th>{t('prod.product')}</th><th>{t('prod.barcode')}</th><th className="text-right">{t('prod.price')}</th><th className="text-right">{t('labels.stock')}</th><th>{t('labels.copies')}</th><th /></tr></thead>
                  <tbody>
                    {groups.map((g) => {
                      const ids = g.rows.map((r) => r.variantId); const nSel = g.rows.filter((r) => r.sel).length;
                      const nLabels = g.rows.filter((r) => r.sel).reduce((s, r) => s + (Number(r.copies) || 0), 0);
                      return [
                        <tr key={'g' + g.id} className="bg-transparent">
                          <td style={{ background: (g.cat?.color || '#1F2A5C') + '14' }}><Check checked={nSel === g.rows.length} indeterminate={nSel > 0 && nSel < g.rows.length} onChange={(v) => setMany(ids, { sel: v })} label={g.cat ? t.name(g.cat) : t('labels.noCategory')} /></td>
                          <td colSpan={5} style={{ background: (g.cat?.color || '#1F2A5C') + '14' }}>
                            <span className="inline-flex items-center gap-2 font-bold" style={{ color: g.cat?.color }}><ItemIcon id={g.cat?.icon || 'tag'} size={18} /> {g.cat ? t.name(g.cat) : t('labels.noCategory')}</span>
                            <span className="muted text-xs ml-2">{t('labels.groupInfo', { n: g.rows.length, labels: nLabels })}</span>
                          </td>
                          <td className="text-right" style={{ background: (g.cat?.color || '#1F2A5C') + '14' }}><button className="icon-btn !w-9 !h-9 text-maroon-600" title={t('labels.removeGroup')} aria-label={t('labels.removeGroup')} onClick={() => removeIds(ids)}><Trash2 size={16} /></button></td>
                        </tr>,
                        ...g.rows.map((r) => {
                          const p = P[r.v.productId] || {};
                          return (
                            <tr key={r.variantId} className={r.sel ? '' : 'opacity-50'}>
                              <td><Check checked={!!r.sel} onChange={(v) => setRow(r.variantId, { sel: v })} label={p.nameEn} /></td>
                              <td><div className="flex items-center gap-2"><ProductIcon icon={p.icon} color={cMap[p.categoryId]?.color} size={30} /><div className="min-w-0"><b className="block truncate">{t.name(p)}</b><span className="text-xs muted">{[r.v.size, r.v.color].filter(Boolean).join(' · ')}{cfg.showCostCode && r.v.cost ? ` · ${costCode(r.v.cost, cfg.costCode)}` : ''}</span></div></div></td>
                              <td className="font-mono text-xs">{r.v.barcode}</td>
                              <td className="text-right">{num(r.v.price)}</td>
                              <td className="text-right muted">{r.v.stock}</td>
                              <td><div className="flex items-center gap-1">
                                <button className="btn btn-ghost btn-sm !px-2" aria-label="−" onClick={() => setRow(r.variantId, { copies: Math.max(0, (Number(r.copies) || 0) - 1) })}>−</button>
                                <input className="input !min-h-[2.1rem] w-14 text-center !px-1" inputMode="numeric" value={r.copies} onChange={(e) => setRow(r.variantId, { copies: Number(e.target.value.replace(/\D/g, '')) || 0, sel: true })} />
                                <button className="btn btn-ghost btn-sm !px-2" aria-label="+" onClick={() => setRow(r.variantId, { copies: (Number(r.copies) || 0) + 1, sel: true })}>+</button>
                              </div></td>
                              <td className="text-right"><button className="icon-btn !w-9 !h-9" onClick={() => removeIds([r.variantId])} aria-label={t('common.remove')} title={t('common.remove')}><Trash2 size={16} /></button></td>
                            </tr>
                          );
                        }),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            </>)}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <p className="font-display text-lg font-bold mb-3">{t('labels.preview')}</p>
            <div className="rounded-2xl p-4 grid place-items-center overflow-hidden" style={{ background: 'repeating-linear-gradient(45deg, var(--surface-2) 0 10px, var(--surface) 10px 20px)', minHeight: 160 }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', margin: `${(tpl.h * 3.78 * (scale - 1)) / 2}px 0` }}>
                <div className="bg-white shadow-lift" style={{ outline: '1px solid #ccc' }}>
                  {multi
                    ? <LabelRow items={previewItems.length ? previewItems : Array.from({ length: tpl.cols }, () => sample)} cfg={cfg} tpl={tpl} shop={settings.shop} cur={settings.currency} outline />
                    : <Label item={sample} cfg={cfg} tpl={tpl} shop={settings.shop} cur={settings.currency} />}
                </div>
              </div>
            </div>
            <p className="text-xs muted mt-2 text-center">{tpl.name}{multi ? ` · ${t('labels.pageSize')}: ${previewW} × ${tpl.h} mm` : ''}</p>
          </div>
          <div className="card p-4 space-y-2">
            <Field label={t('labels.size')}>
              <select className="input" value={cfg.template} onChange={(e) => setCfg({ template: e.target.value })}>
                {Object.entries(LABEL_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </Field>
            <Field label={t('labels.nameLang')}>
              <select className="input" value={cfg.nameLang} onChange={(e) => setCfg({ nameLang: e.target.value })}>
                <option value="en">English</option><option value="si">සිංහල</option>
              </select>
            </Field>
            <Field label={t('labels.barWidth')} hint={t('labels.barWidthHint')}>
              <select className="input" value={cfg.moduleMm} onChange={(e) => setCfg({ moduleMm: Number(e.target.value) })}>
                <option value={0.25}>0.25 mm ({t('labels.standard')})</option><option value={0.33}>0.33 mm</option><option value={0.375}>0.375 mm ({t('labels.bold')})</option>
              </select>
            </Field>
            {multi ? (
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-2)' }}>
                <p className="text-sm font-bold">{t('labels.alignTitle')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['gapMm', 'labels.gap'], ['leftMm', 'labels.left'], ['topMm', 'labels.top']].map(([k, l]) => (
                    <label key={k} className="block"><span className="text-xs font-bold">{t(l)}</span>
                      <input className="input !min-h-[2.25rem] !px-2" inputMode="decimal" value={cfg[k]} onChange={(e) => setCfg({ [k]: e.target.value.replace(/[^\d.-]/g, '') })} /></label>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[['leftMm', -0.5, '←'], ['leftMm', 0.5, '→'], ['topMm', -0.5, '↑'], ['topMm', 0.5, '↓']].map(([k, d, a]) => (
                    <button key={k + d} className="btn btn-ghost btn-sm text-lg" title={t('labels.nudge')} onClick={() => setCfg({ [k]: Math.round(((Number(cfg[k]) || 0) + d) * 10) / 10 })}>{a}</button>
                  ))}
                </div>
                <button className="btn btn-outline btn-sm w-full" onClick={() => printLabelAlignment(settings)}><Printer size={16} /> {t('labels.alignPrint')}</button>
                <p className="hint">{t('labels.alignHint')}</p>
              </div>
            ) : null}
            <Toggle label={t('labels.showCostCode')} checked={cfg.showCostCode} onChange={(v) => setCfg({ showCostCode: v })} />
            {cfg.showCostCode ? <p className="hint -mt-1">{t('labels.costCodeHint', { ex: costCode(sample.cost || 1500, cfg.costCode) || '—', cost: sample.cost || 1500 })}</p> : null}
            <Toggle label={t('labels.showShop')} checked={cfg.showShop} onChange={(v) => setCfg({ showShop: v })} />
            <Toggle label={t('labels.showPrice')} checked={cfg.showPrice} onChange={(v) => setCfg({ showPrice: v })} />
            <Toggle label={t('labels.showVariant')} checked={cfg.showVariant} onChange={(v) => setCfg({ showVariant: v })} />
          </div>
          <button className="btn btn-accent btn-lg w-full" disabled={!selLabels} onClick={doPrint}><Printer /> {t('labels.printSelected', { n: selLabels })}</button>
          <div className="rounded-2xl p-4 bg-indigo-50 dark:bg-indigo-800/40 text-sm flex gap-2"><Info size={18} className="shrink-0 mt-0.5" /><span>{t('labels.printerTip')}</span></div>
        </div>
      </div>
    </Page>
  );
}

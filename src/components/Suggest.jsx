import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A text box that shows a list of suggestions while typing.
// ↑ ↓ to move, Enter or click to choose, Esc to close. The list floats above the page
// (it is drawn outside tables), so it is never cut off.
export default function Suggest({ value, onChange, getItems, onPick, renderItem, className = '', placeholder, inputProps = {}, minChars = 1, autoFocus }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState(null);
  const items = open && String(value || '').trim().length >= minChars ? getItems(value) : [];

  const place = () => { const r = ref.current?.getBoundingClientRect(); if (r) setBox({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 300) }); };
  useLayoutEffect(() => { if (open) place(); }, [open, value]);
  useEffect(() => {
    if (!open) return undefined;
    const h = () => place();
    window.addEventListener('scroll', h, true); window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open]);
  useEffect(() => { setActive(0); }, [value]);
  const listRef = useRef(null);
  // keep the highlighted line visible when moving with the arrow keys in a long list
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const choose = (it) => { setOpen(false); onPick(it); };
  const onKeyDown = (e) => {
    if (open && items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); return; }
      if (e.key === 'Enter') { e.preventDefault(); choose(items[active]); return; }
    }
    if (e.key === 'Escape') setOpen(false);
    inputProps.onKeyDown?.(e);
  };

  return (
    <>
      <input ref={ref} {...inputProps} className={className} value={value} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKeyDown} />
      {open && items.length && box ? createPortal(
        <div ref={listRef} className="fixed z-[80] rounded-xl shadow-pop border line overflow-hidden anim-pop" role="listbox"
          style={{ left: box.left, top: box.top, width: box.width, maxHeight: 340, overflowY: 'auto', background: 'var(--surface)' }}>
          {items.map((it, i) => (
            <div key={i} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(it); }} onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 cursor-pointer ${i === active ? 'bg-indigo-50 dark:bg-indigo-800' : ''}`}>
              {renderItem(it, i === active)}
            </div>
          ))}
        </div>, document.body) : null}
    </>
  );
}

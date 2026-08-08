import { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import Spinner from './Spinner';

/**
 * Search karke chunne wala dropdown.
 *
 * fetchOptions(query) -> Promise<[{ value, label, sublabel, right, raw }]>
 *
 * Purchase rows (Part 5), cart (Part 6) aur invoice (Part 8) — teeno me yahi use hoga.
 */
export default function Combobox({
  value, display, onChange, fetchOptions, placeholder = 'Dhundhein...',
  label, required, error, emptyText = 'Kuch nahi mila', className, autoFocus, id,
  onCreateNew, createNewLabel = 'Naya banayein', disabled = false,
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState(null);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Dropdown ko portal me rakhte hain taaki table/modal ke overflow me na kate
  function place() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 4, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const id = setTimeout(() => {
      fetchOptions(query)
        .then((opts) => { if (alive) { setOptions(opts); setHighlight(0); } })
        .catch(() => { if (alive) setOptions([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [query, open, fetchOptions]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (e.target.closest?.('[data-combobox-list]')) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function pick(opt) {
    onChange(opt);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlight]) pick(options[highlight]);
    } else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  return (
    <div className={cn('w-full', className)} ref={wrapRef}>
      {/*
        Label ko id se jodna zaroori hai — warna screen reader ko bas "button"
        sunai deta hai, pata hi nahi chalta ki kaunsa field hai.
        "*" label ke bahar hai taaki label ka text saaf rahe.
      */}
      {label && (
        <div className="mb-1.5 flex items-center">
          <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
          {required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
        </div>
      )}

      <div className="relative">
        {open ? (
          <>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              id={fieldId}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="h-10 w-full rounded-lg border border-brand-400 bg-white pl-9 pr-8 text-sm focus-ring"
            />
            <button type="button" onClick={() => { setOpen(false); setQuery(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            id={fieldId}
            autoFocus={autoFocus}
            disabled={disabled}
            onClick={() => setOpen(true)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm focus-ring',
              error ? 'border-red-400' : 'border-slate-300 hover:border-slate-400',
              // Bill se aaya hua return — party aur item badalne nahi dena,
              // warna server "ye bill is retailer ka nahi hai" wala error deta hai
              disabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : 'bg-white'
            )}
          >
            <span className={cn('truncate', display ? 'text-slate-900' : 'text-slate-400')}>
              {display || placeholder}
            </span>
            {!disabled && <ChevronDown size={16} className="shrink-0 text-slate-400" />}
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && coords && createPortal(
        <div
          data-combobox-list
          role="listbox"
          aria-label={label ? `${label} ke options` : 'Options'}
          style={{ left: coords.left, top: coords.top, width: coords.width }}
          className="fixed z-[70] max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
              <Spinner size={16} /> Dhundh raha hoon...
            </div>
          ) : !options.length ? (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              {emptyText}
              {onCreateNew && (
                <button type="button" onClick={() => { onCreateNew(query); setOpen(false); }}
                  className="mt-2 block w-full rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
                  {createNewLabel}
                </button>
              )}
            </div>
          ) : (
            options.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(opt)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                  i === highlight ? 'bg-brand-50' : 'hover:bg-slate-50',
                  value === opt.value && 'font-medium'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-slate-900">{opt.label}</span>
                  {opt.sublabel && <span className="block truncate text-xs text-slate-500">{opt.sublabel}</span>}
                </span>
                {opt.right && <span className="shrink-0 text-xs text-slate-500">{opt.right}</span>}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

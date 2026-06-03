import { useEffect, useRef, useState } from 'react';
import { Loader2, Pill } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchMedicines } from '@/api';

/**
 * Medication-name input with Atlas-Search-backed autocomplete.
 *
 * Behaviour:
 *  - Fetches suggestions after the user has typed >= 2 chars (debounced 200ms).
 *  - Keyboard nav: ArrowUp / ArrowDown / Enter / Escape.
 *  - Picking a suggestion only fills the medication name — dosage, frequency,
 *    duration and instructions stay user-entered.
 */
export function MedicineNameInput({
  id,
  value,
  onChange,
  placeholder = 'e.g. Augmentin 625 Duo Tablet',
  required = false,
  className,
  ...inputProps
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const requestSeqRef = useRef(0);
  const lastPickedRef = useRef('');

  useEffect(() => {
    const trimmed = (value || '').trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return undefined;
    }
    if (trimmed === lastPickedRef.current) {
      // User just selected this exact suggestion — don't reopen the dropdown.
      return undefined;
    }

    setLoading(true);
    const seq = ++requestSeqRef.current;
    const handle = setTimeout(async () => {
      try {
        const res = await searchMedicines(trimmed, 10);
        if (seq !== requestSeqRef.current) return;
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setResults(data);
        setOpen(data.length > 0);
        setActiveIdx(data.length > 0 ? 0 : -1);
      } catch (_err) {
        if (seq !== requestSeqRef.current) return;
        setResults([]);
        setOpen(false);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [value]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(name) {
    if (!name) return;
    lastPickedRef.current = name;
    onChange(name);
    setOpen(false);
    setResults([]);
    setActiveIdx(-1);
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && activeIdx < results.length) {
        e.preventDefault();
        pick(results[activeIdx].name);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Input
        id={id}
        autoComplete="off"
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          lastPickedRef.current = '';
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="bg-background pr-9"
        {...inputProps}
      />
      {loading ? (
        <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}

      {open && results.length > 0 ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {results.map((m, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                type="button"
                key={m._id || `${m.name}-${idx}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  // mousedown so the click registers before the input blurs
                  e.preventDefault();
                  pick(m.name);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/60'
                )}
              >
                <Pill className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{m.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default MedicineNameInput;

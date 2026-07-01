import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Phone, Search, User, X } from 'lucide-react';

import * as api from '../../api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function initialsOf(name) {
  if (!name) return '?';
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

/**
 * Compact, single-select patient picker for the billing module.
 *
 * - Loads a chunk of patients up-front and runs a server-side search as
 *   the user types (debounced 250ms).
 * - Once a patient is selected, the trigger renders a richer chip with
 *   name, phone and a "Change" button.
 */
export function PatientPicker({ clinicId, value, onChange, autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const inputRef = useRef(null);

  // Initial / debounced search.
  useEffect(() => {
    if (!clinicId) return undefined;
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      const params = { clinicId, limit: 25 };
      const q = query.trim();
      if (q) params.search = q;
      api
        .getPatients(params)
        .then((res) => {
          if (cancelled) return;
          const payload = res.data?.data;
          if (Array.isArray(payload)) {
            setSearched(payload);
          } else if (Array.isArray(payload?.patients)) {
            setSearched(payload.patients);
          } else if (Array.isArray(payload?.groups)) {
            const rows = [];
            payload.groups.forEach((g) =>
              (g.patients || []).forEach((p) => rows.push(p)),
            );
            setSearched(rows);
          } else {
            setSearched([]);
          }
        })
        .catch(() => {
          if (!cancelled) setSearched([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [clinicId, query]);

  // Hydrate from an externally-supplied value (e.g. ?patientId=… prefill).
  useEffect(() => {
    if (!value) {
      setSelectedPatient(null);
      return;
    }
    if (selectedPatient && selectedPatient._id === value) return;
    if (!clinicId) return;
    let cancelled = false;
    api
      .getPatient(value)
      .then((res) => {
        if (!cancelled) setSelectedPatient(res.data?.data || null);
      })
      .catch(() => {
        if (!cancelled) setSelectedPatient(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, clinicId, selectedPatient]);

  const list = useMemo(() => searched.slice(0, 25), [searched]);

  function pick(p) {
    setSelectedPatient(p);
    onChange?.(p);
    setOpen(false);
    setQuery('');
  }

  if (selectedPatient) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-primary/5 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
              {initialsOf(selectedPatient.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">
                {selectedPatient.name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                <Check className="size-3" /> Selected
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
              {selectedPatient.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3" /> {selectedPatient.phone}
                </span>
              ) : null}
              {selectedPatient.age ? (
                <span className="inline-flex items-center gap-1">
                  · {selectedPatient.age} yrs
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedPatient(null);
            onChange?.(null);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <X className="size-3.5" /> Change
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search patient by name or phone"
            className="h-10 pl-9 pr-9"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {list.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {loading ? 'Searching…' : 'No matches.'}
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto p-1">
            {list.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {initialsOf(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground tabular-nums">
                      {p.phone || '—'}
                    </div>
                  </div>
                  <User className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

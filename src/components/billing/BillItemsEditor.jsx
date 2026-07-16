import { useMemo, useState } from 'react';
import {
  ChevronDown,
  GripVertical,
  Pill,
  Plus,
  Search,
  Sparkles,
  Stethoscope,
  Trash2,
  Type,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatInr } from './billUtils';

/**
 * Editable line items table for the bill builder.
 *
 * Props
 *   - items:           current line items array
 *   - onChange(items): replace the items array
 *   - treatments:      catalogue rows used by the "Pick from catalogue" picker
 *
 * Each line stores:
 *   { type, treatmentId?, name, description?, quantity, unitPrice }
 */
export function BillItemsEditor({ items, onChange, treatments }) {
  function addItem(item) {
    onChange([...items, item]);
  }
  function updateItem(idx, patch) {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function removeItem(idx) {
    const next = items.slice();
    next.splice(idx, 1);
    onChange(next);
  }
  function addTreatment(t) {
    addItem({
      type: 'TREATMENT',
      treatmentId: t._id,
      name: t.name,
      description: t.description || '',
      quantity: 1,
      unitPrice: Number(t.price) || 0,
    });
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">No items yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a treatment from your catalogue, a medication, or a custom line.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[1fr_70px_120px_120px_40px] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Item</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Unit price</div>
            <div className="text-right">Amount</div>
            <div />
          </div>
          <ul className="divide-y">
            {items.map((it, idx) => {
              const lineTotal =
                Number(it.quantity || 0) * Number(it.unitPrice || 0);
              return (
                <li
                  key={idx}
                  className="grid grid-cols-[1fr_70px_120px_120px_40px] items-start gap-2 px-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <ItemTypeIcon type={it.type} />
                      <Input
                        value={it.name}
                        onChange={(e) =>
                          updateItem(idx, { name: e.target.value })
                        }
                        placeholder="Item name"
                        className="h-8"
                        readOnly={it.type === 'TREATMENT' && !!it.treatmentId}
                      />
                    </div>
                    <Input
                      value={it.description || ''}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                      placeholder="Optional description"
                      className="h-7 text-[12px]"
                    />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={it.quantity ?? 1}
                    onChange={(e) =>
                      updateItem(idx, {
                        quantity: Math.max(
                          1,
                          Math.floor(Number(e.target.value) || 1),
                        ),
                      })
                    }
                    className="h-8 text-right tabular-nums"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={it.unitPrice ?? 0}
                    onChange={(e) =>
                      updateItem(idx, {
                        unitPrice: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="h-8 text-right tabular-nums"
                  />
                  <div className="flex h-8 items-center justify-end text-sm font-medium tabular-nums">
                    {formatInr(lineTotal)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(idx)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TreatmentPicker treatments={treatments} onPick={addTreatment} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="size-3.5" /> Add other line
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem
              onSelect={() =>
                addItem({
                  type: 'MEDICATION',
                  name: '',
                  description: '',
                  quantity: 1,
                  unitPrice: 0,
                })
              }
            >
              <Pill className="size-3.5" /> Medication
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                addItem({
                  type: 'CUSTOM',
                  name: '',
                  description: '',
                  quantity: 1,
                  unitPrice: 0,
                })
              }
            >
              <Type className="size-3.5" /> Custom item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ItemTypeIcon({ type }) {
  if (type === 'MEDICATION') {
    return (
      <span
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600"
        title="Medication"
      >
        <Pill className="size-3.5" />
      </span>
    );
  }
  if (type === 'CUSTOM') {
    return (
      <span
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600"
        title="Custom item"
      >
        <Type className="size-3.5" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
      title="Treatment"
    >
      <Stethoscope className="size-3.5" />
    </span>
  );
}

function TreatmentPicker({ treatments, onPick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const active = useMemo(
    () => (treatments || []).filter((t) => t.isActive !== false),
    [treatments],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter((t) => (t.name || '').toLowerCase().includes(q));
  }, [active, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" size="sm">
          <Sparkles className="size-3.5" /> Add treatment
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search treatments…"
              className="h-8 pl-8 pr-2 text-sm"
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {active.length === 0
              ? 'No treatments configured yet.'
              : 'No matches.'}
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto p-1">
            {filtered.map((t) => (
              <li key={t._id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(t);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex-1 truncate">{t.name}</span>
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {formatInr(t.price)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

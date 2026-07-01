import { BadgePercent, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatInr } from './billUtils';

/**
 * Bill-level discount control. Either a flat ₹ amount or a percentage —
 * picking one resets the other so the totals never apply both. An
 * optional `reason` note travels with the bill.
 */
export function DiscountEditor({ discount, onChange, subtotal }) {
  const value = discount || { type: 'NONE', value: 0, reason: '' };
  const isActive = value.type !== 'NONE';

  function setType(type) {
    if (type === 'NONE') {
      onChange({ type: 'NONE', value: 0, reason: '' });
      return;
    }
    onChange({ ...value, type, value: 0 });
  }

  function setValue(v) {
    let n = Number(v);
    if (!Number.isFinite(n) || n < 0) n = 0;
    if (value.type === 'PERCENT') n = Math.min(100, n);
    onChange({ ...value, value: n });
  }

  const previewAmount =
    value.type === 'PERCENT'
      ? (Number(subtotal) * Number(value.value)) / 100
      : value.type === 'FLAT'
        ? Number(value.value)
        : 0;
  const clamped = Math.min(previewAmount || 0, Number(subtotal) || 0);

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BadgePercent className="size-4 text-primary" /> Discount
        </div>
        {isActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setType('NONE')}
          >
            <X className="size-3" /> Remove
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Type
          </Label>
          <Select value={value.type} onValueChange={setType}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">None</SelectItem>
              <SelectItem value="PERCENT">Percentage</SelectItem>
              <SelectItem value="FLAT">Flat amount</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={cn('space-y-1.5', !isActive && 'opacity-50')}>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {value.type === 'PERCENT' ? 'Percent (%)' : 'Amount (₹)'}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={value.type === 'PERCENT' ? 1 : '0.01'}
            max={value.type === 'PERCENT' ? 100 : undefined}
            value={value.value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!isActive}
            placeholder={value.type === 'PERCENT' ? '10' : '500'}
            className="h-9 tabular-nums"
          />
        </div>

        <div className={cn('space-y-1.5', !isActive && 'opacity-50')}>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Reason (optional)
          </Label>
          <Input
            value={value.reason || ''}
            onChange={(e) => onChange({ ...value, reason: e.target.value })}
            disabled={!isActive}
            placeholder="e.g. Senior citizen, loyalty"
            className="h-9"
          />
        </div>
      </div>

      {isActive ? (
        <p className="text-[11px] text-muted-foreground">
          Will reduce the bill by{' '}
          <span className="font-semibold text-foreground tabular-nums">
            {formatInr(clamped)}
          </span>
          .
        </p>
      ) : null}
    </div>
  );
}

import { STATUS_META } from './billUtils';
import { cn } from '@/lib/utils';

/**
 * Compact coloured status pill — used everywhere a bill is shown in a
 * list (Billing page, patient detail tab, dashboard).
 */
export function StatusPill({ status, className }) {
  const meta = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
        meta.className,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

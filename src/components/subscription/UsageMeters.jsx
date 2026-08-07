import { HardDrive, MessageCircle, Stethoscope, UserCog } from 'lucide-react';

import { usePlanUsage } from '../../hooks/usePlanUsage';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/plans';

/**
 * Usage against plan limits, as progress bars.
 *
 * Amber past 80% and red at the limit, so a clinic finds out it's running out of
 * WhatsApp messages or storage before a send or an upload fails rather than
 * after. `storageOnly` renders just the storage bar, for the compact card on
 * Settings.
 */
export function UsageMeters({ storageOnly = false, className }) {
  // A failed fetch resolves to null and the section simply doesn't render — not
  // worth a toast, since nothing the clinic was trying to do has broken.
  const { usage, loading } = usePlanUsage();

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: storageOnly ? 1 : 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!usage) return null;

  const meters = [
    {
      key: 'storage',
      label: 'File storage',
      icon: HardDrive,
      meter: usage.storage,
      format: formatBytes,
    },
    {
      key: 'doctors',
      label: 'Doctors',
      icon: Stethoscope,
      meter: usage.doctors,
    },
    {
      key: 'staffUsers',
      label: 'Staff accounts',
      icon: UserCog,
      meter: usage.staffUsers,
    },
    {
      key: 'whatsappMessages',
      label: 'WhatsApp messages this month',
      icon: MessageCircle,
      meter: usage.whatsappMessages,
    },
  ].filter((m) => (storageOnly ? m.key === 'storage' : true));

  return (
    <div className={cn('space-y-4', className)}>
      {meters.map(({ key, label, icon: Icon, meter, format }) => (
        <Meter key={key} label={label} icon={Icon} meter={meter} format={format} />
      ))}
    </div>
  );
}

function Meter({ label, icon: Icon, meter, format }) {
  const fmt = format || ((n) => Number(n).toLocaleString('en-IN'));
  const unlimited = meter.limit === null;
  const percent = unlimited ? 0 : Math.min(meter.percentUsed, 100);

  const tone = unlimited
    ? 'bg-primary'
    : percent >= 100
      ? 'bg-destructive'
      : percent >= 80
        ? 'bg-[color:var(--status-noshow)]'
        : 'bg-primary';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span className="font-medium tabular-nums">
          {unlimited
            ? `${fmt(meter.used)} used`
            : `${fmt(meter.used)} of ${fmt(meter.limit)}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${unlimited ? 100 : Math.max(percent, 2)}%` }}
        />
      </div>
      {!unlimited && meter.isAtLimit ? (
        <p className="text-xs text-destructive">
          You've reached your plan limit. Upgrade to add more.
        </p>
      ) : null}
      {unlimited ? (
        <p className="text-xs text-muted-foreground">Unlimited on your plan</p>
      ) : null}
    </div>
  );
}

export default UsageMeters;

import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * "2 of 3 doctors" next to a create button, turning into a warning at the limit.
 *
 * The point is to answer "can I add another?" before the user opens a form and
 * fills it in. Renders nothing on unlimited plans, where the count is noise.
 */
export function CapacityHint({ meter, noun, className }) {
  if (!meter || meter.limit === null) return null;

  const atLimit = meter.isAtLimit;
  const nearLimit = !atLimit && meter.remaining <= 1;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        atLimit ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {atLimit ? <AlertTriangle className="size-3.5" /> : null}
      <span className="tabular-nums">
        {meter.used} of {meter.limit} {noun}
      </span>
      {atLimit || nearLimit ? (
        <Link
          to="/settings/plans"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {atLimit ? 'Upgrade to add more' : 'Upgrade'}
        </Link>
      ) : null}
    </span>
  );
}

/** Badge form, for table headers and tab labels where an inline sentence is too wide. */
export function CapacityBadge({ meter, className }) {
  if (!meter || meter.limit === null) return null;
  return (
    <Badge
      variant={meter.isAtLimit ? 'danger' : 'outline'}
      className={cn('tabular-nums', className)}
    >
      {meter.used}/{meter.limit}
    </Badge>
  );
}

export default CapacityHint;

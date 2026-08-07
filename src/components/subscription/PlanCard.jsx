import { Check, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRupees, priceFor } from '@/lib/plans';

/**
 * One pricing tier.
 *
 * The MRP is struck through next to the live price so the discount is visible
 * without a separate "save X%" badge competing for attention. On yearly, that
 * struck price is 12x the monthly rate, which makes the free month the thing
 * being communicated.
 */
export function PlanCard({
  plan,
  billingCycle,
  isCurrent,
  isPending,
  busy,
  disabled,
  onSelect,
  ctaLabel,
}) {
  const price = priceFor(plan.code, billingCycle);
  const isYearly = billingCycle === 'yearly';

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border bg-card p-6 transition-shadow',
        plan.popular && 'border-primary/50 shadow-md',
        isCurrent && 'border-primary ring-1 ring-primary/30',
      )}
    >
      {plan.popular && !isCurrent ? (
        <Badge className="absolute -top-2.5 left-6">Most popular</Badge>
      ) : null}
      {isCurrent ? (
        <Badge variant="soft" className="absolute -top-2.5 left-6">
          Current plan
        </Badge>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
      </div>

      <div className="mt-5 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">
            {formatRupees(price.amount)}
          </span>
          <span className="text-sm text-muted-foreground">
            {isYearly ? '/year' : '/month'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground line-through">
            {formatRupees(price.mrp)}
          </span>
          <span className="font-medium text-primary">
            Save {formatRupees(price.savings)}
          </span>
        </div>
        {isYearly ? (
          <p className="text-xs text-muted-foreground">
            Works out to {formatRupees(price.perMonth)} a month
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        className="mt-5 w-full"
        variant={plan.popular || isCurrent ? 'default' : 'outline'}
        disabled={disabled || busy || isCurrent}
        onClick={() => onSelect?.(plan.code)}
      >
        {busy ? 'Opening checkout…' : ctaLabel}
      </Button>

      {isPending ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3" />
          Waiting for your bank to confirm this change
        </p>
      ) : null}

      <ul className="mt-6 space-y-2.5 text-sm">
        {plan.featureList.map((feature) => (
          <li key={feature.label} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">
              {feature.label}
              {feature.comingSoon ? (
                <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                  Coming soon
                </Badge>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlanCard;

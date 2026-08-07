import { Fragment } from 'react';
import { Check, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { COMPARISON_GROUPS, PLAN_ORDER, PLANS } from '@/lib/plans';

/**
 * Full side-by-side plan comparison, rendered under the plan cards.
 *
 * The cards carry the highlights; this is for the person who wants to check one
 * specific thing before committing. Rows come from `COMPARISON_GROUPS` in the
 * plan catalog so the table can't drift from the entitlements it describes.
 */
export function FeatureComparison({ currentPlanCode, className }) {
  const plans = PLAN_ORDER.map((code) => PLANS[code]);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="w-[38%] py-3 text-left font-medium text-muted-foreground">
              Compare plans
            </th>
            {plans.map((plan) => (
              <th key={plan.code} className="py-3 text-left font-semibold">
                <span className="flex items-center gap-2">
                  {plan.name}
                  {plan.code === currentPlanCode ? (
                    <Badge variant="soft" className="text-[10px]">
                      Current
                    </Badge>
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_GROUPS.map((group) => (
            <Fragment key={group.title}>
              <tr className="bg-muted/40">
                <td
                  colSpan={plans.length + 1}
                  className="px-1 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {group.title}
                </td>
              </tr>
              {group.rows.map((row) => (
                <tr key={`${group.title}-${row.label}`} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {row.label}
                    {row.comingSoon ? (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Coming soon
                      </Badge>
                    ) : null}
                  </td>
                  {plans.map((plan) => (
                    <td key={plan.code} className="py-2.5 pr-4">
                      <ComparisonValue value={row.value(plan)} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Booleans render as a tick or a dash; anything else prints as-is. */
function ComparisonValue({ value }) {
  if (value === true) return <Check className="size-4 text-primary" />;
  if (value === false || value == null) {
    return <Minus className="size-4 text-muted-foreground/50" />;
  }
  return <span className="font-medium">{value}</span>;
}

export default FeatureComparison;

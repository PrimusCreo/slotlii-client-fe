import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Lock } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@/lib/permissions';
import { onPlanRestriction } from '@/lib/planRestrictions';
import { formatBytes, getPlan, priceFor, formatRupees } from '@/lib/plans';

/**
 * Global handler for plan restrictions raised by any API call.
 *
 * Mounted once near the router. The axios interceptor pushes restrictions here
 * through `lib/planRestrictions`, so a blocked action explains itself with real
 * numbers and a route to fixing it instead of a toast the user can't act on.
 */
export function UpgradeDialogHost() {
  const [restriction, setRestriction] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuth();

  useEffect(() => onPlanRestriction(setRestriction), []);

  // On the Plans page the restriction is self-evident and the dialog would just
  // cover the thing the clinic came here to do.
  const onPlansPage = location.pathname === '/settings/plans';
  const open = Boolean(restriction) && !onPlansPage;

  if (!restriction) return null;

  const copy = restrictionCopy(restriction);
  const canManage = can(PERMISSIONS.SUBSCRIPTION_MANAGE);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setRestriction(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="size-4" />
          </div>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        {copy.detail ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {copy.detail}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setRestriction(null)}>
            Not now
          </Button>
          {canManage ? (
            <Button
              onClick={() => {
                setRestriction(null);
                navigate('/settings/plans');
              }}
            >
              {copy.cta} <ArrowUpRight className="size-4" />
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function restrictionCopy({ code, message, meta }) {
  const requiredPlan = getPlan(meta.requiredPlan);

  if (code === 'SUBSCRIPTION_INACTIVE') {
    return {
      title: 'Your subscription is not active',
      body: message,
      detail:
        'Everything you have already entered stays exactly where it is and remains readable. Only adding and editing is paused.',
      cta: 'Choose a plan',
    };
  }

  if (code === 'PLAN_FEATURE_LOCKED') {
    return {
      title: `${meta.featureName || 'This feature'} needs a bigger plan`,
      body: message,
      detail: requiredPlan
        ? `${requiredPlan.name} is ${formatRupees(
            priceFor(requiredPlan.code, 'monthly').amount,
          )} a month, or 11 months' price when billed yearly.`
        : null,
      cta: requiredPlan ? `Upgrade to ${requiredPlan.name}` : 'View plans',
    };
  }

  // PLAN_LIMIT_EXCEEDED — show exactly what's full and by how much.
  const isStorage = meta.limitKey === 'maxStorageBytes';
  const fmt = isStorage
    ? formatBytes
    : (n) => Number(n || 0).toLocaleString('en-IN');

  return {
    title: "You've reached your plan limit",
    body: message,
    detail:
      meta.limit != null ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Currently using</span>
          <span className="font-medium tabular-nums">
            {fmt(meta.current)} of {fmt(meta.limit)}
          </span>
        </div>
      ) : null,
    cta: requiredPlan ? `Upgrade to ${requiredPlan.name}` : 'View plans',
  };
}

export default UpgradeDialogHost;

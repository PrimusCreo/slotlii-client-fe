import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CreditCard, Sparkles } from 'lucide-react';

import { useClinic } from '../../context/ClinicContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/**
 * Billing state strip shown above the Dashboard.
 *
 * Deliberately quiet while there's plenty of trial left — a banner that's always
 * there stops being read. It appears in the last stretch of the trial and
 * whenever the subscription actually needs attention.
 *
 * Shape follows `WhatsAppSetupBanner` in `pages/Dashboard.jsx`; there's no shared
 * banner component in this codebase yet.
 */
const TRIAL_NUDGE_DAYS = 7;

export function SubscriptionBanner({ className }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { subscription } = useClinic();

  if (!subscription) return null;

  const copy = bannerCopy(subscription);
  if (!copy) return null;

  // Staff without billing rights would land on a page they can't act on, so
  // they get the message without a dead-end button.
  const canManage = can(PERMISSIONS.SUBSCRIPTION_MANAGE);

  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        copy.urgent
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-primary/20 bg-primary/5',
        className,
      )}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            copy.urgent
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary',
          )}
        >
          <copy.icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{copy.title}</p>
          <p className="text-xs text-muted-foreground">{copy.body}</p>
        </div>
      </div>
      {canManage ? (
        <Button
          size="sm"
          variant={copy.urgent ? 'destructive' : 'default'}
          onClick={() => navigate('/settings/plans')}
        >
          {copy.cta} <ArrowRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

function bannerCopy(subscription) {
  const { status, trialDaysRemaining, cancelAtPeriodEnd, planName } = subscription;

  if (status === 'trialing') {
    if (trialDaysRemaining === null || trialDaysRemaining > TRIAL_NUDGE_DAYS) {
      return null;
    }
    const days =
      trialDaysRemaining <= 0
        ? 'today'
        : trialDaysRemaining === 1
          ? 'tomorrow'
          : `in ${trialDaysRemaining} days`;
    return {
      icon: Sparkles,
      urgent: trialDaysRemaining <= 2,
      title: `Your free trial ends ${days}`,
      body: 'Pick a plan to keep adding appointments, patients, and records. Nothing you have entered is lost.',
      cta: 'Choose a plan',
    };
  }

  if (status === 'expired') {
    return {
      icon: AlertTriangle,
      urgent: true,
      title: 'Your trial has ended',
      body: 'You can still view everything, but adding new records is paused until you choose a plan.',
      cta: 'Choose a plan',
    };
  }

  if (status === 'past_due') {
    return {
      icon: AlertTriangle,
      urgent: true,
      title: 'We could not collect your last payment',
      body: 'Adding new records is paused. Re-authorise your payment method to pick up where you left off.',
      cta: 'Fix payment',
    };
  }

  if (status === 'cancelled') {
    return {
      icon: AlertTriangle,
      urgent: true,
      title: 'Your subscription was cancelled',
      body: 'Everything is still here to read. Choose a plan to start adding records again.',
      cta: 'Choose a plan',
    };
  }

  if (status === 'on_hold') {
    return {
      icon: AlertTriangle,
      urgent: true,
      title: 'Your subscription is paused',
      body: 'Your payment mandate is on hold, so adding new records is paused too.',
      cta: 'Resume plan',
    };
  }

  if (status === 'bank_approval_pending') {
    return {
      icon: CreditCard,
      urgent: false,
      title: 'Waiting on your bank',
      body: 'Your payment mandate is being approved. This usually clears within a working day and needs nothing from you.',
      cta: 'View status',
    };
  }

  // Active but winding down — worth flagging once, since the clinic will
  // otherwise be surprised when writes stop at the end of the period.
  if (status === 'active' && cancelAtPeriodEnd) {
    return {
      icon: AlertTriangle,
      urgent: false,
      title: `Your ${planName} plan ends at the end of this billing period`,
      body: 'You keep full access until then. Reactivate any time to stay on.',
      cta: 'Reactivate',
    };
  }

  return null;
}

export default SubscriptionBanner;

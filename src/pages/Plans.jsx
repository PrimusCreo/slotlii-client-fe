import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Info, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BillingCycleToggle } from '../components/subscription/BillingCycleToggle';
import { FeatureComparison } from '../components/subscription/FeatureComparison';
import { PlanCard } from '../components/subscription/PlanCard';
import { UsageMeters } from '../components/subscription/UsageMeters';
import { startSubscriptionCheckout } from '../components/subscription/cashfreeCheckout';
import { PLAN_ORDER, PLANS, formatRupees, rankOf } from '@/lib/plans';

const STATUS_LABEL = {
  trialing: { label: 'Free trial', variant: 'soft' },
  active: { label: 'Active', variant: 'success' },
  bank_approval_pending: { label: 'Awaiting bank approval', variant: 'warning' },
  past_due: { label: 'Payment failed', variant: 'danger' },
  on_hold: { label: 'Paused', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  expired: { label: 'Expired', variant: 'danger' },
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Plans() {
  const { subscription, reloadClinic } = useClinic();
  const [searchParams, setSearchParams] = useSearchParams();

  const [billingCycle, setBillingCycle] = useState('monthly');
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Default the toggle to whatever they're already paying on, so a yearly
  // customer isn't shown monthly prices for their own plan.
  useEffect(() => {
    if (subscription?.billingCycle) setBillingCycle(subscription.billingCycle);
  }, [subscription?.billingCycle]);

  const loadPayments = useCallback(() => {
    setPaymentsLoading(true);
    api
      .getSubscriptionPayments()
      .then((res) => setPayments(res.data.data || []))
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  /**
   * Cashfree redirects back here after the mandate is authorised. Rather than
   * waiting on webhook delivery — which can lag, and for eNACH waits on a bank —
   * ask the backend to re-read the mandate so the page reflects reality now.
   */
  useEffect(() => {
    if (!searchParams.has('cf')) return;
    setSyncing(true);
    api
      .syncSubscription()
      .then(() => reloadClinic())
      .catch(() => {
        toast.error(
          'We could not confirm your payment yet. It may take a moment to arrive.',
        );
      })
      .finally(() => {
        setSyncing(false);
        loadPayments();
        // Clear the marker so a refresh doesn't re-trigger the sync.
        const next = new URLSearchParams(searchParams);
        next.delete('cf');
        setSearchParams(next, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPlanCode = subscription?.planCode || null;
  const status = subscription?.status;
  const statusMeta = STATUS_LABEL[status] || { label: status, variant: 'outline' };

  /**
   * A trialing clinic is nominally "on" a plan but hasn't chosen one, so every
   * card offers a choice rather than one showing as current.
   */
  const isTrialing = status === 'trialing';

  const plans = useMemo(() => PLAN_ORDER.map((code) => PLANS[code]), []);

  async function handleSelect(planCode) {
    setCheckoutPlan(planCode);
    try {
      const res = await api.createSubscriptionCheckout(planCode, billingCycle);
      await startSubscriptionCheckout(res.data.data);
      // The SDK redirects, so anything after this only runs if it didn't.
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        err.message ||
        'Could not start checkout. Please try again.',
      );
      setCheckoutPlan(null);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.cancelSubscription();
      await reloadClinic();
      toast.success('Your plan will not renew. You keep access until it ends.');
      setCancelOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not cancel your plan.');
    } finally {
      setCancelling(false);
    }
  }

  function ctaLabelFor(planCode) {
    if (isTrialing) return 'Start on this plan';
    if (planCode === currentPlanCode) {
      return billingCycle === subscription?.billingCycle
        ? 'Current plan'
        : `Switch to ${billingCycle}`;
    }
    return rankOf(planCode) > rankOf(currentPlanCode) ? 'Upgrade' : 'Downgrade';
  }

  return (
    <Layout title="Plan & billing">
      <div className="grid gap-6">
        <CurrentPlanCard
          subscription={subscription}
          statusMeta={statusMeta}
          syncing={syncing}
          onCancel={() => setCancelOpen(true)}
        />

        {/* <div className="flex justify-center pt-2">
          <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              billingCycle={billingCycle}
              isCurrent={
                !isTrialing &&
                plan.code === currentPlanCode &&
                billingCycle === subscription?.billingCycle
              }
              isPending={subscription?.pendingChange?.planCode === plan.code}
              busy={checkoutPlan === plan.code}
              disabled={Boolean(checkoutPlan)}
              ctaLabel={ctaLabelFor(plan.code)}
              onSelect={handleSelect}
            />
          ))}
        </div> */}

        {/* <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Payment mandates are tied to a plan, so changing plans authorises a new
          one and takes effect from your next billing period. Prices are inclusive
          of applicable taxes.
        </p> */}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Your usage this period</CardTitle>
            <CardDescription>
              What you're using against the limits on your current plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <UsageMeters />
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader className="border-b">
            <CardTitle>Compare plans</CardTitle>
            <CardDescription>
              Every limit and feature, side by side.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <FeatureComparison currentPlanCode={currentPlanCode} />
          </CardContent>
        </Card> */}

        {/* <PaymentHistoryCard payments={payments} loading={paymentsLoading} /> */}
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your plan?</DialogTitle>
            <DialogDescription>
              Your payment mandate will be cancelled and nothing more will be
              debited. You keep full access until{' '}
              <strong>{formatDate(subscription?.currentPeriodEnd)}</strong>, and
              your data stays exactly where it is afterwards — you just won't be
              able to add new records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep my plan
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Cancel plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function CurrentPlanCard({ subscription, statusMeta, syncing, onCancel }) {
  if (!subscription) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  const {
    planName,
    billingCycle,
    status,
    trialDaysRemaining,
    currentPeriodEnd,
    trialEndsAt,
    amount,
    cancelAtPeriodEnd,
  } = subscription;

  const isTrialing = status === 'trialing';

  const renewalLabel = isTrialing
    ? 'Trial ends'
    : cancelAtPeriodEnd
      ? 'Access ends'
      : 'Renews on';
  const renewalDate = isTrialing ? trialEndsAt : currentPeriodEnd;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            {/* A trial isn't a plan they hold, so it's never titled with the
                plan name — that reads as a paid tier they were given. */}
            {isTrialing ? 'Free trial' : planName}
            {isTrialing ? null : (
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            )}
            {syncing ? (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Confirming payment…
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>
            {isTrialing
              ? trialDaysRemaining === 0
                ? `Your trial ends today. Choose a plan below to carry on — you currently have ${planName}-level access.`
                : `${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'day' : 'days'
                } left, with ${planName}-level access and no card needed. Choose a plan below to continue after that.`
              : `Billed ${billingCycle === 'yearly' ? 'yearly' : 'monthly'}${amount ? ` at ${formatRupees(amount)}` : ''
              }.`}
          </CardDescription>
        </div>
        {status === 'active' && !cancelAtPeriodEnd ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel plan
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
        <Stat
          label="Plan"
          value={isTrialing ? 'Not chosen yet' : planName}
        />
        <Stat
          label="Billing"
          value={
            isTrialing
              ? 'Nothing to pay yet'
              : billingCycle === 'yearly'
                ? 'Yearly'
                : 'Monthly'
          }
        />
        <Stat label={renewalLabel} value={formatDate(renewalDate)} />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function PaymentHistoryCard({ payments, loading }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="size-4" />
          Payment history
        </CardTitle>
        <CardDescription>
          Every charge Slotlii has collected for this clinic.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payments yet. Charges will appear here once your plan starts.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment._id}>
                  <TableCell>{formatDate(payment.paidAt || payment.createdAt)}</TableCell>
                  <TableCell className="capitalize">
                    {payment.planCode} · {payment.billingCycle}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatRupees(payment.amount)}
                  </TableCell>
                  <TableCell>
                    {payment.status === 'success' ? (
                      <span className="flex items-center gap-1.5 text-[color:var(--status-completed)]">
                        <CheckCircle2 className="size-3.5" />
                        Paid
                      </span>
                    ) : (
                      <Badge
                        variant={
                          payment.status === 'pending' ? 'warning' : 'danger'
                        }
                      >
                        {payment.status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

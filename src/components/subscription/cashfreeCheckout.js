/**
 * Cashfree mandate authorisation.
 *
 * The SDK is loaded on demand rather than at app start — most sessions never
 * open the Plans page, and this keeps a payment vendor's script off the critical
 * path for everyone else.
 *
 * The redirect flow is used deliberately over a modal: UPI Autopay and eNACH
 * both hand off to a bank or UPI app, which iframes handle badly on mobile. The
 * clinic lands back on `/settings/plans?cf=return`, where the page calls
 * `syncSubscription()` rather than waiting on webhook delivery.
 */

import { load } from '@cashfreepayments/cashfree-js';

let sdkPromise = null;

function getSdk(mode) {
  if (!sdkPromise) sdkPromise = load({ mode });
  return sdkPromise;
}

/**
 * Send the clinic to Cashfree to authorise the mandate.
 *
 * @param {object} session — the `/subscription/checkout` response payload
 */
export async function startSubscriptionCheckout(session) {
  if (!session?.subscriptionSessionId) {
    throw new Error('Checkout could not be started — no session was returned.');
  }

  const mode = session.cashfreeEnv === 'production' ? 'production' : 'sandbox';
  const cashfree = await getSdk(mode);

  return cashfree.subscriptionsCheckout({
    subsSessionId: session.subscriptionSessionId,
    redirectTarget: '_self',
  });
}

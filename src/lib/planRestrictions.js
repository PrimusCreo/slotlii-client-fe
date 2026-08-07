/**
 * Bridge between the axios interceptor and the global upgrade dialog.
 *
 * The interceptor lives outside React, so it can't call a hook or set state.
 * This is a one-subscriber event bus: `UpgradeDialogHost` registers a listener
 * on mount, and the interceptor pushes plan restrictions into it. Restrictions
 * raised before the host mounts are held and replayed, so nothing is lost during
 * the first render.
 */

/** Error codes the backend uses for plan restrictions, from `utils/planErrors.js`. */
export const RESTRICTION_CODES = [
  'PLAN_LIMIT_EXCEEDED',
  'PLAN_FEATURE_LOCKED',
  'SUBSCRIPTION_INACTIVE',
];

let listener = null;
let pending = null;

export function onPlanRestriction(handler) {
  listener = handler;
  if (pending) {
    const replay = pending;
    pending = null;
    handler(replay);
  }
  return () => {
    if (listener === handler) listener = null;
  };
}

export function emitPlanRestriction(restriction) {
  if (listener) listener(restriction);
  else pending = restriction;
}

/**
 * Pull a restriction out of an axios error, or null if it isn't one. Exported so
 * a page can handle a restriction inline (showing remaining capacity next to a
 * button, say) instead of letting the global dialog take over.
 */
export function parsePlanRestriction(error) {
  const data = error?.response?.data;
  if (!data?.code || !RESTRICTION_CODES.includes(data.code)) return null;
  return {
    code: data.code,
    message: data.error || 'Your plan does not allow this.',
    meta: data.meta || {},
  };
}

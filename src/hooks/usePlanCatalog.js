import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import * as api from '../api';

/**
 * The sellable plan tiers, fetched from `GET /api/subscription/plans`.
 *
 * The catalog lives in the database so platform admins can reprice and retire
 * tiers without a deploy — which means the frontend can't keep a copy of it. Each
 * tier arrives with `pricing.monthly` and `pricing.yearly` already worked out, so
 * nothing here recomputes a price.
 *
 * Cached at module scope because several components on the same page want the
 * same list (the cards, the comparison table, the upgrade dialog) and the tiers
 * don't change while someone is looking at them. Reload the page to refetch.
 */
let cached = null;
let inFlight = null;

function fetchCatalog() {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = api
      .getPlans()
      .then((res) => {
        cached = {
          plans: res.data.data?.plans || [],
          paymentsEnabled: Boolean(res.data.data?.paymentsEnabled),
        };
        return cached;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function usePlanCatalog() {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(
    cached || { plans: [], paymentsEnabled: false },
  );
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    // `/subscription/plans` is behind JWT. Fetching it from globally mounted
    // hosts (upgrade dialog) while logged out 401s and must not run on
    // /login — that was the refresh loop.
    if (!isAuthenticated) {
      setLoading(false);
      return undefined;
    }
    if (cached) {
      setState(cached);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchCatalog()
      .then((data) => {
        if (!cancelled) setState(data);
      })
      // A failed fetch leaves the list empty. The backend is the real enforcement
      // point, so showing nothing beats showing prices we aren't sure of.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return { ...state, loading };
}

export default usePlanCatalog;

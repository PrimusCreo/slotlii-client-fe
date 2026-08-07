import { useCallback, useEffect, useState } from 'react';

import * as api from '../api';

/**
 * Current usage against plan limits for the signed-in clinic.
 *
 * Pages that can create limited things (doctors, staff accounts) use this to say
 * how much room is left before the user fills in a form, rather than letting the
 * backend reject the save. A failed fetch resolves to `null` and callers fall
 * back to showing nothing — the backend is still the real enforcement point.
 */
export function usePlanUsage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      api
        .getSubscriptionUsage()
        .then((res) => {
          setUsage(res.data.data || null);
        })
        .catch(() => setUsage(null))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .getSubscriptionUsage()
      .then((res) => {
        if (!cancelled) setUsage(res.data.data || null);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { usage, loading, refresh };
}

export default usePlanUsage;

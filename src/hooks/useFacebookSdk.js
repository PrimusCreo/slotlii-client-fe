import { useEffect, useState } from 'react';

const SDK_SCRIPT_ID = 'facebook-jssdk';
const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';

let sdkLoadPromise = null;

/**
 * Lazily injects the Facebook JS SDK and initializes it for the configured
 * App ID. Safe to call from multiple components — the script is only
 * injected once and the initialization is memoized.
 *
 * @returns {{ ready: boolean, error: Error | null, FB: typeof window.FB | undefined }}
 */
export function useFacebookSdk() {
  const [ready, setReady] = useState(
    typeof window !== 'undefined' && Boolean(window.FB)
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.FB) {
      setReady(true);
      return;
    }

    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    const version =
      import.meta.env.VITE_META_GRAPH_API_VERSION || 'v22.0';

    if (!appId) {
      setError(
        new Error(
          'VITE_FACEBOOK_APP_ID is not set. Add it to your .env to enable Embedded Signup.'
        )
      );
      return;
    }

    if (!sdkLoadPromise) {
      sdkLoadPromise = new Promise((resolve, reject) => {
        window.fbAsyncInit = function fbAsyncInit() {
          try {
            window.FB.init({
              appId,
              cookie: true,
              xfbml: false,
              version,
            });
            resolve(window.FB);
          } catch (initErr) {
            reject(initErr);
          }
        };

        const existing = document.getElementById(SDK_SCRIPT_ID);
        if (existing) return;

        const script = document.createElement('script');
        script.id = SDK_SCRIPT_ID;
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.src = SDK_SRC;
        script.onerror = () =>
          reject(new Error('Failed to load Facebook JS SDK'));
        document.body.appendChild(script);
      });
    }

    sdkLoadPromise
      .then(() => setReady(true))
      .catch((err) => setError(err));
  }, []);

  return { ready, error, FB: typeof window !== 'undefined' ? window.FB : undefined };
}

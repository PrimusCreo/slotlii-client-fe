import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { useAuth } from './AuthContext';
import * as api from '../api';

const NotificationContext = createContext(null);

const MAX_CACHED = 50;
const SOUND_SRC = '/notification.mp3';
const SOUND_STORAGE_KEY = 'slotlii_notification_sound';

/**
 * Truncated title used inside the toast + browser notification. Keeps
 * long "Consent signed — [very long patient name]" strings from wrapping
 * onto three lines in the corner of the screen.
 */
function truncate(str, max = 80) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/**
 * Deep-dedupe notifications by `_id`. The initial fetch + the first few
 * SSE events after (re)connecting can otherwise race and produce dupes.
 */
function mergeUnique(existing, incoming) {
  const map = new Map();
  for (const n of incoming) {
    if (!n?._id) continue;
    map.set(String(n._id), n);
  }
  for (const n of existing) {
    if (!n?._id) continue;
    const id = String(n._id);
    if (!map.has(id)) map.set(id, n);
  }
  return Array.from(map.values())
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, MAX_CACHED);
}

function readSoundPref() {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SOUND_STORAGE_KEY);
    // Default: sound ON. Only an explicit '0' disables it.
    return raw !== '0';
  } catch {
    return true;
  }
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(readSoundPref);

  // Set of subscribers keyed by "*" or a specific event type. We use refs
  // so registering/unregistering a subscriber inside an effect doesn't
  // retrigger the SSE connection.
  const subscribersRef = useRef(new Set());
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const backoffMsRef = useRef(1000);
  // Latest `openStream` reference — used inside the `error` handler so
  // the setTimeout closure always calls the current version instead of a
  // stale one captured when the callback was first created.
  const openStreamRef = useRef(null);
  // Lazily-created Audio element so we don't preload the mp3 until the
  // first live notification actually arrives.
  const audioRef = useRef(null);
  // Latest sound-enabled flag, exposed via ref so the incoming-notification
  // callback (memoized on mount) always reads the current value.
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(SOUND_SRC);
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 0.6;
      }
      // Rewind so back-to-back events don't get swallowed.
      audioRef.current.currentTime = 0;
      const p = audioRef.current.play();
      if (p && typeof p.catch === 'function') {
        // Browsers reject audio.play() before any user gesture — swallow
        // that so the console isn't spammed. Sound will start working on
        // the very next click anywhere in the app.
        p.catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, []);

  const dispatch = useCallback((notification) => {
    for (const entry of subscribersRef.current) {
      try {
        if (!entry.types || entry.types.includes(notification.type)) {
          entry.handler(notification);
        }
      } catch (err) {
        console.error('Notification subscriber failed', err);
      }
    }
  }, []);

  const showToastFor = useCallback((notification) => {
    toast(truncate(notification.title, 90), {
      description: notification.body ? truncate(notification.body, 140) : undefined,
    });
  }, []);

  const showBrowserNotificationFor = useCallback((notification) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;
    // Only fire the OS notification if the tab is hidden — otherwise the
    // in-page toast is enough and stacking both feels spammy.
    if (typeof document !== 'undefined' && !document.hidden) return;
    try {
      const n = new window.Notification(truncate(notification.title, 90), {
        body: notification.body ? truncate(notification.body, 140) : undefined,
        tag: `slotlii:${notification.type}:${notification._id}`,
        icon: '/favicon.ico',
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.warn('Failed to show browser notification', err);
    }
  }, []);

  const handleIncoming = useCallback(
    (notification) => {
      setNotifications((prev) => mergeUnique(prev, [notification]));
      if (!notification.readAt) {
        setUnreadCount((c) => c + 1);
      }
      showToastFor(notification);
      showBrowserNotificationFor(notification);
      playSound();
      dispatch(notification);
    },
    [dispatch, showToastFor, showBrowserNotificationFor, playSound],
  );

  const loadInitial = useCallback(async () => {
    try {
      const res = await api.getNotifications({ limit: MAX_CACHED });
      const data = res.data?.data || [];
      setNotifications(mergeUnique([], data));
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch (err) {
      // 401 is handled by the axios interceptor; anything else just leaves
      // the bell empty — the SSE stream can still populate it live.
      console.warn('Failed to load initial notifications', err?.message);
    }
  }, []);

  const openStream = useCallback(() => {
    const url = api.notificationStreamUrl();
    if (!url) return;

    // Close any previous connection before opening a new one so we never
    // end up with two open EventSources (e.g. after a token refresh).
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        /* ignore */
      }
      esRef.current = null;
    }

    let es;
    try {
      es = new EventSource(url);
    } catch (err) {
      console.warn('EventSource construction failed', err);
      return;
    }
    esRef.current = es;

    es.addEventListener('open', () => {
      setConnected(true);
      backoffMsRef.current = 1000;
    });
    es.addEventListener('hello', () => {
      setConnected(true);
      backoffMsRef.current = 1000;
    });
    es.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncoming(data);
      } catch (err) {
        console.warn('Malformed SSE notification payload', err);
      }
    });
    es.addEventListener('error', () => {
      setConnected(false);
      // The browser's EventSource retries automatically for network
      // hiccups, but if the server closes the connection (e.g. deploy),
      // its state becomes CLOSED and we have to reopen manually with
      // exponential backoff capped at ~30s.
      if (es.readyState === EventSource.CLOSED) {
        try {
          es.close();
        } catch {
          /* ignore */
        }
        esRef.current = null;
        const wait = Math.min(backoffMsRef.current, 30_000);
        backoffMsRef.current = Math.min(wait * 2, 30_000);
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          openStreamRef.current?.();
        }, wait);
      }
    });
  }, [handleIncoming]);

  // Keep the latest openStream reachable from stable closures (the
  // reconnect setTimeout above) without adding openStream to their deps.
  useEffect(() => {
    openStreamRef.current = openStream;
  }, [openStream]);

  // Open (and close) the SSE stream in lockstep with the auth state.
  useEffect(() => {
    if (!isAuthenticated || !user || user.role === 'platform_admin') {
      // Not a clinic user — nothing to stream.
      setNotifications([]);
      setUnreadCount(0);
      setConnected(false);
      if (esRef.current) {
        try {
          esRef.current.close();
        } catch {
          /* ignore */
        }
        esRef.current = null;
      }
      clearTimeout(reconnectTimerRef.current);
      return undefined;
    }

    loadInitial();
    openStream();

    return () => {
      clearTimeout(reconnectTimerRef.current);
      if (esRef.current) {
        try {
          esRef.current.close();
        } catch {
          /* ignore */
        }
        esRef.current = null;
      }
    };
    // We only care about the identity + role fields on `user`. Depending
    // on the full object would reopen the SSE stream every time any
    // profile field (e.g. name) is refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.userId, user?.role, loadInitial, openStream]);

  const markRead = useCallback(async (id) => {
    // Optimistic update — the bell should feel snappy even on slow links.
    setNotifications((prev) =>
      prev.map((n) => (String(n._id) === String(id) && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(c - 1, 0));
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.warn('Failed to mark notification read', err?.message);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      console.warn('Failed to mark all notifications read', err?.message);
    }
  }, []);

  const subscribe = useCallback((typesOrHandler, maybeHandler) => {
    // Overload: subscribe(handler) or subscribe(['a', 'b'], handler)
    let types = null;
    let handler = null;
    if (typeof typesOrHandler === 'function') {
      handler = typesOrHandler;
    } else {
      types = Array.isArray(typesOrHandler) ? typesOrHandler : null;
      handler = maybeHandler;
    }
    if (typeof handler !== 'function') {
      return () => {};
    }
    const entry = { types, handler };
    subscribersRef.current.add(entry);
    return () => {
      subscribersRef.current.delete(entry);
    };
  }, []);

  const setSoundEnabled = useCallback((next) => {
    setSoundEnabledState((prev) => {
      const value = typeof next === 'function' ? next(prev) : !!next;
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, value ? '1' : '0');
      } catch {
        /* ignore quota / disabled storage */
      }
      // Nudge the audio element to unlock playback on this same user
      // gesture — otherwise the first real notification would still be
      // silenced by the browser's autoplay policy.
      if (value) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio(SOUND_SRC);
            audioRef.current.preload = 'auto';
            audioRef.current.volume = 0.6;
          }
          audioRef.current.muted = true;
          const p = audioRef.current.play();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.muted = false;
            }).catch(() => {
              audioRef.current.muted = false;
            });
          }
        } catch {
          /* ignore */
        }
      }
      return value;
    });
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (window.Notification.permission !== 'default') {
      return window.Notification.permission;
    }
    try {
      return await window.Notification.requestPermission();
    } catch (err) {
      console.warn('Notification permission request failed', err);
      return window.Notification.permission;
    }
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      connected,
      soundEnabled,
      setSoundEnabled,
      markRead,
      markAllRead,
      subscribe,
      refresh: loadInitial,
      requestBrowserPermission,
    }),
    [
      notifications,
      unreadCount,
      connected,
      soundEnabled,
      setSoundEnabled,
      markRead,
      markAllRead,
      subscribe,
      loadInitial,
      requestBrowserPermission,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within NotificationProvider',
    );
  }
  return ctx;
}

/**
 * Convenience hook — refetches by calling `fn` (debounced) whenever a
 * matching notification arrives. Pass a single type string, an array of
 * types, or nothing to receive every event.
 */
export function useRefetchOnEvent(types, fn) {
  const { subscribe } = useNotifications();
  // Latest-fn ref so callers don't need to memoize their refetcher.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    const list = Array.isArray(types) ? types : types ? [types] : null;
    let timer = null;
    const unsub = subscribe(list, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          fnRef.current?.();
        } catch (err) {
          console.warn('useRefetchOnEvent handler threw', err);
        }
      }, 300);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, JSON.stringify(types)]);
}

export default NotificationContext;

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'slotlii-theme';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => undefined,
  toggleTheme: () => undefined,
});

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(resolved) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children, defaultTheme = 'system' }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return window.localStorage.getItem(STORAGE_KEY) || defaultTheme;
  });

  const resolvedTheme = useMemo(
    () => (theme === 'system' ? getSystemTheme() : theme),
    [theme],
  );

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeClass(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

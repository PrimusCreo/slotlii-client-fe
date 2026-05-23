import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Right-side slideshow used by Login / Signup.
 *
 * Pulls every image from `src/assets/login_slides/` via Vite's
 * `import.meta.glob`, so dropping a new file in that folder is enough — no
 * code edits required. Files are sorted by filename, so `slide_01.png`,
 * `slide_02.png`, … advance in order.
 *
 * Behavior:
 *   - Auto-advances every `intervalMs` (default 5s) with a crossfade.
 *   - Pauses when the user hovers the panel, or when the browser tab is
 *     hidden (saves work + prevents the slide jumping the moment you
 *     come back).
 *   - Respects `prefers-reduced-motion`: no fade transition, no auto-play.
 *   - Clickable dots let users jump to a specific slide.
 */

const SLIDE_MODULES = import.meta.glob(
  '../assets/login_slides/*.{png,jpg,jpeg,webp,gif,avif}',
  { eager: true, query: '?url', import: 'default' }
);

const SLIDES = Object.entries(SLIDE_MODULES)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, url]) => ({
    url,
    name: path.split('/').pop().replace(/\.[^.]+$/, ''),
  }));

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function AuthSlideshow({
  intervalMs = 5000,
  className = '',
  ariaLabel = 'Slotlii product highlights',
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(prefersReducedMotion());

  const slides = SLIDES;
  const count = slides.length;

  const goTo = useCallback(
    (next) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  // Pause when tab is hidden so the user doesn't return to a random slide.
  useEffect(() => {
    function handleVisibility() {
      setPaused(document.hidden);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion.current) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, paused, intervalMs]);

  // Stable list of preloaded <img> nodes — never re-render the <img> tags,
  // only toggle opacity, so the browser doesn't refetch and the crossfade
  // is buttery on slow networks.
  const layers = useMemo(
    () =>
      slides.map((slide, i) => ({
        key: slide.url,
        src: slide.url,
        name: slide.name,
        active: i === index,
      })),
    [slides, index]
  );

  if (count === 0) {
    return (
      <div
        className={`flex h-full items-center justify-center bg-muted text-sm text-muted-foreground ${className}`}
      >
        No slides found in <code className="mx-1">src/assets/login_slides/</code>
      </div>
    );
  }

  return (
    <div
      className={`relative isolate h-full w-full overflow-hidden bg-muted ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      {layers.map((layer) => (
        <img
          key={layer.key}
          src={layer.src}
          alt={layer.name}
          draggable={false}
          className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-700 ease-out ${
            layer.active ? 'opacity-100' : 'opacity-0'
          } ${reducedMotion.current ? 'transition-none' : ''}`}
          aria-hidden={!layer.active}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-2">
          {slides.map((slide, i) => {
            const active = i === index;
            return (
              <button
                key={slide.url}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show slide ${i + 1} of ${count}`}
                aria-current={active}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active
                    ? 'w-8 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]'
                    : 'w-1.5 bg-white/60 hover:bg-white/80'
                }`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

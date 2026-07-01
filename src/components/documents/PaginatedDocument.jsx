import { useLayoutEffect, useMemo, useRef, useState } from 'react';

// A4 physical size at 96 DPI — matches the letterhead source width so
// an uploaded 794×107 strip lands 1:1 across the page. Actual on-screen
// pages are scaled down responsively via CSS transform so the layout
// still fits narrow viewports; measurement always happens at 794 so
// the pack result is deterministic across screen sizes and matches
// what a headless-browser (Puppeteer) render at 794 will produce.
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
export const LETTERHEAD_ASPECT = 794 / 107;
export const LETTERHEAD_RESERVE_HEIGHT = PAGE_WIDTH / LETTERHEAD_ASPECT; // ~107

const PAGE_PADDING_X = 40;
const PAGE_PADDING_Y = 32;

// A slim white strip pinned to the very bottom of every page carrying
// the page counter (left) and "Generated with ❤ by Slotlii" (right).
// The clinic's letterhead footer / fallback footer sits just above it
// so neither runs into the sheet edge.
const SYSTEM_FOOTER_HEIGHT = 24;

/**
 * A block is an atomic slice of the document. The consumer pre-splits
 * anything that shouldn't live as one indivisible piece — e.g. the
 * medicine table becomes { header row, med row 1, med row 2, ... },
 * so the packer can place a subset of rows on one page and the rest
 * on the next.
 *
 * Each block has an optional `after` hook so the consumer can inject
 * a "continued on next page" separator visually (currently unused).
 *
 * @typedef {Object} DocumentBlock
 * @property {string} id  Stable identifier — used as React key.
 * @property {React.ReactNode} node  What to render for this block.
 * @property {boolean} [breakAfter]  Force a page break after this block.
 */

/**
 * Renders an ordered list of `blocks` as a stack of A4-sized "pages"
 * with a repeating header / footer on each page. Google-Docs style:
 * pages sit on a light grey backdrop, each has a subtle drop shadow,
 * and a "Page X of Y" pill lives below every page in preview mode.
 *
 * Pagination is done client-side: on mount we render every block off
 * screen at 794px width, measure its height with getBoundingClientRect,
 * then pack blocks greedily into fixed-height content regions. This
 * runs on every re-render but is cheap in practice because prescription
 * and bill documents rarely exceed a few dozen blocks.
 *
 * The `mode` prop toggles between:
 *   - "preview": chrome, drop-shadow, page counter, responsive width
 *   - "print":   flat pages, no chrome, always 794px wide (used by the
 *                headless browser print route so Chrome's `page.pdf`
 *                treats each `.pd-page` div as one PDF page).
 */
export function PaginatedDocument({
  blocks,
  letterheadHeaderUrl,
  letterheadFooterUrl,
  renderFallbackHeader,
  renderFallbackFooter,
  mode = 'preview',
  onReady,
}) {
  // Grouped page assignments — `null` until the first measurement pass
  // has run. We render the measurement pane and the final pages from
  // the same JSX tree so the height numbers we read match what will
  // land on screen (same fonts, same styles, same width).
  const [pages, setPages] = useState(null);
  const measureRef = useRef(null);
  const fallbackHeaderRef = useRef(null);
  const fallbackFooterRef = useRef(null);

  // Recompute the packing whenever the block list or letterhead
  // presence changes. `blocks.length + join(ids)` is a cheap signature
  // that catches list-level edits (added / removed / reordered items).
  const blocksKey = useMemo(() => blocks.map((b) => b.id).join('|'), [blocks]);

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const container = measureRef.current;
    const nodes = container.querySelectorAll('[data-block-idx]');
    const heights = new Array(blocks.length).fill(0);
    nodes.forEach((n) => {
      const idx = Number(n.dataset.blockIdx);
      if (!Number.isFinite(idx)) return;
      // getBoundingClientRect returns fractional pixels; ceiling keeps
      // us on the safe side of the content bound and avoids underflow
      // rounding that would let a block overshoot its page.
      heights[idx] = Math.ceil(n.getBoundingClientRect().height);
    });

    const headerReserve = letterheadHeaderUrl
      ? Math.ceil(LETTERHEAD_RESERVE_HEIGHT)
      : Math.ceil(
        fallbackHeaderRef.current?.getBoundingClientRect().height || 0,
      );
    const footerReserve = letterheadFooterUrl
      ? Math.ceil(LETTERHEAD_RESERVE_HEIGHT)
      : Math.ceil(
        fallbackFooterRef.current?.getBoundingClientRect().height || 0,
      );

    const contentMax =
      PAGE_HEIGHT -
      headerReserve -
      footerReserve -
      SYSTEM_FOOTER_HEIGHT -
      PAGE_PADDING_Y * 2;

    const packed = [];
    let current = [];
    let currentH = 0;
    for (let i = 0; i < blocks.length; i += 1) {
      const h = heights[i];
      // A single block taller than the content region is unavoidable
      // — dump it on its own page so downstream blocks still get a
      // clean start. This handles gigantic prescription tables where
      // a single row happened to wrap across many lines.
      if (h > contentMax && current.length === 0) {
        packed.push([i]);
        continue;
      }
      if (currentH + h > contentMax && current.length > 0) {
        packed.push(current);
        current = [i];
        currentH = h;
      } else {
        current.push(i);
        currentH += h;
      }
      if (blocks[i].breakAfter) {
        packed.push(current);
        current = [];
        currentH = 0;
      }
    }
    if (current.length) packed.push(current);
    if (packed.length === 0) packed.push([]);

    setPages(packed);
    if (onReady) onReady({ pageCount: packed.length });
    // `onReady` and `blocks` are intentionally omitted — `blocksKey`
    // captures content invalidations and `onReady` is a fresh callback
    // on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksKey, letterheadHeaderUrl, letterheadFooterUrl]);

  const containerClass =
    mode === 'print'
      ? 'flex flex-col items-center'
      : 'flex flex-col items-center gap-6 bg-muted/40 py-6';

  return (
    <div className={containerClass} data-doc-container>
      {/* Hidden measurement pane. Positioned absolutely so it doesn't
          push the visible pages around, but rendered in the same DOM
          tree so it inherits the parent's font stack / CSS. */}
      <div
        aria-hidden
        ref={measureRef}
        style={{
          position: 'absolute',
          left: -10000,
          top: 0,
          width: PAGE_WIDTH - PAGE_PADDING_X * 2,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {blocks.map((b, i) => (
          <div key={b.id} data-block-idx={i}>
            {b.node}
          </div>
        ))}
        {!letterheadHeaderUrl && renderFallbackHeader ? (
          <div
            ref={fallbackHeaderRef}
            style={{ width: PAGE_WIDTH, paddingInline: PAGE_PADDING_X }}
          >
            {renderFallbackHeader({ pageIndex: 0, pageCount: 1 })}
          </div>
        ) : null}
        {!letterheadFooterUrl && renderFallbackFooter ? (
          <div
            ref={fallbackFooterRef}
            style={{ width: PAGE_WIDTH, paddingInline: PAGE_PADDING_X }}
          >
            {renderFallbackFooter({ pageIndex: 0, pageCount: 1 })}
          </div>
        ) : null}
      </div>

      {pages
        ? pages.map((indices, pi) => (
          <PageFrame
            key={pi}
            pageIndex={pi}
            pageCount={pages.length}
            mode={mode}
            letterheadHeaderUrl={letterheadHeaderUrl}
            letterheadFooterUrl={letterheadFooterUrl}
            renderFallbackHeader={renderFallbackHeader}
            renderFallbackFooter={renderFallbackFooter}
          >
            {indices.map((idx) => (
              <div key={blocks[idx].id}>{blocks[idx].node}</div>
            ))}
          </PageFrame>
        ))
        : null}
    </div>
  );
}

/**
 * One physical A4 sheet. Kept as a pure layout wrapper — the packing
 * logic lives one level up so this component doesn't have to know
 * about heights or blocks, only about how a page is drawn.
 *
 * `pd-page` class is used by the print CSS to force a page break
 * before every page except the first (see the print route).
 */
function PageFrame({
  pageIndex,
  pageCount,
  mode,
  letterheadHeaderUrl,
  letterheadFooterUrl,
  renderFallbackHeader,
  renderFallbackFooter,
  children,
}) {
  const isPrint = mode === 'print';
  const pageStyle = {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    // On mobile / narrow screens the page shrinks to fit but keeps
    // its aspect ratio via CSS-only. `transform: scale()` would break
    // measurement — instead we use `maxWidth: 100%` and let the outer
    // stack manage horizontal overflow.
    maxWidth: isPrint ? undefined : '100%',
  };

  return (
    <>
      <div
        className={
          isPrint
            ? 'pd-page relative bg-white'
            : 'pd-page relative overflow-hidden bg-white shadow-md ring-1 ring-black/5'
        }
        style={pageStyle}
        data-page-index={pageIndex}
        data-page-count={pageCount}
      >
        {/* Header slot — letterhead image if uploaded, else the caller's
            fallback header (auto-generated clinic block). */}
        {letterheadHeaderUrl ? (
          <img
            src={letterheadHeaderUrl}
            alt=""
            className="block w-full select-none"
            style={{ aspectRatio: '794 / 107' }}
            draggable={false}
          />
        ) : renderFallbackHeader ? (
          renderFallbackHeader({ pageIndex, pageCount })
        ) : null}

        {/* Content region — everything that lives between the header
            and the footer. Vertical padding matches PAGE_PADDING_Y so
            it stays in lockstep with the packer's content budget. */}
        <div
          style={{
            paddingLeft: PAGE_PADDING_X,
            paddingRight: PAGE_PADDING_X,
            paddingTop: PAGE_PADDING_Y,
            paddingBottom: PAGE_PADDING_Y,
          }}
        >
          {children}
        </div>

        {/* Letterhead / fallback footer slot — lifted just above the
            system-footer strip so it never runs into the sheet edge.
            `position: absolute` + `bottom: SYSTEM_FOOTER_HEIGHT` keeps
            the markup order sane (header, body, footer) while pinning
            it to a consistent vertical position across pages. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: SYSTEM_FOOTER_HEIGHT,
          }}
        >
          {letterheadFooterUrl ? (
            <img
              src={letterheadFooterUrl}
              alt=""
              className="block w-full select-none"
              style={{ aspectRatio: '794 / 107' }}
              draggable={false}
            />
          ) : renderFallbackFooter ? (
            renderFallbackFooter({ pageIndex, pageCount })
          ) : null}
        </div>

        {/* System footer — thin white strip pinned to the very bottom
            of the sheet. Page counter on the left, tiny attribution
            with a heart on the right. Always white so it doesn't
            fight coloured letterheads directly above it. */}
        <div
          className="pd-system-footer"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: SYSTEM_FOOTER_HEIGHT,
            paddingLeft: PAGE_PADDING_X,
            paddingRight: PAGE_PADDING_X,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#6b7280',
            backgroundColor: '#ffffff',
          }}
        >
          <span>
            Page {pageIndex + 1} of {pageCount}
          </span>
          <span>
            Powered by{' '}
            <span style={{ fontWeight: 600, color: '#fe6e00' }}>Slotlii</span>
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * A CSS-only fallback that lays out the given content as one long
 * scroll (single "page"). Used before measurement completes so the
 * document isn't visually blank on the first paint.
 */
export function DocumentSkeleton() {
  return (
    <div className="flex justify-center bg-muted/40 py-6">
      <div
        className="animate-pulse bg-white shadow-md"
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, maxWidth: '100%' }}
      />
    </div>
  );
}

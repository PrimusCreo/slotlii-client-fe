/**
 * Browser-side mirror of the backend's tiny Markdown subset renderer.
 *
 * Outputs sanitized HTML safe for `dangerouslySetInnerHTML`. We deliberately
 * support a small grammar (headings, **bold**, *italic*, lists, paragraphs)
 * and escape everything else, so staff-authored template bodies can never
 * inject raw HTML or scripts into the signing page or viewer.
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

/** Substitute `{{key}}` from a Map or plain object. */
export function fillPlaceholders(body, values) {
  if (!body) return '';
  const get = (k) => {
    if (!values) return '';
    if (values instanceof Map) return values.get(k) || '';
    return values[k] || '';
  };
  return String(body).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key) => {
    const v = get(key);
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Returns deduped, order-preserving `{{placeholder}}` names. */
export function extractPlaceholders(body) {
  if (!body) return [];
  const seen = new Set();
  const out = [];
  const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const key = m[1];
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/**
 * Returns deduped, order-preserving variable keys extracted from a stored
 * `bodyHtml` (the rich-text editor output). Mirrors the server helper so
 * the two stay in lock-step.
 */
export function extractHtmlVariableKeys(html) {
  if (!html) return [];
  const re = /<span\b[^>]*\bdata-variable\s*=\s*"([\w.-]+)"[^>]*>[\s\S]*?<\/span>/gi;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const k = m[1];
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/**
 * Replace `<span data-variable="key">…</span>` chips in a rich-text body
 * with the filled value wrapped in `<strong>`. Used by the on-screen
 * consent document. Empty values render as a placeholder line so the
 * document layout stays visually consistent before signing.
 */
export function fillHtmlVariables(html, values) {
  if (!html) return '';
  const get = (k) => {
    if (!values) return '';
    if (values instanceof Map) return values.get(k) || '';
    return values[k] || '';
  };
  return String(html).replace(
    /<span\b[^>]*\bdata-variable\s*=\s*"([\w.-]+)"[^>]*>[\s\S]*?<\/span>/gi,
    (_m, key) => {
      const v = get(key);
      const text = v === undefined || v === null ? '' : String(v);
      if (!text) return '<strong>__________</strong>';
      return `<strong>${escapeHtml(text)}</strong>`;
    },
  );
}

/** Render the supported subset of Markdown to safe HTML. */
export function markdownToHtml(markdown) {
  if (!markdown) return '';
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = (lines[i] || '').trimEnd();
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      html.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      html.push(
        `<ul>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ul>`,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      html.push(
        `<ol>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ol>`,
      );
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s)/.test(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    html.push(`<p>${paragraph.map(renderInline).join('<br />')}</p>`);
  }

  return html.join('\n');
}

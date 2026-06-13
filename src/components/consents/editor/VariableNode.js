import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Variable — an inline atomic node that renders as a chip like {patient name}
 * and serialises to `<span data-variable="key" data-label="label">{label}</span>`.
 *
 * The chip is atomic so cursor navigation and Backspace treat it as a single
 * indivisible unit, mirroring the UX of Notion / Linear / Zoho-style inline
 * tokens.
 */
export const Variable = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      varKey: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-variable') || '',
        renderHTML: (attrs) => ({ 'data-variable': attrs.varKey || '' }),
      },
      label: {
        default: '',
        parseHTML: (el) =>
          el.getAttribute('data-label') ||
          (el.textContent || '').replace(/^\{|\}$/g, ''),
        renderHTML: (attrs) => ({ 'data-label': attrs.label || '' }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
        getAttrs: (el) => ({
          varKey: el.getAttribute('data-variable') || '',
          label: el.getAttribute('data-label') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const label = node.attrs.label || node.attrs.varKey || '';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'consent-variable-chip',
        contenteditable: 'false',
      }),
      `{${label}}`,
    ];
  },

  addCommands() {
    return {
      insertVariable:
        ({ varKey, label }) =>
        ({ chain }) => {
          if (!varKey) return false;
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: { varKey, label: label || varKey },
            })
            .run();
        },
    };
  },
});

export default Variable;

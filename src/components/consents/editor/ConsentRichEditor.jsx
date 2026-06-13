import { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  ChevronDown,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Plus,
  Sparkles,
  Underline as UnderlineIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Variable } from './VariableNode';

/**
 * WYSIWYG editor used for authoring consent form templates.
 *
 * - Outputs sanitized-friendly HTML (paragraphs, bold/italic, lists, headings,
 *   plus `<span data-variable>` chips).
 * - "+ Insert variable" dropdown lists the variables already defined on the
 *   template plus a "New variable…" affordance that calls back into the
 *   parent to open the add-variable form.
 */
export function ConsentRichEditor({
  value,
  onChange,
  variables = [],
  onAddNewVariable,
  onReady,
  placeholder = 'Type the consent form text here. Use "+ Insert variable" to add fields like procedure type, place, time…',
  minHeight = 360,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We use a custom heading style on h2 to mirror the document
        // accent colour; disable h4+ which we don't render in the doc.
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Variable,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'consent-editor-prose focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
  });

  // Sync external `value` changes back into the editor without losing the
  // user's cursor when they're actively typing. We only push when the
  // incoming HTML genuinely differs from what's already inside.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  // Expose the editor instance up to the parent (used for "click a variable
  // in the panel to insert it" and any future imperative actions).
  useEffect(() => {
    if (editor && typeof onReady === 'function') onReady(editor);
  }, [editor, onReady]);

  const variableItems = useMemo(
    () => (Array.isArray(variables) ? variables.filter((v) => v?.key) : []),
    [variables],
  );

  function insertVariable(v) {
    if (!editor || !v?.key) return;
    editor
      .chain()
      .focus()
      .insertVariable({ varKey: v.key, label: v.label || v.key })
      .run();
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
        <ToolbarButton
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Bold (Ctrl/Cmd+B)"
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl/Cmd+I)"
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleMark?.('underline').run()}
          title="Underline"
          // StarterKit doesn't ship Underline by default; hide softly when
          // unavailable so the toolbar stays predictable.
          disabled={!editor?.schema?.marks?.underline}
        >
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <ToolbarButton
          active={editor?.isActive('heading', { level: 2 })}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading"
        >
          <Heading2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          title="Bulleted list"
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>

        <span className="ml-auto" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" type="button" className="h-7 gap-1.5 px-2.5">
              <Sparkles className="size-3.5" />
              Insert variable
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
            {variableItems.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                No variables yet — add one below.
              </div>
            ) : (
              variableItems.map((v) => (
                <DropdownMenuItem
                  key={v.key}
                  onSelect={(e) => {
                    e.preventDefault();
                    insertVariable(v);
                  }}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">{v.label || v.key}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {v.key}
                  </span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onAddNewVariable?.();
              }}
              className="text-primary"
            >
              <Plus className="size-3.5" />
              New variable…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor body */}
      <div
        className="bg-white px-4 py-3"
        style={{ minHeight }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .consent-editor-prose {
          font-size: 13px;
          line-height: 1.6;
          color: #1f2937;
          min-height: ${minHeight - 24}px;
        }
        .consent-editor-prose p { margin: 0 0 8px; }
        .consent-editor-prose h1 { font-size: 16px; font-weight: 700; margin: 12px 0 6px; }
        .consent-editor-prose h2 { font-size: 14px; font-weight: 700; margin: 12px 0 6px; color: #fe6e00; }
        .consent-editor-prose h3 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
        .consent-editor-prose ul {
          margin: 0 0 8px 22px; padding-left: 0; list-style: disc outside;
        }
        .consent-editor-prose ol {
          margin: 0 0 8px 22px; padding-left: 0; list-style: decimal outside;
        }
        .consent-editor-prose li { margin-bottom: 3px; padding-left: 4px; }
        .consent-editor-prose li::marker { color: #fe6e00; font-weight: 600; }
        .consent-editor-prose strong { font-weight: 600; }
        .consent-editor-prose .consent-variable-chip {
          display: inline-flex;
          align-items: center;
          margin: 0 1px;
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(254, 110, 0, 0.10);
          color: #b04f00;
          font-weight: 600;
          font-size: 12px;
          line-height: 1.3;
          white-space: nowrap;
          user-select: none;
          cursor: default;
          border: 1px solid rgba(254, 110, 0, 0.30);
        }
        .consent-editor-prose .consent-variable-chip.ProseMirror-selectednode {
          background: rgba(254, 110, 0, 0.25);
          outline: 2px solid rgba(254, 110, 0, 0.55);
        }
        .consent-editor-prose p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({ active, onClick, title, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs transition',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled ? 'pointer-events-none opacity-40' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default ConsentRichEditor;

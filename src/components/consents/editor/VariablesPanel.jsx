import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'select', label: 'Dropdown' },
];

const TYPE_LABELS = Object.fromEntries(FIELD_TYPES.map((f) => [f.value, f.label]));

function slugifyKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function emptyDraft() {
  return {
    key: '',
    label: '',
    type: 'text',
    optionsRaw: '',
    required: false,
    helpText: '',
  };
}

/**
 * Side panel that manages the variables on a consent template. The list is
 * the canonical "fields[]" on the template — each row's `key` is what the
 * editor stores as `<span data-variable="key">`.
 */
export function VariablesPanel({
  variables,
  onChange,
  onInsertExisting,
  openAddForm,
  onAddFormToggled,
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [editingKey, setEditingKey] = useState(null);
  const [adding, setAdding] = useState(false);

  // When the parent triggers "+ Insert variable → New variable…", expand
  // the add form. We use a one-shot prop so subsequent renders don't keep
  // re-opening it.
  useEffect(() => {
    if (openAddForm) {
      setAdding(true);
      setDraft(emptyDraft());
      onAddFormToggled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddForm]);

  const keySet = useMemo(
    () => new Set((variables || []).map((v) => v.key)),
    [variables],
  );

  function startEdit(v) {
    setEditingKey(v.key);
    setDraft({
      key: v.key,
      label: v.label || '',
      type: v.type || 'text',
      optionsRaw: (v.options || []).join('\n'),
      required: !!v.required,
      helpText: v.helpText || '',
    });
    setAdding(false);
  }

  function cancelEdit() {
    setEditingKey(null);
    setAdding(false);
    setDraft(emptyDraft());
  }

  function commit() {
    const label = draft.label.trim();
    if (!label) return;
    let key = draft.key.trim() || slugifyKey(label);
    if (!editingKey) {
      let n = 1;
      let candidate = key;
      while (keySet.has(candidate)) {
        n += 1;
        candidate = `${key}_${n}`;
      }
      key = candidate;
    }
    const next = {
      key,
      label,
      type: draft.type,
      options:
        draft.type === 'select'
          ? draft.optionsRaw
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      required: !!draft.required,
      helpText: draft.helpText.trim(),
    };
    const list = Array.isArray(variables) ? variables : [];
    if (editingKey) {
      onChange?.(list.map((v) => (v.key === editingKey ? next : v)));
    } else {
      onChange?.([...list, next]);
    }
    cancelEdit();
  }

  function remove(v) {
    if (!window.confirm(`Remove variable "${v.label || v.key}"?`)) return;
    onChange?.((variables || []).filter((x) => x.key !== v.key));
    if (editingKey === v.key) cancelEdit();
  }

  return (
    <div className="flex h-full flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Variables</div>
          <div className="text-[11px] text-muted-foreground">
            Fields a staff member fills in when creating a consent.
          </div>
        </div>
        {!adding && !editingKey ? (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              setAdding(true);
              setDraft(emptyDraft());
            }}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {(variables || []).length === 0 && !adding ? (
          <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">
            No variables yet. Click <span className="font-medium">Add</span>{' '}
            to create one, then insert it into the body from the toolbar.
          </p>
        ) : (
          <ul className="divide-y">
            {(variables || []).map((v) => {
              const isEditing = editingKey === v.key;
              return (
                <li key={v.key} className="py-2">
                  {isEditing ? (
                    <VariableForm
                      draft={draft}
                      setDraft={setDraft}
                      onCancel={cancelEdit}
                      onCommit={commit}
                      lockKey
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onInsertExisting?.(v)}
                        title="Insert into body"
                        className="group min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-[12px] font-medium group-hover:text-primary">
                          {v.label || v.key}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-mono">{v.key}</span>
                          <span>·</span>
                          <span>{TYPE_LABELS[v.type] || v.type}</span>
                          {v.required ? (
                            <>
                              <span>·</span>
                              <span className="text-destructive">required</span>
                            </>
                          ) : null}
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit variable"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(v)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                          title="Delete variable"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {adding ? (
          <div className="mt-2 rounded-md border border-dashed bg-muted/30 p-2">
            <VariableForm
              draft={draft}
              setDraft={setDraft}
              onCancel={cancelEdit}
              onCommit={commit}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VariableForm({ draft, setDraft, onCancel, onCommit, lockKey }) {
  const labelId = 'vp-label';
  const keyId = 'vp-key';
  const typeId = 'vp-type';
  const helpId = 'vp-help';

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={labelId} className="text-[11px]">
          Label *
        </Label>
        <Input
          id={labelId}
          autoFocus
          value={draft.label}
          onChange={(e) => {
            const label = e.target.value;
            setDraft((d) => ({
              ...d,
              label,
              key: lockKey ? d.key : slugifyKey(label),
            }));
          }}
          placeholder="e.g. Procedure type"
          className="h-8 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={keyId} className="text-[11px]">
            Key
          </Label>
          <Input
            id={keyId}
            value={draft.key}
            onChange={(e) =>
              setDraft((d) => ({ ...d, key: slugifyKey(e.target.value) }))
            }
            disabled={lockKey}
            placeholder="auto"
            className="h-8 font-mono text-[11px]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={typeId} className="text-[11px]">
            Type
          </Label>
          <Select
            value={draft.type}
            onValueChange={(v) => setDraft((d) => ({ ...d, type: v }))}
          >
            <SelectTrigger id={typeId} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {draft.type === 'select' ? (
        <div className="space-y-1">
          <Label className="text-[11px]">Options</Label>
          <textarea
            value={draft.optionsRaw}
            onChange={(e) =>
              setDraft((d) => ({ ...d, optionsRaw: e.target.value }))
            }
            rows={3}
            placeholder={'One option per line\nMedical\nSurgical'}
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs"
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor={helpId} className="text-[11px]">
          Help text
        </Label>
        <Input
          id={helpId}
          value={draft.helpText}
          onChange={(e) => setDraft((d) => ({ ...d, helpText: e.target.value }))}
          placeholder="Shown under the input"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex items-center justify-between rounded-md bg-background px-2 py-1.5">
        <Label className="text-[11px]">Required</Label>
        <Switch
          checked={draft.required}
          onCheckedChange={(v) => setDraft((d) => ({ ...d, required: !!v }))}
        />
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onCancel}
        >
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!draft.label.trim()}
          onClick={onCommit}
        >
          <Check className="size-3.5" />
          Save
        </Button>
      </div>
    </div>
  );
}

export default VariablesPanel;

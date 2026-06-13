import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileSignature,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import * as api from '../../api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

import { ConsentRichEditor } from './editor/ConsentRichEditor';
import { VariablesPanel } from './editor/VariablesPanel';
import { extractHtmlVariableKeys } from '@/utils/consentMarkdown';

const emptyForm = {
  name: '',
  title: '',
  bodyHtml: '',
  fields: [],
  requiresGuardian: false,
};

/**
 * Settings panel for managing reusable consent templates.
 *
 * Editing happens in a wide dialog with a two-pane layout:
 *   • Left: WYSIWYG body editor with an inline "Insert variable" dropdown.
 *   • Right: VariablesPanel listing the fields a staff member fills in
 *     when creating a consent from this template.
 */
export function ConsentTemplatesManager({ clinicId }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | template
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [openAddVariable, setOpenAddVariable] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    setLoading(true);
    api
      .getConsentTemplates({ clinicId })
      .then((res) => {
        if (!cancelled) setTemplates(res.data?.data || []);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.response?.data?.error || 'Failed to load templates');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  function openCreate() {
    setEditing('new');
    setForm(emptyForm);
  }

  function openEdit(tpl) {
    setEditing(tpl);
    setForm({
      name: tpl.name || '',
      title: tpl.title || '',
      bodyHtml: tpl.bodyHtml || '',
      fields: Array.isArray(tpl.fields) ? tpl.fields : [],
      requiresGuardian: !!tpl.requiresGuardian,
    });
  }

  const handleEditorChange = useCallback((html) => {
    setForm((f) => (f.bodyHtml === html ? f : { ...f, bodyHtml: html }));
  }, []);

  function handleVariablesChange(next) {
    setForm((f) => ({ ...f, fields: next }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    // Reconcile fields[] with the variable chips actually present in the
    // body. Any chip whose key isn't declared as a field becomes a default
    // text field so the consent-create modal can prompt for it.
    const usedKeys = extractHtmlVariableKeys(form.bodyHtml);
    const declared = new Map(
      (form.fields || []).map((f) => [f.key, f]),
    );
    for (const k of usedKeys) {
      if (!declared.has(k)) {
        declared.set(k, { key: k, label: humanize(k), type: 'text' });
      }
    }
    const payload = {
      name: form.name.trim(),
      title: form.title.trim(),
      bodyHtml: form.bodyHtml,
      // Keep legacy column blank so the renderer picks the HTML path.
      bodyMarkdown: '',
      fields: Array.from(declared.values()),
      requiresGuardian: form.requiresGuardian,
    };
    try {
      if (editing === 'new') {
        const res = await api.createConsentTemplate({
          clinicId,
          ...payload,
        });
        setTemplates((list) => [res.data.data, ...list]);
        toast.success('Template created');
      } else {
        const res = await api.updateConsentTemplate(editing._id, payload);
        setTemplates((list) =>
          list.map((t) => (t._id === res.data.data._id ? res.data.data : t)),
        );
        toast.success('Template updated');
      }
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tpl) {
    setTogglingId(tpl._id);
    try {
      const res = await api.updateConsentTemplate(tpl._id, {
        isActive: !tpl.isActive,
      });
      setTemplates((list) =>
        list.map((t) => (t._id === res.data.data._id ? res.data.data : t)),
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update template');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(tpl) {
    if (
      !window.confirm(
        `Hide "${tpl.name}" from the consent picker? Existing signed forms are unaffected.`,
      )
    ) {
      return;
    }
    try {
      await api.deleteConsentTemplate(tpl._id);
      setTemplates((list) =>
        list.map((t) => (t._id === tpl._id ? { ...t, isActive: false } : t)),
      );
      toast.success('Template hidden');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove template');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="size-4 text-primary" />
            Consent templates
          </CardTitle>
          <CardDescription>
            Write the consent text in a normal editor and click{' '}
            <span className="font-medium">Insert variable</span> to add fields
            like <span className="font-medium">procedure type</span>,{' '}
            <span className="font-medium">place</span> or{' '}
            <span className="font-medium">time</span>. Staff fills the
            variables when creating a consent on a patient.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" /> New template
        </Button>
      </CardHeader>

      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FileSignature className="size-5" />
            </div>
            <p className="text-sm">No templates yet</p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" /> Add your first template
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {templates.map((tpl) => (
              <li
                key={tpl._id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{tpl.name}</span>
                    {tpl.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="size-3" /> Default
                      </span>
                    ) : null}
                    {!tpl.isActive ? (
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  {tpl.title ? (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {tpl.title}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    Active
                    <Switch
                      checked={tpl.isActive}
                      onCheckedChange={() => toggleActive(tpl)}
                      disabled={togglingId === tpl._id}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(tpl)}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(tpl)}
                    title="Hide template"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && !saving && setEditing(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[min(1100px,95vw)]">
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? 'New consent template' : 'Edit template'}
            </DialogTitle>
            <DialogDescription>
              Type the consent body on the left. Insert variables from the
              toolbar — they'll show up as fillable inputs when staff creates
              this consent for a patient.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ct-name">Name *</Label>
                <Input
                  id="ct-name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. RCT Consent"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-title">Document title</Label>
                <Input
                  id="ct-title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Consent for Root Canal Treatment"
                />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-1.5">
                <Label>Body</Label>
                <ConsentRichEditor
                  value={form.bodyHtml}
                  onChange={handleEditorChange}
                  variables={form.fields}
                  onAddNewVariable={() => setOpenAddVariable(true)}
                  onReady={(ed) => {
                    editorRef.current = ed;
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Patient name, age, address, clinic and doctor are filled in
                  automatically — you don't need to add them as variables.
                </p>
              </div>
              <div className="lg:max-h-[480px]">
                <VariablesPanel
                  variables={form.fields}
                  onChange={handleVariablesChange}
                  openAddForm={openAddVariable}
                  onAddFormToggled={() => setOpenAddVariable(false)}
                  onInsertExisting={(v) => {
                    const ed = editorRef.current;
                    if (!ed) return;
                    ed
                      .chain()
                      .focus()
                      .insertVariable({
                        varKey: v.key,
                        label: v.label || v.key,
                      })
                      .run();
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="ct-guardian" className="text-sm">
                  Requires guardian by default
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Pre-selects "Guardian" on the signing screen (for minors).
                </p>
              </div>
              <Switch
                id="ct-guardian"
                checked={form.requiresGuardian}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, requiresGuardian: v }))
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save template'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function humanize(key) {
  return String(key || '')
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

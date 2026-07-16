import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_PREVIEW_LIMIT = 3;
const VIEW_ALL_HREF = '/settings/treatments';

const emptyForm = {
  name: '',
  price: '',
  description: '',
};

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return priceFormatter.format(n);
}

/**
 * Settings card for managing the clinic's treatment catalogue.
 *
 * Props:
 *   - clinicId:  required, scopes the API calls.
 *   - limit:     when set (default 3), only the first `limit` treatments
 *                are shown and a "View all" button navigates to the
 *                dedicated treatments page. Pass `null` to show all rows.
 */
export function TreatmentsManager({ clinicId, limit = DEFAULT_PREVIEW_LIMIT }) {
  const navigate = useNavigate();
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | treatment
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    if (!clinicId) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .getTreatments({ clinicId })
      .then((res) => {
        if (!cancelled) setTreatments(res.data?.data || []);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.response?.data?.error || 'Failed to load treatments');
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

  function openEdit(t) {
    setEditing(t);
    setForm({
      name: t.name || '',
      price:
        t.price === null || t.price === undefined || t.price === ''
          ? ''
          : String(t.price),
      description: t.description || '',
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Enter a valid non-negative price');
      return;
    }

    setSaving(true);
    const payload = {
      name,
      price: priceNum,
      description: form.description.trim(),
    };
    try {
      if (editing === 'new') {
        const res = await api.createTreatment({ clinicId, ...payload });
        setTreatments((list) => [res.data.data, ...list]);
        toast.success('Treatment added');
      } else {
        const res = await api.updateTreatment(editing._id, payload);
        setTreatments((list) =>
          list.map((t) => (t._id === res.data.data._id ? res.data.data : t)),
        );
        toast.success('Treatment updated');
      }
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save treatment');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t) {
    setTogglingId(t._id);
    try {
      const res = await api.updateTreatment(t._id, { isActive: !t.isActive });
      setTreatments((list) =>
        list.map((row) => (row._id === res.data.data._id ? res.data.data : row)),
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update treatment');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(t) {
    if (
      !window.confirm(
        `Delete "${t.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await api.deleteTreatment(t._id, { hard: true });
      setTreatments((list) => list.filter((row) => row._id !== t._id));
      toast.success('Treatment deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete treatment');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            Treatments &amp; pricing
          </CardTitle>
          <CardDescription>
            The list of treatments your clinic offers and their listed prices.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" /> New treatment
        </Button>
      </CardHeader>

      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : treatments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="size-5" />
            </div>
            <p className="text-sm">No treatments added yet</p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" /> Add your first treatment
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {(limit ? treatments.slice(0, limit) : treatments).map((t) => (
                <li
                  key={t._id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{t.name}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">
                        {formatPrice(t.price)}
                      </span>
                      {!t.isActive ? (
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    {t.description ? (
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {t.description}
                      </div>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="self-end sm:self-auto"
                        aria-label={`Actions for ${t.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onSelect={() => toggleActive(t)}
                        disabled={togglingId === t._id}
                      >
                        {t.isActive ? (
                          <>
                            <EyeOff className="size-3.5" /> Mark inactive
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" /> Mark active
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEdit(t)}>
                        <Pencil className="size-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => handleDelete(t)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>

            {limit && treatments.length > limit ? (
              <div className="mt-3 flex justify-center border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(VIEW_ALL_HREF)}
                >
                  View all ({treatments.length})
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && !saving && setEditing(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing === 'new' ? 'New treatment' : 'Edit treatment'}
            </DialogTitle>
            <DialogDescription>
              Add a treatment offered at your clinic along with its listed
              price.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tr-name">Treatment name *</Label>
              <Input
                id="tr-name"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Scaling & Polishing"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-price">Price (INR) *</Label>
              <Input
                id="tr-price"
                required
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                placeholder="e.g. 1500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-desc">Description</Label>
              <Textarea
                id="tr-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional — short note shown next to the treatment."
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
                {saving
                  ? 'Saving…'
                  : editing === 'new'
                    ? 'Add treatment'
                    : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

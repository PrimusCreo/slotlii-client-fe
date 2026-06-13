import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  extractHtmlVariableKeys,
  extractPlaceholders,
} from '@/utils/consentMarkdown';

// Placeholders the system fills in automatically — staff doesn't see them.
const AUTO_PLACEHOLDERS = new Set([
  'patientName',
  'patientAge',
  'address',
  'clinicName',
  'doctorName',
  'date',
  'place',
  'time',
]);

function humanizePlaceholder(key) {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function calcAge(dob) {
  if (!dob) return '';
  const diff = Date.now() - new Date(dob).getTime();
  if (Number.isNaN(diff)) return '';
  const yrs = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return yrs > 0 ? String(yrs) : '';
}

/**
 * Defaults the staff can see and edit before saving. Server applies the
 * same set on submit (so unset values still come out right), but echoing
 * them here is more transparent — staff is never surprised by content
 * appearing on the rendered consent.
 */
function buildAutoDefaults({ patient, clinic, doctorName }) {
  return {
    patientName: patient?.name || '',
    clinicName: clinic?.name || '',
    doctorName: doctorName || '',
    place: clinic?.name || '',
    time: new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    subjectName: patient?.name || '',
    subjectAge: calcAge(patient?.dateOfBirth),
    relationship: 'Self',
    address: patient?.address || '',
    patientAge: calcAge(patient?.dateOfBirth),
  };
}

/**
 * Normalize a template's `fields` metadata into the array we'll render.
 * Falls back to deriving fields from `{{placeholders}}` in the body when
 * the template hasn't declared any (back-compat with older / hand-rolled
 * templates).
 */
function deriveFields(template) {
  if (!template) return [];

  // Pull body-level placeholders from either the rich-text body (preferred)
  // or the legacy markdown column so the modal can still render inputs for
  // ad-hoc tokens that staff dropped into the body without declaring as
  // structured fields.
  const fromHtml = extractHtmlVariableKeys(template.bodyHtml || '');
  const fromMd = extractPlaceholders(template.bodyMarkdown || '');
  const fromBody = (fromHtml.length > 0 ? fromHtml : fromMd).filter(
    (k) => !AUTO_PLACEHOLDERS.has(k),
  );

  const declared = Array.isArray(template.fields) ? template.fields : [];

  if (declared.length > 0) {
    const declaredByKey = new Map();
    for (const f of declared) {
      if (f && f.key) declaredByKey.set(f.key, f);
    }
    // Keep declared order, then tack on any body-only placeholders so the
    // template can still surface ad-hoc additions a clinic typed into the
    // Markdown without updating the fields config.
    const result = declared
      .filter((f) => f && f.key && !AUTO_PLACEHOLDERS.has(f.key))
      .map((f) => ({ ...f }));
    for (const key of fromBody) {
      if (!declaredByKey.has(key)) {
        result.push({ key, label: '', type: 'text' });
      }
    }
    return result;
  }

  // Legacy fallback.
  return fromBody.map((key) => ({ key, label: '', type: 'text' }));
}

/**
 * Create / edit dialog for consents. Operates in two modes:
 *   - "create": template picker + filled values + doctor → POST
 *   - "edit":   same fields prefilled, no template switch
 */
export function ConsentFormModal({
  open,
  mode = 'create',
  templates = [],
  doctors = [],
  patient = null,
  clinic = null,
  initial = null,
  onCancel,
  onSubmit,
  saving = false,
}) {
  const [templateId, setTemplateId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctor, setDoctor] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filled, setFilled] = useState({});

  // Re-hydrate whenever the dialog opens with new data.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setTemplateId(initial.templateId || '');
      setDoctorId(initial.doctorId || '');
      setDoctor(initial.doctor || '');
      setDate(
        initial.date
          ? new Date(initial.date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
      setFilled({ ...(initial.filledValues || {}) });
      return;
    }
    setTemplateId('');
    setDoctorId('');
    setDoctor('');
    setDate(new Date().toISOString().slice(0, 10));
    setFilled({});
  }, [open, mode, initial]);

  const activeTemplate = useMemo(() => {
    return templates.find((t) => t._id === templateId) || null;
  }, [templates, templateId]);

  const fields = useMemo(() => deriveFields(activeTemplate), [activeTemplate]);

  // When staff picks a template in create mode, pre-populate the fillable
  // values with our best guesses based on patient / clinic / doctor. This
  // runs only on template change (not on every keystroke) so staff edits
  // are preserved.
  useEffect(() => {
    if (mode !== 'create' || !activeTemplate) return;
    const defaults = buildAutoDefaults({
      patient,
      clinic,
      doctorName: doctor,
    });
    setFilled((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (next[f.key] === undefined || next[f.key] === '') {
          const d = defaults[f.key];
          if (d !== undefined && d !== '') next[f.key] = d;
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate?._id, doctor, patient?._id, clinic?._id, mode]);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      templateId,
      doctorId: doctorId || null,
      doctor,
      date,
      filledValues: filled,
    });
  }

  const canSubmit = (mode === 'edit' || !!templateId) && !saving;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel?.()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit consent' : 'New consent'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update the template values, doctor or date.'
              : 'Pick a template, fill the relevant details and choose how to collect the signature.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' ? (
            <div className="space-y-1.5">
              <Label htmlFor="c-template">Template *</Label>
              <Select
                value={templateId || undefined}
                onValueChange={(v) => setTemplateId(v)}
              >
                <SelectTrigger id="c-template">
                  <SelectValue
                    placeholder={
                      templates.length === 0
                        ? 'No templates yet — create one in Settings'
                        : 'Pick a consent template'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-date">Date</Label>
              <Input
                id="c-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-doc">Doctor</Label>
              <Select
                value={doctorId || undefined}
                onValueChange={(v) => {
                  const picked = doctors.find((d) => d._id === v);
                  setDoctorId(v);
                  setDoctor(picked?.name || '');
                }}
              >
                <SelectTrigger id="c-doc">
                  <SelectValue
                    placeholder={
                      doctors.length === 0
                        ? 'No doctors in clinic'
                        : 'Select doctor'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                      {d.specialization ? ` · ${d.specialization}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeTemplate ? (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Template details
              </div>
              {fields.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  This template has no extra fields — patient name, doctor and
                  clinic are filled in automatically.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => {
                    // When the signer is the patient themselves, the subject's
                    // age is redundant with the patient's age — skip the input.
                    // The value still flows through `filled` (auto-defaulted to
                    // the patient's age) so the rendered consent stays correct.
                    if (
                      field.key === 'subjectAge' &&
                      filled.relationship === 'Self'
                    ) {
                      return null;
                    }
                    return (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={filled[field.key] || ''}
                        onChange={(v) =>
                          setFilled((s) => ({ ...s, [field.key]: v }))
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : mode === 'edit' ? (
                'Save changes'
              ) : (
                'Save draft'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }) {
  const id = `c-field-${field.key}`;
  const label = field.label || humanizePlaceholder(field.key);
  const fullWidth = field.type === 'textarea';

  const baseProps = {
    id,
    value: value ?? '',
    onChange: (e) => onChange(e.target.value),
    placeholder: field.placeholder || '',
    required: !!field.required,
  };

  let control;
  if (field.type === 'textarea') {
    control = <Textarea {...baseProps} rows={2} />;
  } else if (field.type === 'select') {
    control = (
      <Select value={value || undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={field.placeholder || 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {(field.options || []).map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (field.type === 'date') {
    control = <Input type="date" {...baseProps} />;
  } else if (field.type === 'time') {
    control = <Input type="time" {...baseProps} />;
  } else if (field.type === 'number') {
    control = <Input type="number" inputMode="numeric" min={0} {...baseProps} />;
  } else {
    control = <Input type="text" {...baseProps} />;
  }

  return (
    <div className={`space-y-1.5 ${fullWidth ? 'sm:col-span-2' : ''}`}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {field.required ? <span className="text-destructive">*</span> : null}
      </Label>
      {control}
      {field.helpText ? (
        <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
      ) : null}
    </div>
  );
}

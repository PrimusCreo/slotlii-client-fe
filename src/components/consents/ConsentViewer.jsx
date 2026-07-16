import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Pencil,
  PenLine,
  Printer,
  Share2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConsentDocument } from './ConsentDocument';

const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent · awaiting signature',
  signed: 'Signed',
  expired: 'Link expired',
};

const STATUS_COLOR = {
  draft: 'bg-zinc-100 text-zinc-700',
  sent: 'bg-amber-100 text-amber-800',
  signed: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-100 text-rose-800',
};

/**
 * Full-screen overlay viewer for a consent record.
 * Reuses the same print-mode CSS as the prescription viewer.
 */
export function ConsentViewer({
  consent,
  patient,
  clinic,
  doctor,
  onClose,
  onEdit,
  onShare,
  onSign,
  onDownload,
  sharing,
}) {
  const open = !!consent;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    body.classList.add('rx-print-mode');
    return () => {
      body.style.overflow = prevOverflow;
      body.classList.remove('rx-print-mode');
    };
  }, [open]);

  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  if (!open || typeof document === 'undefined') return null;

  const status = consent.status || 'draft';
  const isSigned = status === 'signed';
  const isDraft = status === 'draft';

  return createPortal(
    <div
      data-rx-portal
      className="fixed inset-0 z-50 flex flex-col bg-zinc-100 dark:bg-zinc-950"
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body.rx-print-mode > *:not([data-rx-portal]) { display: none !important; }
          [data-rx-screen-only] { display: none !important; }
          [data-rx-portal] {
            position: static !important;
            inset: auto !important;
            background: #ffffff !important;
            display: block !important;
          }
          [data-rx-portal] [data-rx-scroll] {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          [data-rx-portal] [data-doc-container] {
            background: #ffffff !important;
            padding: 0 !important;
            gap: 0 !important;
          }
          [data-rx-portal] .pd-page {
            box-shadow: none !important;
            outline: none !important;
            border-radius: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          [data-rx-portal] .pd-page:last-of-type {
            page-break-after: auto;
            break-after: auto;
          }
          [data-rx-portal] [data-doc-container] > .text-muted-foreground {
            display: none !important;
          }
        }
      `}</style>

      <div
        data-rx-screen-only
        className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" /> Close
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Consent — {consent.condition || consent.templateSnapshot?.name || 'Form'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[status] || STATUS_COLOR.draft}`}
            >
              {STATUS_LABEL[status] || status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : null}
          {!isSigned && onSign ? (
            <Button variant="outline" size="sm" onClick={onSign}>
              <PenLine className="size-3.5" /> Sign on this device
            </Button>
          ) : null}
          {!isSigned && onShare ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              disabled={!!sharing}
            >
              <Share2 className="size-3.5" /> {sharing ? 'Sending…' : 'Share via WhatsApp'}
            </Button>
          ) : null}
          {onDownload ? (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="size-3.5" /> Download PDF
            </Button>
          ) : null}
          <Button size="sm" onClick={handlePrint}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      <div data-rx-scroll className="flex-1 overflow-auto">
        <ConsentDocument
          consent={consent}
          patient={patient}
          clinic={clinic}
          doctor={doctor}
        />
      </div>
    </div>,
    document.body,
  );
}

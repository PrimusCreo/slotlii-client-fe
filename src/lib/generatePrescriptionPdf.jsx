import { createRoot } from 'react-dom/client';

import { PrescriptionDocumentPdf } from '@/components/prescriptions/PrescriptionDocumentPdf';

const PDF_TIMEOUT_MS = 45000;

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function sanitizeFilename(name) {
  const base = String(name || 'prescription')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${base || 'prescription'}.pdf`;
}

/**
 * Strip stylesheets from a cloned document so html2canvas never parses oklch().
 */
function stripStylesheets(clonedDoc) {
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    node.remove();
  });
}

function createIsolatedMount() {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '820px',
    height: '1200px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff;"></body></html>',
  );
  doc.close();

  return { iframe, mount: doc.body, root: null };
}

function destroyMount({ iframe, root }) {
  try {
    root?.unmount();
  } catch (_) {
    // ignore unmount errors
  }
  iframe?.remove();
}

/**
 * Renders PrescriptionDocumentPdf in an isolated iframe (no Tailwind / oklch)
 * and returns an A4 PDF blob.
 */
export async function generatePrescriptionPdf({
  prescription,
  patient,
  clinic,
  doctor,
}) {
  const mountRef = createIsolatedMount();
  let root;

  try {
    root = createRoot(mountRef.mount);
    mountRef.root = root;
    root.render(
      <PrescriptionDocumentPdf
        prescription={prescription}
        patient={patient}
        clinic={clinic}
        doctor={doctor}
      />,
    );

    await waitForPaint();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const element = mountRef.mount.firstElementChild;
    if (!element) {
      throw new Error('Could not render prescription for PDF export');
    }

    const filename = sanitizeFilename(prescription?.condition);

    // Lazy-load html2pdf so it is only fetched when sharing.
    const { default: html2pdf } = await import('html2pdf.js');

    const blob = await withTimeout(
      html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            onclone: stripStylesheets,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(element)
        .outputPdf('blob'),
      PDF_TIMEOUT_MS,
      'PDF generation timed out — please try again',
    );

    blob.name = filename;
    return blob;
  } finally {
    destroyMount({ iframe: mountRef.iframe, root: mountRef.root });
  }
}

export default generatePrescriptionPdf;

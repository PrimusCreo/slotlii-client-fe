import { createRoot } from 'react-dom/client';
import html2pdf from 'html2pdf.js';

import { PrescriptionDocument } from '@/components/prescriptions/PrescriptionDocument';

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
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
 * Renders PrescriptionDocument off-screen and returns an A4 PDF blob matching
 * the printable prescription view.
 */
export async function generatePrescriptionPdf({
  prescription,
  patient,
  clinic,
  doctor,
}) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '820px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <PrescriptionDocument
      prescription={prescription}
      patient={patient}
      clinic={clinic}
      doctor={doctor}
    />,
  );

  try {
    await waitForPaint();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const element = container.firstElementChild;
    if (!element) {
      throw new Error('Could not render prescription for PDF export');
    }

    const filename = sanitizeFilename(prescription?.condition);

    const blob = await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(element)
      .outputPdf('blob');

    blob.name = filename;
    return blob;
  } finally {
    root.unmount();
    container.remove();
  }
}

export default generatePrescriptionPdf;

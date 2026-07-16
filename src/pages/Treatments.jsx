import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import { TreatmentsManager } from '../components/treatments/TreatmentsManager';

/**
 * Full-page treatment catalogue. Reuses TreatmentsManager with `limit={null}`
 * so the entire list is shown instead of the 3-row preview used on Settings.
 *
 * Breadcrumb (Settings › Treatments) is rendered by the layout header from
 * the URL, so no in-page back button is needed.
 */
export default function Treatments() {
  const { selectedClinicId } = useClinic();

  return (
    <Layout title="Treatments">
      <div className="grid max-w-4xl gap-4">
        {selectedClinicId ? (
          <TreatmentsManager clinicId={selectedClinicId} limit={null} />
        ) : null}
      </div>
    </Layout>
  );
}

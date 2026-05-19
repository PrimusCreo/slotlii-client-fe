import { Badge } from '@/components/ui/badge';

const STATUS_VARIANT = {
  BOOKED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
};

const STATUS_LABEL = {
  BOOKED: 'Booked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

export function StatusBadge({ status, className }) {
  if (!status) return null;
  const key = String(status).toUpperCase();
  return (
    <Badge variant={STATUS_VARIANT[key] || 'secondary'} className={className}>
      {STATUS_LABEL[key] || status}
    </Badge>
  );
}

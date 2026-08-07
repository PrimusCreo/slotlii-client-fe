import { cn } from '@/lib/utils';

/**
 * Monthly / Yearly switch for the Plans page.
 *
 * A segmented control rather than a Switch: "which of these two" reads more
 * clearly than an on/off toggle whose label has to explain what "on" means.
 */
export function BillingCycleToggle({ value, onChange, className }) {
  const options = [
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="inline-flex items-center rounded-full border bg-muted/40 p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={value === option.id}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              value === option.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.id === 'yearly' ? (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                1 month free
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === 'yearly'
          ? 'Pay for 11 months, get 12. Billed once a year.'
          : 'Billed every month. Switch to yearly any time to save a month.'}
      </p>
    </div>
  );
}

export default BillingCycleToggle;

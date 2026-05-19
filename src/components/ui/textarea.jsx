import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors',
        'placeholder:text-muted-foreground field-sizing-content',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        'dark:bg-input/30',
        className,
      )}
      {...props}
    />
  );
});

export { Textarea };

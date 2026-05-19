import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
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

export { Input };

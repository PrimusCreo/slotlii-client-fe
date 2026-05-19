import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 [&>svg]:pointer-events-none transition-colors overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success:
          'border-transparent bg-[color:var(--status-completed-bg)] text-[color:var(--status-completed)]',
        info:
          'border-transparent bg-[color:var(--status-booked-bg)] text-[color:var(--status-booked)]',
        warning:
          'border-transparent bg-[color:var(--status-noshow-bg)] text-[color:var(--status-noshow)]',
        danger:
          'border-transparent bg-[color:var(--status-cancelled-bg)] text-[color:var(--status-cancelled)]',
        soft: 'border-transparent bg-primary/10 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'span';
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

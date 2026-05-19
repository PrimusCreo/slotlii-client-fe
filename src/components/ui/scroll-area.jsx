import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';

const ScrollArea = React.forwardRef(function ScrollArea({ className, children, ...props }, ref) {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      data-slot="scroll-area"
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});

const ScrollBar = React.forwardRef(function ScrollBar(
  { className, orientation = 'vertical', ...props },
  ref,
) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        'flex touch-none select-none p-px transition-colors',
        orientation === 'vertical' && 'h-full w-2 border-l border-l-transparent',
        orientation === 'horizontal' && 'h-2 flex-col border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border hover:bg-muted-foreground/40" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});

export { ScrollArea, ScrollBar };

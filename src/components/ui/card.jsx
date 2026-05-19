import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        'flex flex-col gap-6 rounded-xl border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
});

const CardHeader = React.forwardRef(function CardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn(
        'flex flex-col gap-1.5 px-6 pt-6 [.border-b]:pb-6 has-[[data-slot=card-action]]:grid has-[[data-slot=card-action]]:grid-cols-[1fr_auto] has-[[data-slot=card-action]]:items-start',
        className,
      )}
      {...props}
    />
  );
});

const CardTitle = React.forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-title"
      className={cn('font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  );
});

const CardDescription = React.forwardRef(function CardDescription({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});

const CardAction = React.forwardRef(function CardAction({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
});

const CardContent = React.forwardRef(function CardContent({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn('px-6 [&:last-child]:pb-6', className)}
      {...props}
    />
  );
});

const CardFooter = React.forwardRef(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn('flex items-center px-6 pb-6 [.border-t]:pt-6', className)}
      {...props}
    />
  );
});

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck, Volume2, VolumeX } from 'lucide-react';

import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Best-effort router for a notification's `entity` reference. When the
 * kind is unknown we simply don't navigate. Sub-documents (like consents
 * living inside a patient) use `entity.parentKind` + `entity.parentId`
 * so the bell can jump straight to the owner page.
 */
function routeFor(entity) {
  if (!entity) return null;
  if (entity.parentKind === 'patient' && entity.parentId) {
    return `/patients/${entity.parentId}`;
  }
  if (!entity.kind || !entity.id) return null;
  switch (entity.kind) {
    case 'appointment':
      return '/appointments';
    case 'bill':
      return `/billing/${entity.id}`;
    case 'patient':
      return `/patients/${entity.id}`;
    case 'consent':
      return '/patients';
    default:
      return null;
  }
}

function timeAgo(value) {
  if (!value) return '';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    requestBrowserPermission,
    soundEnabled,
    setSoundEnabled,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => notifications.slice(0, 20), [notifications]);

  function handleOpenChange(next) {
    setOpen(next);
    // First interaction is a good moment to ask for permission — the
    // browser only shows the prompt in response to a user gesture.
    if (next) {
      requestBrowserPermission();
    }
  }

  function handleItemClick(notification) {
    if (!notification.readAt) {
      markRead(notification._id);
    }
    const path = routeFor(notification.entity);
    if (path) navigate(path);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : 'Notifications'
          }
          className="relative"
        >
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                'pointer-events-none absolute -right-1 -top-1 flex h-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground shadow-sm ring-2 ring-background',
                unreadCount > 9 ? 'min-w-[1.25rem] px-1' : 'w-4',
              )}
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Notifications</span>
            <span className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : 'You are all caught up'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
              title={soundEnabled ? 'Sound on' : 'Sound off'}
            >
              {soundEnabled ? (
                <Volume2 className="size-3.5" />
              ) : (
                <VolumeX className="size-3.5 text-muted-foreground" />
              )}
            </Button>
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => markAllRead()}
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="size-4" />
            </div>
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground">
              New activity will show up here in real time.
            </p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            <ul className="divide-y">
              {items.map((n) => {
                const isUnread = !n.readAt;
                const path = routeFor(n.entity);
                const isClickable = !!path;
                return (
                  <li key={n._id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        'group flex w-full items-start gap-3 px-3 py-2.5 text-left outline-none transition-colors',
                        'hover:bg-accent focus-visible:bg-accent',
                        isClickable ? 'cursor-pointer' : 'cursor-default',
                        isUnread ? 'bg-primary/5' : '',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          isUnread ? 'bg-primary' : 'bg-transparent',
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm',
                            isUnread
                              ? 'font-semibold text-foreground'
                              : 'font-medium text-muted-foreground',
                          )}
                        >
                          {n.title}
                        </p>
                        {n.body ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/80">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

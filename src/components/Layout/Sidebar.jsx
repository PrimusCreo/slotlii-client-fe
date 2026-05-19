import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  Users,
  Stethoscope,
  Settings,
  Plus,
  LogOut,
  MessageSquarePlus,
  HeartPulse,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import * as api from '../../api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/appointments', label: 'Appointments', icon: CalendarCheck, end: true },
  { path: '/appointments/new', label: 'New booking', icon: Plus },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/doctors', label: 'Doctors', icon: Stethoscope },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const emptyFeedback = { category: 'general', message: '', contactEmail: '' };

export default function Sidebar() {
  const { logout, user } = useAuth();
  const { selectedClinic } = useClinic();
  const navigate = useNavigate();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState(emptyFeedback);
  const [feedbackSending, setFeedbackSending] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function openFeedback() {
    setFeedbackForm(emptyFeedback);
    setFeedbackOpen(true);
  }

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    setFeedbackSending(true);
    try {
      await api.submitFeedback({
        category: feedbackForm.category,
        message: feedbackForm.message,
        contactEmail: feedbackForm.contactEmail.trim() || undefined,
      });
      toast.success('Feedback sent — thank you!');
      setFeedbackOpen(false);
      setFeedbackForm(emptyFeedback);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send feedback. Try again later.');
    } finally {
      setFeedbackSending(false);
    }
  }

  const initials = (selectedClinic?.name || user?.username || '??')
    .split(' ')
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <HeartPulse className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">Slotlii</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Clinic OS
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Workspace
          </div>
          <ul className="flex flex-col gap-0.5">
            {navItems.map(({ path, label, icon: Icon, end }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive &&
                        'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Separator />

        <div className="space-y-2 p-3">
          <div className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 p-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">
                {selectedClinic?.name || 'Clinic'}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {user?.username || 'Staff member'}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 text-sm font-normal"
            onClick={openFeedback}
          >
            <MessageSquarePlus className="size-4" />
            Send feedback
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Tell us what is working well, what is broken, or what you'd like next.
              {user?.clinicName ? (
                <>
                  {' '}We'll associate this with <strong>{user.clinicName}</strong>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fb-category">Topic</Label>
              <Select
                value={feedbackForm.category}
                onValueChange={(v) => setFeedbackForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="fb-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="bug">Something is broken</SelectItem>
                  <SelectItem value="feature">Feature request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-message">Your message *</Label>
              <Textarea
                id="fb-message"
                required
                minLength={5}
                rows={5}
                value={feedbackForm.message}
                onChange={(e) => setFeedbackForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Describe your experience or suggestion…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-email">Reply-to email (optional)</Label>
              <Input
                id="fb-email"
                type="email"
                value={feedbackForm.contactEmail}
                onChange={(e) =>
                  setFeedbackForm((f) => ({ ...f, contactEmail: e.target.value }))
                }
                placeholder="If you want us to follow up"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFeedbackOpen(false)}
                disabled={feedbackSending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={feedbackSending}>
                {feedbackSending ? 'Sending…' : 'Submit feedback'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

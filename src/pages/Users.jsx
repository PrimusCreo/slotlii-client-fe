import { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import RolesManager from '../components/users/RolesManager';
import { CapacityHint } from '../components/subscription/CapacityHint';
import { useAuth } from '../context/AuthContext';
import { usePlanUsage } from '../hooks/usePlanUsage';
import { parsePlanRestriction } from '@/lib/planRestrictions';
import * as api from '../api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ROLE_LABEL = {
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
};

const ROLE_ICON = {
  admin: ShieldCheck,
  doctor: Stethoscope,
  receptionist: UserRound,
};

const ROLE_BADGE = {
  admin: 'soft',
  doctor: 'info',
  receptionist: 'secondary',
};

const emptyInvite = {
  email: '',
  name: '',
  role: 'receptionist',
  doctorId: '',
};

const emptyEdit = {
  id: null,
  name: '',
  role: 'receptionist',
  doctorId: '',
  isActive: true,
};

function initialsOf(name = '') {
  return (name || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('') || '?';
}

export default function Users() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInvite);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Seats count accepted accounts *and* pending invites, so this is the number
  // that decides whether another invite can go out.
  const { usage, refresh: refreshUsage } = usePlanUsage();
  const atSeatLimit = Boolean(usage?.staffUsers?.isAtLimit);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  async function loadAll() {
    setLoading(true);
    try {
      const [usersRes, doctorsRes] = await Promise.all([
        api.getUsers(),
        api.getDoctors({ limit: 200, page: 1 }),
      ]);
      setUsers(usersRes.data.data.users || []);
      setInvites(usersRes.data.data.invites || []);
      setDoctors(doctorsRes.data.data || []);
      refreshUsage();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const filteredInvites = useMemo(() => {
    if (!search.trim()) return invites;
    const q = search.trim().toLowerCase();
    return invites.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.email?.toLowerCase().includes(q) ||
        i.role?.toLowerCase().includes(q)
    );
  }, [invites, search]);

  function openInvite() {
    setInviteForm(emptyInvite);
    setInviteOpen(true);
  }

  async function handleInviteSubmit(e) {
    e.preventDefault();
    setInviteSubmitting(true);
    try {
      const payload = {
        email: inviteForm.email.trim(),
        name: inviteForm.name.trim(),
        role: inviteForm.role,
      };
      if (payload.role === 'doctor' && inviteForm.doctorId) {
        payload.doctorId = inviteForm.doctorId;
      }
      await api.inviteUser(payload);
      toast.success('Invite sent');
      setInviteOpen(false);
      loadAll();
    } catch (err) {
      // Seat limits open the upgrade dialog, which says how many seats are in
      // use — a toast alongside it would just repeat that less clearly.
      if (!parsePlanRestriction(err)) {
        toast.error(err.response?.data?.error || 'Could not send invite');
      }
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleResendInvite(invite) {
    try {
      await api.resendUserInvite(invite.id);
      toast.success(`Invite re-sent to ${invite.email}`);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not resend invite');
    }
  }

  async function handleRevokeInvite(invite) {
    if (!window.confirm(`Revoke pending invite for ${invite.email}?`)) return;
    try {
      await api.revokeUserInvite(invite.id);
      toast.success('Invite revoked');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not revoke invite');
    }
  }

  function openEdit(u) {
    setEditForm({
      id: u.id,
      name: u.name || '',
      role: u.role,
      doctorId: u.doctorId ? String(u.doctorId) : '',
      isActive: u.isActive !== false,
    });
    setEditOpen(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      };
      payload.doctorId =
        editForm.role === 'doctor' && editForm.doctorId
          ? editForm.doctorId
          : null;
      await api.updateUser(editForm.id, payload);
      toast.success('User updated');
      setEditOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update user');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeactivate(u) {
    if (!window.confirm(`Deactivate ${u.name}? They will no longer be able to log in.`))
      return;
    try {
      await api.deactivateUser(u.id);
      toast.success('User deactivated');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not deactivate user');
    }
  }

  async function handleReactivate(u) {
    try {
      await api.updateUser(u.id, { isActive: true });
      toast.success('User reactivated');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not reactivate user');
    }
  }

  return (
    <Layout title="Users">
      <Tabs defaultValue="people" className="mb-4">
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="roles">Roles &amp; permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-4 space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, email, or role"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <CapacityHint meter={usage?.staffUsers} noun="staff seats" />
            <Button variant="outline" size="sm" onClick={loadAll}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button
              onClick={openInvite}
              disabled={atSeatLimit}
              title={
                atSeatLimit
                  ? 'Your plan has no staff seats left. Upgrade to invite more.'
                  : undefined
              }
            >
              <Plus /> Invite user
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 && filteredInvites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UsersIcon className="size-5" />
              </div>
              <p className="text-sm font-medium">No users yet</p>
              <Button size="sm" onClick={openInvite}>
                Invite your first user
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[64px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => {
                  const RoleIcon = ROLE_ICON[u.role] || UserRound;
                  const isSelf = currentUser?.userId === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                              {initialsOf(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate">{u.name || '—'}</div>
                            {isSelf ? (
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                You
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="size-3" />
                          {u.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={ROLE_BADGE[u.role] || 'secondary'}
                          className="font-normal"
                        >
                          <RoleIcon className="mr-1 size-3" />
                          {ROLE_LABEL[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="success" className="font-normal">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="font-normal">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={isSelf}
                              aria-label="User actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(u)}>
                              Edit user
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.isActive ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeactivate(u)}
                              >
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleReactivate(u)}
                              >
                                Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredInvites.map((inv) => {
                  const RoleIcon = ROLE_ICON[inv.role] || UserRound;
                  return (
                    <TableRow key={`invite-${inv.id}`} className="bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-muted text-muted-foreground text-[11px] font-semibold">
                              {initialsOf(inv.name || inv.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{inv.name || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="size-3" />
                          {inv.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={ROLE_BADGE[inv.role] || 'secondary'}
                          className="font-normal"
                        >
                          <RoleIcon className="mr-1 size-3" />
                          {ROLE_LABEL[inv.role] || inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning" className="font-normal">
                          Invite pending
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Invite actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleResendInvite(inv)}
                            >
                              Re-send invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRevokeInvite(inv)}
                            >
                              Revoke invite
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesManager />
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => (o ? setInviteOpen(true) : setInviteOpen(false))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              We&apos;ll email an invite link that lets them set their own
              password and sign in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Full name *</Label>
              <Input
                id="inv-name"
                required
                value={inviteForm.name}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email *</Label>
              <Input
                id="inv-email"
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Role *</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) =>
                  setInviteForm((f) => ({
                    ...f,
                    role: v,
                    doctorId: v === 'doctor' ? f.doctorId : '',
                  }))
                }
              >
                <SelectTrigger id="inv-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Admins can manage users and every clinic setting. Doctors and
                receptionists can work on appointments, patients, and billing.
              </p>
            </div>
            {inviteForm.role === 'doctor' ? (
              <div className="space-y-1.5">
                <Label htmlFor="inv-doctor">Link to doctor record</Label>
                <Select
                  value={inviteForm.doctorId || 'none'}
                  onValueChange={(v) =>
                    setInviteForm((f) => ({
                      ...f,
                      doctorId: v === 'none' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger id="inv-doctor">
                    <SelectValue placeholder="Optional — link to existing doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No link —</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                        {d.specialization ? ` — ${d.specialization}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Linking lets this login act as that doctor on appointments,
                  prescriptions, and signatures.
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviteSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteSubmitting}>
                {inviteSubmitting ? 'Sending…' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => (o ? setEditOpen(true) : setEditOpen(false))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update this user&apos;s name, role, or activation status.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full name *</Label>
              <Input
                id="edit-name"
                required
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    role: v,
                    doctorId: v === 'doctor' ? f.doctorId : '',
                  }))
                }
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.role === 'doctor' ? (
              <div className="space-y-1.5">
                <Label htmlFor="edit-doctor">Link to doctor record</Label>
                <Select
                  value={editForm.doctorId || 'none'}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      doctorId: v === 'none' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger id="edit-doctor">
                    <SelectValue placeholder="Optional — link to existing doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No link —</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                        {d.specialization ? ` — ${d.specialization}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
              <input
                id="edit-active"
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="size-4 rounded border-border"
              />
              <div className="flex-1 leading-tight">
                <Label htmlFor="edit-active" className="text-sm">
                  Active
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Inactive users cannot log in.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={editSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

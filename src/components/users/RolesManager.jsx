import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import * as api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

const ROLE_ORDER = ['admin', 'doctor', 'receptionist'];

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

const ROLE_DESCRIPTION = {
  admin: 'Full access to every setting. Not editable — this is the safety-net role.',
  doctor: 'Treating physicians. Default access includes appointments, patients, medical records, consents, and billing.',
  receptionist: 'Front-desk staff. Default access includes appointments, patients, and billing but no medical records.',
};

function sameSet(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  for (const k of a) if (!sb.has(k)) return false;
  return true;
}

/**
 * RolesManager
 *
 * Renders the three role cards. `admin` is display-only; `doctor` and
 * `receptionist` are editable via grouped permission checkboxes. Saving
 * a role posts to the roles endpoint and triggers a `refreshMe()` on
 * the AuthContext so if the current user's role class was affected they
 * see the new grants immediately.
 */
export default function RolesManager() {
  const { refreshMe } = useAuth();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rolesData, setRolesData] = useState(null);
  const [drafts, setDrafts] = useState({}); // role → Set<permission>
  const [savingRole, setSavingRole] = useState(null);
  const [resettingRole, setResettingRole] = useState(null);

  const groupedCatalog = useMemo(() => {
    const map = new Map();
    for (const p of catalog) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    }
    return groups
      .map((g) => ({ group: g, items: map.get(g) || [] }))
      .filter((g) => g.items.length > 0);
  }, [catalog, groups]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRoles();
      const data = res.data.data;
      setCatalog(data.permissions || []);
      setGroups(data.groups || []);
      setRolesData(data.roles || {});
      const next = {};
      for (const role of Object.keys(data.roles || {})) {
        next[role] = new Set(data.roles[role].permissions || []);
      }
      setDrafts(next);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function togglePermission(role, permissionKey) {
    setDrafts((prev) => {
      const nextSet = new Set(prev[role] || []);
      if (nextSet.has(permissionKey)) {
        nextSet.delete(permissionKey);
      } else {
        nextSet.add(permissionKey);
      }
      return { ...prev, [role]: nextSet };
    });
  }

  function toggleGroup(role, groupItems, allSelected) {
    setDrafts((prev) => {
      const nextSet = new Set(prev[role] || []);
      for (const p of groupItems) {
        if (allSelected) nextSet.delete(p.key);
        else nextSet.add(p.key);
      }
      return { ...prev, [role]: nextSet };
    });
  }

  async function saveRole(role) {
    setSavingRole(role);
    try {
      const permissions = Array.from(drafts[role] || []);
      const res = await api.updateRolePermissions(role, permissions);
      const updated = res.data.data;
      setRolesData((prev) => ({ ...prev, [role]: updated }));
      setDrafts((prev) => ({
        ...prev,
        [role]: new Set(updated.permissions || []),
      }));
      toast.success(`${ROLE_LABEL[role]} permissions saved`);
      // If the currently-signed-in user's role was mutated, refresh so
      // their sidebar / gates update without a full reload.
      refreshMe?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save role');
    } finally {
      setSavingRole(null);
    }
  }

  async function resetRole(role) {
    if (
      !window.confirm(
        `Reset the ${ROLE_LABEL[role]} role to its default permissions?`,
      )
    )
      return;
    setResettingRole(role);
    try {
      const res = await api.resetRolePermissions(role);
      const updated = res.data.data;
      setRolesData((prev) => ({ ...prev, [role]: updated }));
      setDrafts((prev) => ({
        ...prev,
        [role]: new Set(updated.permissions || []),
      }));
      toast.success(`${ROLE_LABEL[role]} reset to defaults`);
      refreshMe?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not reset role');
    } finally {
      setResettingRole(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-96 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {ROLE_ORDER.map((role) => {
        const roleInfo = rolesData?.[role];
        if (!roleInfo) return null;
        const RoleIcon = ROLE_ICON[role] || UserRound;
        const draftSet = drafts[role] || new Set();
        const savedSet = new Set(roleInfo.permissions || []);
        const isDirty = !sameSet(Array.from(draftSet), roleInfo.permissions);
        const isSaving = savingRole === role;
        const isResetting = resettingRole === role;
        const isEditable = !!roleInfo.editable;

        return (
          <Card key={role} className="flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RoleIcon className="size-4 text-primary" />
                    {ROLE_LABEL[role]}
                    {roleInfo.isCustomized ? (
                      <Badge variant="soft" className="font-normal">
                        Customized
                      </Badge>
                    ) : null}
                    {!isEditable ? (
                      <Badge variant="secondary" className="font-normal">
                        <Lock className="mr-1 size-3" /> Locked
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {ROLE_DESCRIPTION[role]}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-4 pt-4">
              {groupedCatalog.map(({ group, items }) => {
                const allSelected = items.every((p) => draftSet.has(p.key));
                const someSelected = items.some((p) => draftSet.has(p.key));
                const groupToggleId = `grp-${role}-${group}`;
                return (
                  <div key={group} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group}
                      </div>
                      {isEditable ? (
                        <label
                          htmlFor={groupToggleId}
                          className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Checkbox
                            id={groupToggleId}
                            checked={
                              allSelected
                                ? true
                                : someSelected
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={() =>
                              toggleGroup(role, items, allSelected)
                            }
                          />
                          {allSelected ? 'All' : someSelected ? 'Some' : 'None'}
                        </label>
                      ) : null}
                    </div>
                    <ul className="space-y-1.5">
                      {items.map((perm) => {
                        const checked = draftSet.has(perm.key);
                        const savedChecked = savedSet.has(perm.key);
                        const changed = checked !== savedChecked;
                        const id = `perm-${role}-${perm.key}`;
                        return (
                          <li
                            key={perm.key}
                            className={
                              'flex items-start gap-2.5 rounded-md border border-transparent px-2 py-1.5 hover:border-border/60 hover:bg-muted/30'
                              + (changed ? ' border-primary/30 bg-primary/5' : '')
                            }
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              disabled={!isEditable}
                              onCheckedChange={() =>
                                togglePermission(role, perm.key)
                              }
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={id}
                              className={
                                'flex-1 min-w-0 leading-tight'
                                + (isEditable ? ' cursor-pointer' : '')
                              }
                            >
                              <div className="text-sm font-medium">
                                {perm.label}
                              </div>
                              {perm.description ? (
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  {perm.description}
                                </div>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </CardContent>

            {isEditable ? (
              <div className="flex items-center justify-between gap-2 border-t p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => resetRole(role)}
                  disabled={isSaving || isResetting || !roleInfo.isCustomized}
                >
                  {isResetting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3.5" />
                  )}
                  Reset to defaults
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveRole(role)}
                  disabled={!isDirty || isSaving || isResetting}
                >
                  {isSaving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  {isDirty ? 'Save changes' : 'Saved'}
                </Button>
              </div>
            ) : (
              <div className="border-t p-3 text-[11px] text-muted-foreground">
                Admin has full access and cannot be reduced.
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

import { useAuth } from '../context/AuthContext';

/**
 * <Can /> — declarative permission gate for JSX.
 *
 * Usage:
 *   <Can permission="doctors.manage">
 *     <Button>Add doctor</Button>
 *   </Can>
 *
 *   <Can any={['bills.manage', 'bills.delete']} fallback={<ReadOnlyHint />}>
 *     <BillActions />
 *   </Can>
 *
 * Props:
 *   - permission: single permission string, required unless `all` or `any` is passed.
 *   - all:        array of permissions the user must all hold.
 *   - any:        array of permissions the user must hold at least one of.
 *   - fallback:   optional JSX to render when the user is not authorized.
 *   - children:   JSX rendered when the user is authorized.
 */
export default function Can({
  permission,
  all,
  any,
  children,
  fallback = null,
}) {
  const { can, canAll, canAny } = useAuth();

  let allowed = false;
  if (permission) {
    allowed = can(permission);
  } else if (Array.isArray(all) && all.length) {
    allowed = canAll(all);
  } else if (Array.isArray(any) && any.length) {
    allowed = canAny(any);
  }

  return allowed ? children : fallback;
}

/**
 * `useCan(permission)` — hook flavor of <Can /> for imperative checks or
 * when you need the boolean itself (e.g. to disable a control instead of
 * hiding it).
 *
 * Accepts:
 *   - a single permission string, OR
 *   - an object `{ all: [...] }` / `{ any: [...] }`
 */
export function useCan(input) {
  const { can, canAll, canAny } = useAuth();
  if (typeof input === 'string') return can(input);
  if (input && Array.isArray(input.all)) return canAll(input.all);
  if (input && Array.isArray(input.any)) return canAny(input.any);
  return false;
}

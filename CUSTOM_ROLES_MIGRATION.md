# Custom Roles Migration Guide

## Important note about shared DB (Vasanthi + Dione)

This migration was applied to the **Vasanthi** project only. Both apps share the same Supabase database.

**Do NOT drop the `role` column** from `staff` or `profiles` until Dione is also migrated.
The `role` column must remain in place so Dione continues to work unchanged.

When Vasanthi creates or updates a staff member, it writes **both** `role` and `system_role`
to keep Dione in sync. This is intentional.

---

## Core principle

| Field | Table | Purpose |
|-------|-------|---------|
| `system_role` | `staff`, `profiles` | One of 4 fixed values: `Owner \| Manager \| Receptionist \| Stylist`. Used for ALL permission checks, DB queries, and branch gating. |
| `display_name` | `organization_roles` | Custom per-org label (e.g. "Beautician", "Head Artist"). Used ONLY for UI display. |
| `role` | `staff`, `profiles` | **Keep this column — do not drop it.** Dione still reads it. Vasanthi writes it in sync with `system_role`. |

---

## Why this was done

The `role` column had a DB-level `CHECK` constraint locking values to
`Owner | Manager | Receptionist | Stylist`. Clients can now rename roles
(e.g. "Stylist" → "Beautician") or create sub-roles. The old constraint blocked that.

**Solution:** A new `organization_roles` table maps `display_name → system_role` per org.
The `system_role` drives all logic. The `display_name` is shown in the UI.

---

## Step 1 — Run the DB migration

Run `supabase/migrations/20260513_custom_roles.sql` in **Supabase SQL Editor**.

What it does:
1. Creates `public.organization_roles` table:
   - Columns: `id, organization_id, display_name, system_role, is_deletable, created_at`
   - Unique constraint on `(organization_id, display_name)`
   - `system_role` CHECK: must be one of the 4 fixed values
2. Seeds 4 default roles for every existing organization
3. Adds `system_role text NOT NULL` to `staff` (backfilled from `role`)
4. Adds `system_role text NOT NULL` to `profiles` (backfilled from `role`)
5. Drops CHECK constraint on `staff.role` (column stays, constraint removed)
6. Drops CHECK constraint on `profiles.role` (column stays, constraint removed)
7. Drops CHECK constraint on `commission_settings.role`
8. Drops CHECK constraint on `organization_page_access.role`
9. Enables RLS on `organization_roles` with select/insert/update/delete policies

Also add the `salary` column to `staff` if not already present:
```sql
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary DECIMAL(10,2) DEFAULT NULL;
```

---

## Step 2 — New file: `src/services/orgRoles.ts`

Create this file from scratch. It fetches from `organization_roles` table:

```typescript
import { supabase } from '@/lib/supabase';
import { OrgRole, SystemRole } from '@/lib/types';

export const orgRolesService = {
    async getOrgRoles(organizationId: string): Promise<OrgRole[]> { ... }
    async getAssignableRoles(organizationId: string): Promise<OrgRole[]> { ... } // excludes Owner
    async getSystemRole(organizationId: string, displayName: string): Promise<SystemRole | null> { ... }
};
```

Copy the full file from Vasanthi project: `src/services/orgRoles.ts`

---

## Step 3 — New API route: `src/app/api/staff/create/route.ts`

Staff creation was moved from a Next.js server action to a proper API route (`POST /api/staff/create`).

This fixes a bug where the server action proxied through the page URL instead of Supabase.

The route:
- Authenticates the caller via cookies (must be Owner)
- Creates auth user, profile, and staff entry
- Writes both `role` and `system_role` on insert (to keep Dione in sync)
- Writes `salary` and `commission` on insert
- Sends welcome email

Copy the full file from Vasanthi project: `src/app/api/staff/create/route.ts`

---

## Step 4 — Code changes: file by file

### `src/lib/types.ts`
- Added `export type SystemRole = 'Owner' | 'Manager' | 'Receptionist' | 'Stylist'`
- `UserRole` changed from union type to `string` (display name, can be anything)
- Added `OrgRole` interface:
  ```typescript
  interface OrgRole {
      id: string;
      organizationId: string;
      displayName: string;
      systemRole: SystemRole;
      isDeletable: boolean;
  }
  ```
- `User` type: `role: string` (display name for UI), added `systemRole: SystemRole` (for all checks)
- `Staff` type: `role: string` (display name), added `systemRole?: SystemRole`

---

### `src/lib/auth.tsx`
- Import `SystemRole` instead of `UserRole`
- After loading profile, fetch `display_name` from `organization_roles` matching `system_role`:
  ```typescript
  const { data: orgRole } = await supabase
      .from('organization_roles')
      .select('display_name')
      .eq('organization_id', data.organization_id)
      .eq('system_role', data.system_role)
      .maybeSingle();
  const displayName = orgRole?.display_name ?? data.system_role;
  setUser({ ..., role: displayName, systemRole: data.system_role as SystemRole });
  ```
- `hasRole(roles: SystemRole[])` compares against `user.systemRole` (not `user.role`)

---

### `src/lib/admin-nav.ts`
- `AdminNavItem.allowedRoles` type: `UserRole[]` → `SystemRole[]`
- `filterNavItemsForUser`: uses `user.systemRole`
- `expectedNavHrefsForRole(role: SystemRole)`

---

### `src/lib/workspace.tsx`
All `user.role === '...'` → `user.systemRole === '...'` (4 occurrences).
Also update dependency arrays: `user?.role` → `user?.systemRole`.

---

### `src/components/layout/Header.tsx`
- `user.role === 'Owner'` → `user.systemRole === 'Owner'` for branch picker visibility
- `user?.role` display in the UI stays as-is (it is the display name — correct)

---

### `src/components/layout/Sidebar.tsx` and `src/components/layout/MobileSidebar.tsx`
No logic changes needed. These files query `organization_page_access` using `role` column
which still exists. Display of `user?.role` is correct (it is the display name).

---

### `src/components/auth/ProtectedRoute.tsx`
- Import `SystemRole` instead of `UserRole`
- `allowedRoles?: SystemRole[]`
- Both the `useEffect` and render checks: `user.role` → `user.systemRole`
  ```typescript
  if (allowedRoles && user && !allowedRoles.includes(user.systemRole)) { ... }
  ```

---

### `src/app/admin/(dashboard)/layout.tsx`
```typescript
user.systemRole === 'Manager' || user.systemRole === 'Stylist' || user.systemRole === 'Receptionist'
```
(was `user.role === ...`)

---

### `src/app/actions/staff.ts`
- Both `createStaffAction` and `deleteStaffAction` profile selects:
  ```typescript
  .select('id, system_role, organization_id')  // removed 'role' from select
  ```
- Authorization checks: `callerProfile.system_role !== 'Owner'`

Note: `createStaffAction` is now unused (replaced by the API route) but can stay in the file.

---

### `src/app/api/staff/update/route.ts` (PUT handler)
When `system_role` changes, sync both columns on `staff` and `profiles`:
```typescript
// On staff update — keep role in sync
const staffUpdates = updates.system_role
    ? { ...updates, role: updates.system_role }
    : updates;

// On profile update
if (updates.system_role) {
    profileUpdates.system_role = updates.system_role;
    profileUpdates.role = updates.system_role; // keep Dione in sync
}
```

---

### `src/services/staff.ts`
- Remove `import { createStaffAction }` — now uses `fetch('/api/staff/create', ...)`
- `createStaff()`: changed from calling server action to `fetch('/api/staff/create', { method: 'POST', ... })`
- `updateStaff()` param type: `role?: string` → `system_role?: string`
- All `.eq('role', 'Stylist')` → `.eq('system_role', 'Stylist')` (3 occurrences in `getStylists`, `getStylistsByService`, `getStylistsWithSkills`)

---

### `src/services/earnings.ts`
- `staff:staff(id, name, role)` in join → `staff:staff(id, name, system_role)`
- `calculateDailySalary`: `.select('system_role')`, `staff?.system_role === 'Stylist'`
- `getEarningsSummaryByStaff`: `.select('id, name, system_role')`, `staff_role: staff.system_role`

Note: `.eq('role', 'Stylist')` on `commission_settings` table is intentional — that table still has a `role` column storing system role values.

---

### `src/services/financial.ts`
- `.select('id, name, branch_id, profile_id, system_role')`
- `.eq('system_role', 'Stylist')`
- `requesterRole === 'Stylist'` check stays (caller passes `user.systemRole`)

---

### `src/services/appointments.ts`
- `.select('system_role, id')` from profiles
- `profile?.system_role === 'Stylist'`

---

### `src/services/auth.ts`
- `requestPasswordChangeOTP`: `.select('system_role, email')`, checks `profile.system_role`
- `changePasswordDirect`: `.select('system_role')`, checks `profile.system_role`

---

### `src/services/notifications.ts`
- All `.eq('role', 'Manager')` → `.eq('system_role', 'Manager')`

---

### `src/services/reports.ts`
- `getStaffPerformanceReportData`: fetches `organization_roles` to build `system_role → display_name` map
- Returns `role: roleDisplayMap[staffMember.system_role] ?? staffMember.system_role` for PDF

---

### `src/services/petty-cash.ts`
- Both `getTransactions` and `searchTransactions`: removed `role` from `profiles` join:
  ```typescript
  profiles (
      name      // 'role' removed
  )
  ```

---

### `src/services/settings.ts`
- `getAllStaff()`: `.select('id, name, email, system_role, is_active')` (was `role`)
- `updateCommissionSettings`: `.eq('role', role)` on `commission_settings` table — intentional, that table keeps its `role` column

---

### `src/services/customers.ts`
- `deleteCustomer`: checks for existing appointments before deleting and throws a user-friendly error:
  ```typescript
  if (apptCount > 0) {
      throw new Error(`Cannot delete this customer because they have ${apptCount} appointment(s) on record.`);
  }
  ```

---

### `src/lib/website/api.ts`
- `.eq('role', 'Stylist')` → `.eq('system_role', 'Stylist')` on `staff` table (line ~300)

---

### `src/lib/database.types.ts`
- `profiles.Row`: removed `role: string`, only `system_role: 'Owner' | 'Manager' | 'Receptionist' | 'Stylist'`

---

### `src/lib/website/supabase.ts`
- `DbStaff`: removed `role: string`, only `system_role: 'Owner' | 'Manager' | 'Receptionist' | 'Stylist'`

---

### Public booking API routes (5 files)
All `.eq('role', 'Stylist')` → `.eq('system_role', 'Stylist')`:
- `src/app/api/public/stylists/route.ts`
- `src/app/api/public/available-stylists/route.ts`
- `src/app/api/public/consolidated-availability/route.ts`
- `src/app/api/public/random-book/route.ts`
- `src/app/api/public/book/route.ts`

---

### `src/app/api/appointments/notify/route.ts`
- All `.eq('role', 'Manager')` → `.eq('system_role', 'Manager')`

---

### `src/app/admin/(dashboard)/staff/page.tsx`
- Import `OrgRole` and `orgRolesService`
- Added `orgRoles: OrgRole[]` state
- `fetchData` calls `orgRolesService.getAssignableRoles(organizationId)` in parallel
- Staff mapped with `role: rolesData.find(r => r.systemRole === s.system_role)?.displayName ?? s.system_role`
- Added `systemRole: s.system_role` to mapped staff
- Role filter tabs derived from actual staff display names (dynamic)
- `getFormSystemRole()` helper: resolves selected display name back to system_role
- Form dropdown renders from `orgRoles` (dynamic), falls back to hardcoded if empty
- All `formData.role === 'Stylist'` → `getFormSystemRole() === 'Stylist'`
- Commission badge: `staff.systemRole === 'Stylist'`
- `handleAddStaff` and `handleEditStaff` pass `system_role: getFormSystemRole()`
- Staff display in cards: `{staff.role}` (display name — correct)

---

### `src/app/admin/(dashboard)/settings/page.tsx`
- Import `SystemRole` and `orgRolesService`
- `StaffPasswordSection`: added `orgRoles: Record<string, string>` state (system_role → display_name map)
- Staff query: `.select('id, name, email, system_role')` (was `role`)
- Fetches org roles in parallel and builds display map
- Dropdown shows: `{s.name} - {orgRoles[s.system_role] ?? s.system_role} ({s.email})`

---

### `src/app/admin/(dashboard)/settings/PageAccessSettings.tsx`
- Import `SystemRole` instead of `UserRole`
- `roles: SystemRole[]` array
- `PageAccessRow.role: SystemRole`
- `updateAllowed(pageKey, role: SystemRole, ...)`
- `payload` typed with `SystemRole`
- `leftIcon` prop removed from Save button — icon moved inside children (React 18.3 type fix)
- `.upsert(payload as any, { onConflict: ... } as any)` — cast needed since `organization_page_access` is not in typed schema

---

### `src/app/admin/(dashboard)/dashboard/page.tsx`
All `user?.role === '...'` → `user?.systemRole === '...'` and dependency arrays updated.

---

### `src/app/admin/(dashboard)/appointments/page.tsx`
`user?.role === 'Stylist'` → `user?.systemRole === 'Stylist'`

---

### `src/app/admin/(dashboard)/earnings/page.tsx`
All `user?.role === '...'` → `user?.systemRole === '...'`

---

### `src/app/admin/(dashboard)/financial/page.tsx`
- `user?.systemRole` for all checks
- Dependency array: `user?.systemRole`

---

### `src/app/admin/(dashboard)/petty-cash/page.tsx`
`user?.role === 'Owner' || user?.role === 'Manager'` → `user?.systemRole === 'Owner' || user?.systemRole === 'Manager'`

---

### `src/app/admin/select-branch/page.tsx`
`user.role === 'Owner'` → `user.systemRole === 'Owner'`

---

### `src/app/admin/(dashboard)/pos/page.tsx`
- Staff fetch: `.select('id, name, system_role')` and `.eq('system_role', 'Stylist')`
- Walk-in customer creation: added `organization_id: user?.organizationId` to insert
- Customer dropdown: moved outside `surface-panel` card to fix z-index stacking context issue on mobile/tablet (backdrop-blur creates a new stacking context that traps child z-index)

---

## How custom roles work after migration

1. Each org has rows in `organization_roles` with their own display names
2. `staff.system_role` and `profiles.system_role` store the behavioral role
3. `staff.role` and `profiles.role` still exist and store the system role value (for Dione compatibility)
4. All permission checks, DB queries, branch gating use `system_role`
5. All UI labels fetch `display_name` from `organization_roles`

### To rename a role (e.g. "Stylist" → "Beautician"):
1. Update `organization_roles` row: set `display_name = 'Beautician'` where `system_role = 'Stylist'` for that org
2. The UI will immediately show "Beautician" everywhere
3. `system_role` stays `'Stylist'` — no logic changes needed

### To add a custom sub-role (e.g. "Junior Stylist"):
1. Insert into `organization_roles`: `display_name='Junior Stylist', system_role='Stylist'`
2. Staff assigned "Junior Stylist" will automatically have all Stylist permissions

---

## Files changed summary

| File | Change |
|------|--------|
| `supabase/migrations/20260513_custom_roles.sql` | New — DB migration |
| `src/services/orgRoles.ts` | New — org roles service |
| `src/app/api/staff/create/route.ts` | New — staff creation API route |
| `src/lib/types.ts` | SystemRole type, OrgRole interface, User.systemRole |
| `src/lib/auth.tsx` | Load display_name, hasRole uses systemRole |
| `src/lib/admin-nav.ts` | SystemRole type on allowedRoles |
| `src/lib/workspace.tsx` | user.role → user.systemRole (4 places) |
| `src/lib/database.types.ts` | system_role in profiles type |
| `src/lib/website/api.ts` | .eq('role') → .eq('system_role') on staff |
| `src/lib/website/supabase.ts` | system_role in DbStaff type |
| `src/components/layout/Header.tsx` | systemRole check for branch picker |
| `src/components/auth/ProtectedRoute.tsx` | SystemRole type, user.systemRole check |
| `src/app/admin/(dashboard)/layout.tsx` | user.systemRole checks |
| `src/app/actions/staff.ts` | system_role in profile selects, auth checks |
| `src/app/api/staff/update/route.ts` | Sync role+system_role on update |
| `src/app/api/appointments/notify/route.ts` | .eq('system_role', 'Manager') |
| `src/services/staff.ts` | system_role queries, fetch-based createStaff |
| `src/services/earnings.ts` | system_role in joins and checks |
| `src/services/financial.ts` | system_role filter |
| `src/services/appointments.ts` | system_role check |
| `src/services/auth.ts` | system_role checks |
| `src/services/notifications.ts` | .eq('system_role', 'Manager') |
| `src/services/reports.ts` | display_name map for PDF, system_role |
| `src/services/petty-cash.ts` | removed role from profiles join |
| `src/services/settings.ts` | system_role in staff select |
| `src/services/customers.ts` | friendly error on delete with appointments |
| `src/app/api/public/stylists/route.ts` | .eq('system_role', 'Stylist') |
| `src/app/api/public/available-stylists/route.ts` | .eq('system_role', 'Stylist') |
| `src/app/api/public/consolidated-availability/route.ts` | .eq('system_role', 'Stylist') |
| `src/app/api/public/random-book/route.ts` | .eq('system_role', 'Stylist') |
| `src/app/api/public/book/route.ts` | .eq('system_role', 'Stylist') |
| `src/app/admin/(dashboard)/staff/page.tsx` | Dynamic org roles, systemRole throughout |
| `src/app/admin/(dashboard)/settings/page.tsx` | system_role in staff query, display map |
| `src/app/admin/(dashboard)/settings/PageAccessSettings.tsx` | SystemRole type, button fix |
| `src/app/admin/(dashboard)/dashboard/page.tsx` | user.systemRole checks |
| `src/app/admin/(dashboard)/appointments/page.tsx` | user.systemRole check |
| `src/app/admin/(dashboard)/earnings/page.tsx` | user.systemRole checks |
| `src/app/admin/(dashboard)/financial/page.tsx` | user.systemRole checks |
| `src/app/admin/(dashboard)/petty-cash/page.tsx` | user.systemRole checks |
| `src/app/admin/select-branch/page.tsx` | user.systemRole check |
| `src/app/admin/(dashboard)/pos/page.tsx` | system_role filter, org_id on insert, dropdown z-index fix |

# Custom Roles Migration Guide

## Core principle
- `system_role` — stored in `staff` and `profiles`, used for ALL logic and validation
- `display_name` — stored in `organization_roles`, used for ALL UI display
- The old `role` column is completely dropped from `staff` and `profiles`


This document explains every change made to support per-organization custom role names.
Apply these to any copy of this project that connects to the same database.

---

## Why this was done

The `role` column in `staff` and `profiles` previously had a DB-level `CHECK` constraint
locking values to `Owner | Manager | Receptionist | Stylist`. Clients can now rename
roles (e.g. "Stylist" → "Head Artist") or add new ones. The old constraint blocked that.

**Solution:** Split role into two fields:
- `role` — display name (free text, custom per org, shown in UI)
- `system_role` — one of the 4 fixed behavioral values, used for all permission/query logic

---

## Step 1 — Run the DB migration

Run `supabase/migrations/20260513_custom_roles.sql` in **Supabase SQL Editor**.

What it does:
1. Creates `public.organization_roles` table with columns:
   - `id`, `organization_id`, `display_name`, `system_role`, `is_deletable`, `created_at`
   - Unique constraint on `(organization_id, display_name)`
   - `system_role` still has a CHECK: `Owner | Manager | Receptionist | Stylist`
2. Seeds the 4 default roles for every existing organization
3. Adds `system_role text NOT NULL` column to `staff` (backfilled from `role`)
4. Adds `system_role text NOT NULL` column to `profiles` (backfilled from `role`)
5. Drops the CHECK constraint on `staff.role` (now free text)
6. Drops the CHECK constraint on `profiles.role` (now free text)
7. Drops the CHECK constraint on `commission_settings.role`
8. Drops the CHECK constraint on `organization_page_access.role`
9. Enables RLS on `organization_roles` with select/insert/update/delete policies

---

## Step 2 — Code changes (apply to both project copies)

### New file: `src/services/orgRoles.ts`
Create this file. It exposes:
- `getOrgRoles(organizationId)` — all roles for an org
- `getAssignableRoles(organizationId)` — roles excluding Owner (for staff creation forms)
- `getSystemRole(organizationId, displayName)` — looks up system_role by display name

### `src/lib/types.ts`
- Added `SystemRole = 'Owner' | 'Manager' | 'Receptionist' | 'Stylist'`
- Changed `UserRole` from a union type to `string` (display name, can be anything)
- Added `OrgRole` interface: `{ id, organizationId, displayName, systemRole, isDeletable }`
- `User.role` stays `string` (display), added `User.systemRole: SystemRole` (behavioral)
- `Staff.role` stays `string`, added `Staff.systemRole?: SystemRole`

### `src/lib/auth.tsx`
- Import `SystemRole` instead of `UserRole`
- `hasRole()` parameter changed to `SystemRole[]`, compares against `user.systemRole`
- `fetchUserProfile` maps `data.system_role` (with fallback to `data.role`) into `user.systemRole`

### `src/lib/admin-nav.ts`
- `AdminNavItem.allowedRoles` type changed from `UserRole[]` to `SystemRole[]`
- `filterNavItemsForUser` parameter changed to `{ systemRole: SystemRole }`, uses `user.systemRole`
- `expectedNavHrefsForRole` parameter type changed to `SystemRole`

### `src/lib/workspace.tsx`
All 4 occurrences of `user.role === '...'` changed to `user.systemRole === '...'`

### `src/components/layout/Header.tsx`
`user.role === 'Owner'` → `user.systemRole === 'Owner'`

### `src/app/admin/(dashboard)/layout.tsx`
`user.role === 'Manager'|'Stylist'|'Receptionist'` → `user.systemRole === ...`

### `src/app/actions/staff.ts`
- `createStaffAction` parameter: added `system_role: string`, `role` is now `string`
- `callerProfile` now selects `system_role` — comparisons use `system_role`
- Both `profiles.insert` and `staff.insert` now include `system_role`
- `deleteStaffAction` selects `system_role` and checks `system_role !== 'Owner'`

### `src/app/api/staff/update/route.ts`
- PUT handler: when `updates.role` changes, looks up `system_role` from `organization_roles`
  and also updates `staff.system_role` and `profiles.system_role`
- PATCH handler: selects `system_role` from staff, checks `system_role` for Owner/Manager

### `src/services/staff.ts`
- All `.eq('role', 'Stylist')` → `.eq('system_role', 'Stylist')`
- `createStaff()` parameter: added `system_role: string`, `role` is now `string`

### `src/services/earnings.ts`
- `calculateDailySalary`: selects `system_role`, checks `system_role === 'Stylist'`

### `src/services/financial.ts`
- `getStylistsFinancials`: selects `system_role`, filters `.eq('system_role', 'Stylist')`

### `src/services/appointments.ts`
- `getAppointments`: selects `system_role`, checks `system_role === 'Stylist'`

### `src/services/auth.ts`
- `requestPasswordChangeOTP`: selects `system_role`, checks against `system_role`
- `changePassword`: selects `system_role`, checks against `system_role`

### `src/services/notifications.ts`
- All `.eq('role', 'Manager')` → `.eq('system_role', 'Manager')`

### `src/app/api/appointments/notify/route.ts`
- All `.eq('role', 'Manager')` → `.eq('system_role', 'Manager')`

### Public API routes (5 files)
All `.eq('role', 'Stylist')` → `.eq('system_role', 'Stylist')` in:
- `src/app/api/public/stylists/route.ts`
- `src/app/api/public/available-stylists/route.ts`
- `src/app/api/public/consolidated-availability/route.ts`
- `src/app/api/public/random-book/route.ts`
- `src/app/api/public/book/route.ts`

### `src/app/admin/(dashboard)/staff/page.tsx`
- Imports `OrgRole` type and `orgRolesService`
- Added `orgRoles: OrgRole[]` state variable
- `fetchData` now also calls `orgRolesService.getAssignableRoles()`
- Staff mapping now includes `systemRole: s.system_role`
- Role filter tabs derived from actual staff display names (dynamic)
- Form `role` field type changed to `string`
- Form dropdown now renders from `orgRoles` (falls back to hardcoded if empty)
- Commission logic uses `systemRole === 'Stylist'` instead of `role === 'Stylist'`
- Commission badge on staff card uses `staff.systemRole === 'Stylist'`
- `handleAddStaff` and `handleEditStaff` pass `system_role` via `getFormSystemRole()`

### `src/app/admin/(dashboard)/earnings/page.tsx`
`user?.role === '...'` → `user?.systemRole === '...'`

### `src/app/admin/(dashboard)/financial/page.tsx`
- `canCreateAdvance` checks `user?.systemRole`
- `requesterRole` passes `user.systemRole` (not `user.role`)

### `src/app/admin/(dashboard)/petty-cash/page.tsx`
`user?.role === '...'` → `user?.systemRole === '...'`

### `src/lib/database.types.ts`
- `profiles.Row.role` changed to `string`
- Added `profiles.Row.system_role: 'Owner' | 'Manager' | 'Receptionist' | 'Stylist'`

### `src/lib/website/supabase.ts`
- `DbStaff.role` changed to `string`
- Added `DbStaff.system_role: 'Owner' | 'Manager' | 'Receptionist' | 'Stylist'`

### `src/app/admin/(dashboard)/settings/PageAccessSettings.tsx`
- Import `SystemRole` instead of `UserRole`
- `roles` array, `pageDefaults`, `updateAllowed`, and `payload` all typed with `SystemRole`

---

## How custom roles work after this migration

1. Each organization has rows in `organization_roles` with their own display names
2. `staff.role` and `profiles.role` store the display name (e.g. "Head Artist")
3. `staff.system_role` and `profiles.system_role` store the behavioral role (e.g. "Stylist")
4. All permission checks, DB queries, and branch gating use `system_role`
5. All UI labels display `role` (the friendly display name)

### To rename a role (e.g. "Stylist" → "Head Artist"):
1. In Supabase, update `organization_roles` row: set `display_name = 'Head Artist'` for that org
2. Update all `staff.role` and `profiles.role` for that org to `'Head Artist'`
3. `system_role` stays `'Stylist'` — no behavioral change

### To add a new custom role (e.g. "Junior Stylist"):
1. Insert into `organization_roles`: `display_name='Junior Stylist', system_role='Stylist'`
2. Staff with that role will have all Stylist permissions automatically

---

## Files changed summary

| File | Change type |
|---|---|
| `supabase/migrations/20260513_custom_roles.sql` | New — DB migration |
| `src/services/orgRoles.ts` | New — org roles service |
| `src/lib/types.ts` | Updated — SystemRole, OrgRole, User, Staff |
| `src/lib/auth.tsx` | Updated — load systemRole, update hasRole |
| `src/lib/admin-nav.ts` | Updated — use SystemRole type |
| `src/lib/workspace.tsx` | Updated — 4 role checks |
| `src/components/layout/Header.tsx` | Updated — 1 role check |
| `src/app/admin/(dashboard)/layout.tsx` | Updated — 1 role check |
| `src/app/actions/staff.ts` | Updated — system_role in create/delete |
| `src/app/api/staff/update/route.ts` | Updated — sync system_role on role change |
| `src/services/staff.ts` | Updated — system_role in queries and create |
| `src/services/earnings.ts` | Updated — system_role check |
| `src/services/financial.ts` | Updated — system_role filter |
| `src/services/appointments.ts` | Updated — system_role check |
| `src/services/auth.ts` | Updated — system_role checks |
| `src/services/notifications.ts` | Updated — system_role query |
| `src/app/api/appointments/notify/route.ts` | Updated — system_role query |
| `src/app/api/public/stylists/route.ts` | Updated — system_role filter |
| `src/app/api/public/available-stylists/route.ts` | Updated — system_role filter |
| `src/app/api/public/consolidated-availability/route.ts` | Updated — system_role filter |
| `src/app/api/public/random-book/route.ts` | Updated — system_role filter |
| `src/app/api/public/book/route.ts` | Updated — system_role filter |
| `src/app/admin/(dashboard)/staff/page.tsx` | Updated — dynamic org roles, systemRole |
| `src/app/admin/(dashboard)/earnings/page.tsx` | Updated — systemRole check |
| `src/app/admin/(dashboard)/financial/page.tsx` | Updated — systemRole checks |
| `src/app/admin/(dashboard)/petty-cash/page.tsx` | Updated — systemRole check |
| `src/lib/database.types.ts` | Updated — system_role in profiles |
| `src/lib/website/supabase.ts` | Updated — system_role in DbStaff |
| `src/app/admin/(dashboard)/settings/PageAccessSettings.tsx` | Updated — SystemRole type |

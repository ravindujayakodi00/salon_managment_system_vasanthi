/**
 * Page access matrix (`organization_page_access` table).
 *
 * If you see 404 on `/rest/v1/organization_page_access`, apply the migration:
 * `supabase/migrations/20260329_organization_page_access.sql` in the Supabase SQL editor.
 *
 * Until then, set in `.env.local`:
 *   NEXT_PUBLIC_ORG_PAGE_ACCESS=0
 * to skip those queries (sidebar uses hard-coded role lists only).
 */
export function isOrgPageAccessEnabled(): boolean {
    return process.env.NEXT_PUBLIC_ORG_PAGE_ACCESS !== '0';
}

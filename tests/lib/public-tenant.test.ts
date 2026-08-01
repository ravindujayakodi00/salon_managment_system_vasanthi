import { resolvePublicOrganizationId } from '@/lib/public-tenant';

function createAdminMock(row: { id: string; slug: string } | null) {
    const filters: Array<[string, unknown]> = [];
    type QueryMock = {
        select: jest.Mock<QueryMock, []>;
        eq: jest.Mock<QueryMock, [string, unknown]>;
        maybeSingle: jest.Mock<Promise<{ data: typeof row; error: null }>, []>;
    };
    const query = {} as QueryMock;
    query.select = jest.fn(() => query);
    query.eq = jest.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
    });
    query.maybeSingle = jest.fn(async () => ({ data: row, error: null }));
    const admin = { from: jest.fn(() => query) };
    return { admin, filters };
}

describe('resolvePublicOrganizationId', () => {
    const configuredId = process.env.NEXT_PUBLIC_ORGANIZATION_ID as string;

    it('rejects another valid organization UUID before querying the database', async () => {
        const { admin } = createAdminMock(null);

        const result = await resolvePublicOrganizationId(
            admin as never,
            '00000000-0000-4000-8000-000000000001'
        );

        expect(result).toBeNull();
        expect(admin.from).not.toHaveBeenCalled();
    });

    it('allows the configured UUID and constrains the database lookup to it', async () => {
        const row = { id: configuredId, slug: 'configured-salon' };
        const { admin, filters } = createAdminMock(row);

        const result = await resolvePublicOrganizationId(admin as never, configuredId);

        expect(result).toEqual({ organizationId: configuredId, slug: 'configured-salon' });
        expect(filters).toContainEqual(['id', configuredId]);
        expect(filters).toContainEqual(['is_active', true]);
    });

    it('constrains slug lookups to the configured organization ID', async () => {
        const row = { id: configuredId, slug: 'configured-salon' };
        const { admin, filters } = createAdminMock(row);

        const result = await resolvePublicOrganizationId(admin as never, 'configured-salon');

        expect(result).toEqual({ organizationId: configuredId, slug: 'configured-salon' });
        expect(filters).toContainEqual(['id', configuredId]);
        expect(filters).toContainEqual(['slug', 'configured-salon']);
    });
});

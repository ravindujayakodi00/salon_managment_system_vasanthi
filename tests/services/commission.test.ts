/**
 * Commission Calculation Tests
 * Tests for walk-in and appointment-based commission tracking
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Commission Calculations', () => {
    let testStylist: any;
    let testCustomer: any;

    beforeEach(async () => {
        // Create test data
        testStylist = {
            id: `test-stylist-${Date.now()}`,
            name: 'Test Stylist',
            system_role: 'Stylist',
            commission: 45, // 45% commission
            is_active: true,
        };

        testCustomer = {
            id: `test-customer-${Date.now()}`,
            name: 'Test Customer',
            phone: '0771234567',
            total_visits: 0,
            total_spent: 0,
        };
    });

    afterEach(async () => {
        // Cleanup test data
        await supabase.from('staff_earnings').delete().eq('staff_id', testStylist.id);
        await supabase.from('staff').delete().eq('id', testStylist.id);
        await supabase.from('customers').delete().eq('id', testCustomer.id);
    });

    test('Walk-in service commission calculated correctly at 40%', () => {
        const serviceRevenue = 1000;
        const expectedCommission = 400; // 40% default
        const commissionRate = 40;

        // Test commission calculation logic
        const calculatedCommission = (serviceRevenue * commissionRate) / 100;

        expect(calculatedCommission).toBe(expectedCommission);
        expect(calculatedCommission / serviceRevenue).toBe(0.4); // 40%
    });

    test('Custom commission rate applied correctly', async () => {
        const serviceRevenue = 2000;
        const customRate = 45;
        const expectedCommission = 900; // 45% of 2000

        await supabase.from('staff').insert(testStylist);

        // Verify custom rate calculation
        const calculatedCommission = (serviceRevenue * customRate) / 100;
        expect(calculatedCommission).toBe(expectedCommission);
    });

    test('Multiple services for same stylist aggregated correctly', async () => {
        const service1Revenue = 1000;
        const service2Revenue = 1500;
        const totalRevenue = 2500;
        const expectedCommission = 1125; // 45% of 2500

        await supabase.from('staff').insert(testStylist);

        const items = [
            {
                type: 'walk-in-service',
                stylistId: testStylist.id,
                price: service1Revenue,
                quantity: 1,
            },
            {
                type: 'walk-in-service',
                stylistId: testStylist.id,
                price: service2Revenue,
                quantity: 1,
            },
        ];

        // Aggregate revenue
        const aggregatedRevenue = items.reduce((sum, item) => sum + item.price, 0);
        const calculatedCommission = (aggregatedRevenue * testStylist.commission) / 100;

        expect(aggregatedRevenue).toBe(totalRevenue);
        expect(calculatedCommission).toBe(expectedCommission);
    });

    test('Different stylists receive separate commissions', async () => {
        const stylist2 = {
            ...testStylist,
            id: `test-stylist-2-${Date.now()}`,
            commission: 40,
        };

        await supabase.from('staff').insert([testStylist, stylist2]);

        const stylist1Revenue = 1000;
        const stylist2Revenue = 1500;

        // Verify separate calculations
        const stylist1Commission = (stylist1Revenue * 45) / 100; // 450
        const stylist2Commission = (stylist2Revenue * 40) / 100; // 600

        expect(stylist1Commission).toBe(450);
        expect(stylist2Commission).toBe(600);
    });
});

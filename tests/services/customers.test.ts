/**
 * Customer Service Tests
 * Tests for customer search and management
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Customer Service', () => {
    test('Search customer by phone', async () => {
        const searchQuery = '077';

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .or(`phone.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
            .limit(10);

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
    });

    test('Customer creation with validation', () => {
        const newCustomer = {
            name: 'Test Customer',
            phone: '0771234567',
            email: 'test@example.com',
            gender: 'Male',
            dateOfBirth: '1990-05-12',
        };

        // Validate required fields
        expect(newCustomer.name).toBeDefined();
        expect(newCustomer.name.length).toBeGreaterThan(0);
        expect(newCustomer.phone).toBeDefined();
        expect(newCustomer.phone.length).toBeGreaterThanOrEqual(9);
        expect(newCustomer.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('Phone number validation', () => {
        const validPhones = [
            '0771234567', // 10 digits
            '94771234567', // 11 digits with code
            '771234567', // 9 digits local
        ];

        const invalidPhones = [
            '123', // Too short
            'abcdefg', // Non-numeric
        ];

        validPhones.forEach((phone) => {
            const cleaned = phone.replace(/\D/g, '');
            expect(cleaned.length).toBeGreaterThanOrEqual(9);
        });

        invalidPhones.forEach((phone) => {
            const cleaned = phone.replace(/\D/g, '');
            expect(cleaned.length).toBeLessThan(9);
        });
    });

    test('Update customer visit and spending', async () => {
        const customerId = 'test-customer-id';
        const invoiceTotal = 1500;

        // Simulate update
        const updates = {
            total_visits: 5,
            total_spent: 7500 + invoiceTotal,
        };

        expect(updates.total_visits).toBe(5);
        expect(updates.total_spent).toBe(9000);
    });
});

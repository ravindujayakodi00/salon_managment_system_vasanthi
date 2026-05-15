// Test setup file
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Set test timeout
jest.setTimeout(30000);

// Global test utilities
declare global {
    var testUtils: {
        createTestCustomer: () => any;
        createTestStaff: () => any;
        createTestService: () => any;
    };
}

(global as any).testUtils = {
    // Helper to create test data
    createTestCustomer: () => ({
        id: `test-customer-${Date.now()}`,
        name: 'Test Customer',
        phone: '0771234567',
        email: 'test@example.com',
        gender: 'Male',
        total_visits: 0,
        total_spent: 0,
    }),

    createTestStaff: () => ({
        id: `test-staff-${Date.now()}`,
        name: 'Test Stylist',
        system_role: 'Stylist',
        commission: 40,
        is_active: true,
    }),

    createTestService: () => ({
        id: `test-service-${Date.now()}`,
        name: 'Haircut',
        category: 'Hair',
        price: 1000,
        duration: 60,
        is_active: true,
    }),
};

export { };

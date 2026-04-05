import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/tests/services/**/*.test.ts', '**/tests/qa/**/*.test.ts', '**/tests/lib/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'], // Ignore E2E tests
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: [
        'src/services/**/*.ts',
        'src/lib/**/*.ts',
        'src/app/api/**/*.ts',
        '!src/**/*.d.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 75,
            lines: 75,
            statements: 75,
        },
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};

export default config;

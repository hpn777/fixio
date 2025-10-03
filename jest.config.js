module.exports = {
  preset: 'ts-jest',
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        types: ['jest', 'node'],
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};
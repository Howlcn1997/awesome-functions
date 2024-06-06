import type { Config } from 'jest';

const config: Config = {
  verbose: true,
  preset: 'ts-jest',
  //   testEnvironment: 'node',
  //   testMatch: ['**/*.test.ts'],
  //   setupFilesAfterEnv: ['./jest.setup.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};

export default config;

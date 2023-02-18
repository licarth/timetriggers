/** @type {import('ts-jest').JestConfigWithTsJest} */

const { pathsToModuleNameMapper } = require("ts-jest");
// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):
// Import as json to avoid TS errors
const tsconfig = require("./tsconfig.base.json");

const compilerOptions = tsconfig.compilerOptions;

const pathsEntries = pathsToModuleNameMapper(compilerOptions.paths, {
  useESM: true,
  prefix: "<rootDir>/",
});

const esModules = [].join("|");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  // From https://github.com/kulshekhar/ts-jest/issues/1057#issuecomment-1068342692
  transform: {
    "\\.[jt]sx?$": ["ts-jest", { useESM: true }],
  },
  transformIgnorePatterns: [`node_modules/(?!${esModules}/.*)`],
  extensionsToTreatAsEsm: [".ts"],

  roots: ["<rootDir>"],
  moduleNameMapper: {
    ...pathsEntries,
  },
  modulePathIgnorePatterns: ["<rootDir>/built/"],
};

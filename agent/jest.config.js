/** @type {import('ts-jest').JestConfigWithTsJest} */

import { pathsToModuleNameMapper } from "ts-jest";
// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):
// Import as json to avoid TS errors
import dotenv from "dotenv";
import tsconfig from "./tsconfig.json" assert { type: "json" };

dotenv.config();

const compilerOptions = tsconfig.compilerOptions;

const pathsEntries = pathsToModuleNameMapper(compilerOptions.paths, {
  useESM: true,
  prefix: "<rootDir>/",
});

const esModules = [
  "get-port",
  "chalk",
  "@timetriggers/domain",
  "p-queue",
  "p-timeout",
].join("|");

export default {
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

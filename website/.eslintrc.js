/** @type {import('@types/eslint').Linter.BaseConfig} */
module.exports = {
  extends: [
    '@remix-run/eslint-config',
    '@remix-run/eslint-config/jest',
    'plugin:testing-library/react',
    'plugin:jest-dom/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    'cypress/globals': true,
  },
  plugins: ['cypress', 'testing-library', 'jest-dom', 'prettier'],
  // We're using vitest which has a very similar API to jest
  // (so the linting plugins work nicely), but we have to
  // set the jest version explicitly.
  settings: {
    jest: {
      version: 28,
    },
  },
  rules: {
    'react-hooks/exhaustive-deps': 'off',
    'prettier/prettier': 'warn',
  },
};

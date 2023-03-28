/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  cacheDirectory: './node_modules/.cache/remix',
  ignoredRouteFiles: [
    '**/.*',
    '**/*.css',
    '**/*.test.{js,jsx,ts,tsx}',
  ],
  watchPaths: ['../domain/built'],
  serverDependenciesToBundle: [
    '@timetriggers/domain', // This is essential for FieldValue to work properly in @timetriggers/domain,
    'p-queue',
  ],
};

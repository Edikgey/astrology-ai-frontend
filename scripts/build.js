// Production build without source maps (audit L5): the site must not ship its sources.
// Runs the usual react-scripts build with GENERATE_SOURCEMAP=false; works on Windows and Linux.
// `npm start` is untouched and keeps the maps.
const { spawnSync } = require('child_process');

const result = spawnSync(
  process.execPath,
  [require.resolve('react-scripts/bin/react-scripts.js'), 'build'],
  { stdio: 'inherit', env: { ...process.env, GENERATE_SOURCEMAP: 'false' } }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);

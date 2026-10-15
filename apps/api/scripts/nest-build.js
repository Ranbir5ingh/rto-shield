const { spawnSync } = require('child_process');
const path = require('path');

const nestBin = require.resolve('@nestjs/cli/bin/nest.js');
const result = spawnSync(process.execPath, [nestBin, 'build'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});

process.exit(result.status === null ? 1 : result.status);

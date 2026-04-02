'use strict';

/**
 * Cross-platform `npm run bridge`:
 * - Windows: mt5-bridge/windows/StartBridge.bat (PowerShell + Python)
 * - macOS/Linux: ./start-bridge.sh
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

if (process.platform === 'win32') {
  const bat = path.join(root, 'mt5-bridge', 'windows', 'StartBridge.bat');
  if (!fs.existsSync(bat)) {
    console.error('Missing Windows bridge launcher:', bat);
    process.exit(1);
  }
  const shell = process.env.ComSpec || 'cmd.exe';
  const r = spawnSync(shell, ['/c', bat], {
    stdio: 'inherit',
    cwd: root,
  });
  process.exit(r.status === null ? 1 : r.status);
}

const shScript = path.join(root, 'start-bridge.sh');
if (!fs.existsSync(shScript)) {
  console.error('Missing:', shScript);
  process.exit(1);
}
const r = spawnSync('sh', [shScript], { stdio: 'inherit', cwd: root });
process.exit(r.status === null ? 1 : r.status);

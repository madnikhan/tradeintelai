/**
 * Vercel builds fail when mt5-commands/mt5-responses are broken symlinks.
 * Replace them with empty directories on Vercel only (local symlinks stay intact).
 */
const fs = require('fs');
const path = require('path');

if (!process.env.VERCEL) {
  process.exit(0);
}

for (const dir of ['mt5-commands', 'mt5-responses']) {
  const full = path.join(process.cwd(), dir);
  try {
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(full);
      fs.mkdirSync(full);
    }
  } catch {
    fs.mkdirSync(full, { recursive: true });
  }
}

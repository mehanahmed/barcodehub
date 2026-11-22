import fs from 'fs';

/**
 * PGlite corrupts its data folder if two processes open it at once, so every process
 * that opens one takes `<dataDir>.lock` first. Throws if another live process holds it.
 */
export function lockDataDir(dataDir) {
  const lockPath = `${dataDir}.lock`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      process.on('exit', () => {
        try {
          if (fs.readFileSync(lockPath, 'utf8') === String(process.pid)) fs.unlinkSync(lockPath);
        } catch {
          // already gone
        }
      });
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const owner = Number(fs.readFileSync(lockPath, 'utf8'));
      if (owner === process.pid) return; // same process re-opening (e.g. Vite restart)
      if (isAlive(owner)) {
        throw new Error(
          `Database folder ${dataDir} is in use by process ${owner}. Stop that process (dev server, tests or migration) first.`
        );
      }
      fs.unlinkSync(lockPath); // left behind by a crashed process
    }
  }
  throw new Error(`Could not lock database folder ${dataDir}.`);
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

import { cp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sha = process.argv[2] || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`not a git sha: ${sha}`);

await rm('dist', { recursive: true, force: true });
await cp('app', 'dist', { recursive: true });
const html = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', html.replaceAll('__BUILD_SHA__', sha));
console.log(`dist/ stamped with ${sha}`);

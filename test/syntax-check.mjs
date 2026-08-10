import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['--check', new URL('../src/worker.js', import.meta.url).pathname], { stdio: 'inherit' });
console.log('worker syntax check passed');

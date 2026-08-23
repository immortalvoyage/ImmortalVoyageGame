import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const CHECK_ROOTS = ['src', 'dev', 'public', 'tests', 'scripts'];
const EXTENSIONS = new Set(['.js', '.mjs']);

function extension(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

async function collectSourceFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(path));
    } else if (entry.isFile() && EXTENSIONS.has(extension(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const files = [];
for (const root of CHECK_ROOTS) files.push(...await collectSourceFiles(root));
files.sort();

for (const file of files) {
  if (runNode(['--check', file]) !== 0) process.exit(1);
}

if (runNode(['--test']) !== 0) process.exit(1);
console.log(`verify: ${files.length} source files checked; tests passed`);

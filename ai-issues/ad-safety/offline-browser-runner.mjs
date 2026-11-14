import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Run the existing assertions with external traffic disabled at browser launch.
// Localhost bypasses the deliberately unavailable proxy. No genuine ads load.
const name = process.argv[2];
assert.ok(['monetization-browser-smoke', 'navigation-browser-audit', 'accessibility-smoke', 'converter-export-compression-smoke', 'hybrid-browser-smoke'].includes(name));
const source = await readFile(`scripts/${name}.mjs`, 'utf8');
const needle = '"--headless=new",';
assert.equal(source.split(needle).length, 2, 'one browser launch to protect');
const offline = source.replace(needle, `${needle}\n    "--proxy-server=http://127.0.0.1:9",\n    "--proxy-bypass-list=localhost;127.0.0.1",`);
const temporary = path.resolve(`scripts/.ad-safety-${name}-${process.pid}.mjs`);
await mkdir('tmp/ad-safety', { recursive: true });
await writeFile(temporary, offline);
try {
  const child = spawn(process.execPath, [temporary], { stdio: 'inherit', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  await writeFile(`tmp/ad-safety/${name}-provenance.json`, JSON.stringify({ source: `scripts/${name}.mjs`, sha256: createHash('sha256').update(source).digest('hex'), modification: 'Only two browser-launch proxy arguments; original assertions unchanged.', node: process.version, code }, null, 2));
  process.exitCode = code ?? 1;
} finally {
  await unlink(temporary);
}

import { spawn } from 'node:child_process';
// Accept the preview runner's Vite-style flags without changing Next.js.
const incoming = process.argv.slice(2);
const args = incoming.flatMap(arg => arg === '--strictPort' ? [] : [arg === '--host' ? '--hostname' : arg]);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...args], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));

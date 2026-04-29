import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadDotEnv(dir) {
	const envPath = path.join(dir, '.env');
	if (!fs.existsSync(envPath)) return;
	const text = fs.readFileSync(envPath, 'utf8');
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		let val = line.slice(eq + 1).trim();
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		if (!(key in process.env)) process.env[key] = val;
	}
}

loadDotEnv(root);
const name = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
const localBin = path.join(root, name);

const executable = fs.existsSync(localBin) ? localBin : name;

const args = [
	'serve',
	'--http=0.0.0.0:8090',
	'--encryptionEnv=PB_ENCRYPTION_KEY',
	'--hooksWatch=false',
];

const child = spawn(executable, args, {
	cwd: root,
	stdio: 'inherit',
	shell: false,
	env: { ...process.env },
});

child.on('error', (err) => {
	console.error(
		`Failed to start PocketBase (${executable}).\n` +
			`Download the ${process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase'} binary for your OS from https://github.com/pocketbase/pocketbase/releases\n` +
			`and place it in: ${root}\n`,
		err.message,
	);
	process.exit(1);
});

child.on('exit', (code, signal) => {
	if (signal) process.exit(1);
	process.exit(code ?? 0);
});

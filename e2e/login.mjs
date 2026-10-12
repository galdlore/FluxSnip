// Opens Playwright's Chromium as a plain process (no automation flags, which Google sign-in rejects)
// on the E2E profile, so you can sign in to a Gmail test account once. Close the window when done.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profileDir = process.env.FLUXSNIP_E2E_PROFILE ?? path.join(root, '.e2e-profile');

console.log(`Profile: ${profileDir}`);
console.log('Sign in to a Gmail TEST account in the window, then close it.');

const child = spawn(
  chromium.executablePath(),
  [`--user-data-dir=${profileDir}`, '--no-first-run', 'https://mail.google.com/'],
  { stdio: 'inherit' }
);
child.on('exit', (code) => {
  console.log(code === 0 ? 'Saved. Run "npm run e2e".' : `Chromium exited with code ${code}.`);
});

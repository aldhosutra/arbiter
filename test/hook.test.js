import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adapters, wrap } from '../src/hook.js';

process.env.ARBITER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-state-')); // never touch the real switch
const cli = (...args) => execFileSync(process.execPath, ['bin/arbiter.js', ...args]).toString();

test('off lets heavy commands through, on queues them again, durations expire', () => {
  assert.match(cli('off'), /arbiter is off/);
  assert.equal(adapters.claude(bash('npm test')), null);
  assert.match(cli('on'), /arbiter is on$/m);
  assert.ok(adapters.claude(bash('npm test')));
  assert.match(cli('off', '2h'), /off, turns on at/);
  fs.writeFileSync(path.join(process.env.ARBITER_HOME, 'state.json'), JSON.stringify({ enabled: false, until: Date.now() - 1 }));
  assert.match(cli('status'), /arbiter is on$/m); // expired "off 2h" flips back
  assert.ok(adapters.claude(bash('npm test')));
  assert.throws(() => execFileSync(process.execPath, ['bin/arbiter.js', 'off', 'soon'], { stdio: 'pipe' }));
});

const bash = (command, extra = {}) => ({ tool_input: { command, ...extra }, permission_mode: 'default' });

test('claude: heavy is denied with an exact retry command, never auto-allowed', () => {
  const out = adapters.claude(bash('npm test'));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.ok(out.hookSpecificOutput.permissionDecisionReason.endsWith(wrap('npm test')));
});

test('claude: the retried wrapped command passes', () => {
  assert.equal(adapters.claude(bash(wrap('npm test'))), null);
});

test('claude: bypassPermissions rewrites in place and keeps other fields', () => {
  const out = adapters.claude({ ...bash('npm test', { timeout: 5 }), permission_mode: 'bypassPermissions' });
  assert.deepEqual(out.hookSpecificOutput.updatedInput, { command: wrap('npm test'), timeout: 5 });
});

test('claude: light and background pass, foreground daemon asks for background', () => {
  assert.equal(adapters.claude(bash('git status')), null);
  assert.equal(adapters.claude(bash('npm run dev', { run_in_background: true })), null);
  assert.match(adapters.claude(bash('npm run dev')).hookSpecificOutput.permissionDecisionReason, /run_in_background/);
});

test('gemini rewrites heavy, codex/cursor let foreground daemons through', () => {
  assert.equal(adapters.gemini(bash('cargo build')).hookSpecificOutput.tool_input.command, wrap('cargo build'));
  assert.equal(adapters.codex(bash('npm run dev')), null);
  assert.deepEqual(adapters.cursor({ command: 'npm run dev' }), {});
  assert.equal(adapters.cursor({ command: 'npm test' }).permission, 'deny');
});

test('wrapped command really runs, with quotes intact', () => {
  const out = execFileSync('/bin/sh', ['-c', wrap(`echo "it's" ok`)], { env: { ...process.env, ARBITER_LOCK: path.join(os.tmpdir(), 'arbiter-test.lock') } });
  assert.equal(out.toString().trim(), "it's ok");
});

test('CLI fails open on garbage input', () => {
  const r = spawnSync(process.execPath, ['bin/arbiter.js', 'hook', 'claude'], { input: 'not json' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.toString(), '');
});

test('install/uninstall round-trips and keeps existing settings', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-home-'));
  const settings = path.join(home, '.claude/settings.json');
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, JSON.stringify({ model: 'x', hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [] }] } }));
  const run = (c) => execFileSync(process.execPath, ['bin/arbiter.js', c, 'all'], { env: { ...process.env, HOME: home } });
  run('install'); run('install'); // idempotent
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(s.model, 'x');
  assert.equal(s.hooks.PreToolUse.length, 2);
  assert.ok(fs.existsSync(path.join(home, '.config/opencode/plugins/arbiter.js')));
  run('uninstall');
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')).hooks.PreToolUse, [{ matcher: 'Edit', hooks: [] }]);
});

test('install follows CLAUDE_CONFIG_DIR profiles', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-home-'));
  const profile = path.join(home, '.claude-personal');
  execFileSync(process.execPath, ['bin/arbiter.js', 'install', 'claude'], { env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: profile } });
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8')).hooks.PreToolUse.length, 1);
  assert.ok(!fs.existsSync(path.join(home, '.claude/settings.json')));
});

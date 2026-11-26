import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { label, LEDGER, wrap } from '../src/hook.js';

process.env.ARBITER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-ledger-'));
const cwd = fs.realpathSync(process.cwd());
const now = Math.floor(Date.now() / 1000);
const write = (runs) => fs.writeFileSync(LEDGER(), runs.map((r) => JSON.stringify({ t: now, cwd, exit: 0, s: 0.5, mb: 50, listen: false, ...r }) + '\n').join(''));

test('three fast, successful, recent runs make a heavy command light', () => {
  write([{ cmd: 'make lint' }, { cmd: 'make lint' }]);
  assert.equal(label('make lint'), 'heavy'); // two runs are not enough
  write([{ cmd: 'make lint' }, { cmd: 'make lint' }, { cmd: 'make lint' }]);
  assert.equal(label('make lint'), 'light');
  assert.equal(label('make lint', { cwd: '/' }), 'heavy'); // learned per folder
  assert.equal(label('make lint', { background: true }), 'daemon');
});

test('one slow, failed, big or stale run keeps it heavy', () => {
  for (const bad of [{ s: 30 }, { exit: 1 }, { mb: 900 }, { t: now - 8 * 86400 }]) {
    write([{ cmd: 'make lint', ...bad }, { cmd: 'make lint' }, { cmd: 'make lint' }]);
    assert.equal(label('make lint'), 'heavy', JSON.stringify(bad));
  }
});

test('a run that opened a port makes it a foreground daemon, never the reverse', () => {
  write([{ cmd: 'hugo server', listen: true, exit: null }]);
  assert.equal(label('hugo server'), 'foreground-daemon');
  write([{ cmd: 'ls', mb: 9999, s: 99 }]);
  assert.equal(label('ls'), 'light'); // the ledger never overrides the fixed lists
});

const run = (cmd) => execFileSync('/bin/sh', ['-c', wrap(cmd)], { env: { ...process.env, ARBITER_LOCK: path.join(process.env.ARBITER_HOME, 'lock') } });
const lines = () => fs.readFileSync(LEDGER(), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('the runner records time, memory and exit code', () => {
  fs.rmSync(LEDGER(), { force: true });
  run('true');
  assert.throws(() => run('exit 3'));
  const [ok, bad] = lines();
  assert.deepEqual([ok.cmd, ok.exit, ok.listen, ok.cwd], ['true', 0, false, cwd]);
  assert.equal(bad.exit, 3);
  assert.ok(ok.s < 2 && ok.mb >= 0);
});

test('the runner releases the queue as soon as the command listens on a port', async () => {
  fs.rmSync(LEDGER(), { force: true });
  const lock = path.join(process.env.ARBITER_HOME, 'lock');
  const server = `node -e "require('net').createServer().listen(0)"`;
  const child = spawn('/bin/sh', ['-c', wrap(server)], { env: { ...process.env, ARBITER_LOCK: lock }, stdio: 'ignore' });
  try {
    const t = Date.now();
    while (!fs.existsSync(LEDGER()) && Date.now() - t < 10000) await new Promise((r) => setTimeout(r, 100));
    assert.equal(lines()[0].listen, true);
    assert.equal(label(server), 'foreground-daemon');
    run('true'); // gets the lock while the server is still running
  } finally { child.kill(); }
});

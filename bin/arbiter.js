#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classify } from '../src/classify.js';
import { adapters, readState, STATE } from '../src/hook.js';

const SELF = fileURLToPath(import.meta.url);
const HOME = os.homedir();
const q = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
// Absolute node path: hooks often run without the user's nvm/asdf PATH.
const hookCmd = (h) => `${q(process.execPath)} ${q(SELF)} hook ${h}`;
const isOurs = (entry) => JSON.stringify(entry).includes(`${path.basename(SELF)}' hook `);

// Profile folders: each harness's own env var picks the config dir, same as the harness itself does.
const dir = (envVar, fallback) => process.env[envVar] || path.join(HOME, fallback);
const JSON_TARGETS = {
  claude: { file: path.join(dir('CLAUDE_CONFIG_DIR', '.claude'), 'settings.json'), event: 'PreToolUse', entry: { matcher: 'Bash', hooks: [{ type: 'command', command: hookCmd('claude') }] } },
  codex: { file: path.join(dir('CODEX_HOME', '.codex'), 'hooks.json'), event: 'PreToolUse', entry: { matcher: 'Bash', hooks: [{ type: 'command', command: hookCmd('codex') }] } },
  gemini: { file: path.join(HOME, '.gemini/settings.json'), event: 'BeforeTool', entry: { matcher: 'run_shell_command', hooks: [{ type: 'command', command: hookCmd('gemini') }] } },
  cursor: { file: path.join(HOME, '.cursor/hooks.json'), event: 'beforeShellExecution', entry: { command: hookCmd('cursor') }, base: { version: 1 } },
};
const OPENCODE_PLUGIN = '.config/opencode/plugins/arbiter.js';
const HARNESSES = [...Object.keys(JSON_TARGETS), 'opencode'];

function editJson(file, base, fn) {
  let data = { ...base };
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    try { data = JSON.parse(raw); } catch { die(`${file} is not plain JSON (comments?). Add the hook by hand, see README.`); }
    fs.writeFileSync(`${file}.arbiter.bak`, raw);
  }
  fn(data);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function setInstalled(harness, on) {
  if (harness === 'opencode') {
    const file = path.join(HOME, OPENCODE_PLUGIN);
    if (!on) return fs.rmSync(file, { force: true }), file;
    const hook = pathToFileURL(fileURLToPath(new URL('../src/hook.js', import.meta.url))).href;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `// Installed by Arbiter. Remove with: arbiter uninstall opencode
import { decide, wrap } from ${JSON.stringify(hook)};
export const Arbiter = async () => ({
  'tool.execute.before': async (input, output) => {
    if (input.tool !== 'bash') return;
    if (decide(output.args.command, { canBackground: false }).action === 'queue') output.args.command = wrap(output.args.command);
  },
});
`);
    return file;
  }
  const t = JSON_TARGETS[harness];
  const file = t.file;
  if (!on && !fs.existsSync(file)) return file;
  editJson(file, t.base, (data) => {
    data.hooks ??= {};
    const list = (data.hooks[t.event] ?? []).filter((e) => !isOurs(e));
    if (on) list.push(t.entry);
    if (list.length) data.hooks[t.event] = list; else delete data.hooks[t.event];
  });
  return file;
}

function die(msg) { console.error(`arbiter: ${msg}`); process.exit(1); }

const [cmd, arg, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'hook': {
    const adapter = adapters[arg] ?? die(`unknown harness "${arg}"`);
    let out = null;
    // Fail open: a bug or bad payload here must never block the agent's commands.
    try { out = adapter(JSON.parse(fs.readFileSync(0, 'utf8'))); } catch (e) { console.error(`arbiter: ${e.message}`); }
    if (out) process.stdout.write(JSON.stringify(out));
    else if (arg === 'cursor') process.stdout.write('{}');
    break;
  }
  case 'on':
  case 'off': {
    const m = arg?.match(/^(\d+)([mhd])$/);
    if (arg && !m) die(`usage: arbiter ${cmd} [duration like 30m, 2h, 1d]`);
    const until = m ? Date.now() + m[1] * { m: 6e4, h: 36e5, d: 864e5 }[m[2]] : null;
    fs.mkdirSync(path.dirname(STATE()), { recursive: true });
    fs.writeFileSync(STATE(), JSON.stringify({ enabled: cmd === 'on', until }) + '\n');
  } // falls through to print the new status
  case 'status': {
    const { enabled, until } = readState();
    const back = until ? `, turns ${enabled ? 'off' : 'on'} at ${new Date(until).toLocaleString()}` : '';
    console.log(`arbiter is ${enabled ? 'on' : 'off'}${back}`);
    break;
  }
  case 'classify':
    console.log(classify([arg, ...rest].join(' ')));
    break;
  case 'install':
  case 'uninstall': {
    const targets = arg === 'all' ? HARNESSES : [arg];
    if (!targets.every((h) => HARNESSES.includes(h))) die(`usage: arbiter ${cmd} <${HARNESSES.join('|')}|all>`);
    for (const h of targets) console.log(`${cmd === 'install' ? 'installed' : 'removed'} ${h}: ${setInstalled(h, cmd === 'install')}`);
    if (cmd === 'install' && targets.includes('codex')) console.log('codex: run /hooks inside Codex once to trust the new hook.');
    break;
  }
  default:
    console.log(`arbiter: one heavy command at a time across all your coding agent sessions

  arbiter install <${HARNESSES.join('|')}|all>
  arbiter uninstall <harness|all>
  arbiter on|off [30m|2h|1d]     switch the queue for all sessions, optionally only for a while
  arbiter status
  arbiter classify <command>     show how a command is treated (light|heavy|daemon|foreground-daemon)
  arbiter hook <harness>         (called by the harness)`);
}

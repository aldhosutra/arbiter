// Per-harness hook adapters: harness payload in, harness response out (null = let it run untouched).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './classify.js';

export const RUNNER = fileURLToPath(new URL('../bin/arbiter-run', import.meta.url));

const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
export const wrap = (cmd) => `${quote(RUNNER)} ${quote(cmd)}`;
const isWrapped = (cmd) => cmd.trimStart().startsWith(quote(RUNNER)) || cmd.trimStart().startsWith(RUNNER);

const DOCS = fileURLToPath(new URL('../FOR_AGENTS.md', import.meta.url));
const retryReason = (cmd) =>
  `Arbiter: this is a heavy command and other agent sessions on this machine share limited RAM, ` +
  `so it must go through the shared queue. More: ${DOCS}. Rerun it exactly as below, unchanged otherwise. ` +
  `It may wait for other sessions' heavy commands first, so use a long timeout:\n${wrap(cmd)}`;
const backgroundReason = (flag) =>
  `Arbiter: this looks long-running (a server or watcher). Rerun the same command with ${flag}: true. More: ${DOCS}.`;

// On/off switch shared by every harness: { enabled, until }. After `until`, the setting flips back.
export const STATE = () => path.join(process.env.ARBITER_HOME || path.join(os.homedir(), '.config/arbiter'), 'state.json');

export function readState() {
  try {
    const { enabled = true, until = null } = JSON.parse(fs.readFileSync(STATE(), 'utf8'));
    return until && Date.now() > until ? { enabled: !enabled, until: null } : { enabled, until };
  } catch { return { enabled: true, until: null }; } // no state file yet = on
}

// Decide once for every harness. `canBackground` = the harness has a background flag to ask for.
export function decide(command, { background = false, canBackground = true } = {}) {
  if (!command || isWrapped(command) || !readState().enabled) return { action: 'pass' };
  const kind = classify(command, { background });
  if (kind === 'heavy') return { action: 'queue' };
  if (kind === 'foreground-daemon' && canBackground) return { action: 'background' };
  return { action: 'pass' }; // light, daemon, or a foreground daemon the harness can't background
}

const claudeDeny = (reason) => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
});

export const adapters = {
  // Rewriting requires permissionDecision "allow", which would skip the user's permission
  // prompts, so outside bypassPermissions mode we deny and let the retry go through normal checks.
  claude(p) {
    const input = p.tool_input || {};
    const { action } = decide(input.command, { background: input.run_in_background });
    if (action === 'background') return claudeDeny(backgroundReason('run_in_background'));
    if (action !== 'queue') return null;
    if (p.permission_mode === 'bypassPermissions') {
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...input, command: wrap(input.command) } } };
    }
    return claudeDeny(retryReason(input.command));
  },

  // Same constraint as Claude (rewrite only valid with "allow"); Codex has no background flag.
  codex(p) {
    const command = p.tool_input?.command;
    return decide(command, { canBackground: false }).action === 'queue' ? claudeDeny(retryReason(command)) : null;
  },

  // Gemini merges hookSpecificOutput.tool_input into the call without touching permissions.
  gemini(p) {
    const input = p.tool_input || {};
    const { action } = decide(input.command, { background: input.is_background });
    if (action === 'background') return { decision: 'deny', reason: backgroundReason('is_background') };
    if (action === 'queue') return { hookSpecificOutput: { tool_input: { command: wrap(input.command) } } };
    return null;
  },

  // beforeShellExecution can only allow/deny; it has no background flag.
  cursor(p) {
    if (decide(p.command, { canBackground: false }).action !== 'queue') return {};
    const reason = retryReason(p.command);
    return { permission: 'deny', user_message: 'Arbiter: queued heavy command, agent will retry', agent_message: reason };
  },
};

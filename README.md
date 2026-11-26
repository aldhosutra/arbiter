<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/final/arbiter-horizontal-white.svg">
    <img src="logo/final/arbiter-horizontal.svg" alt="Arbiter" width="320">
  </picture>
</h1>

<p align="center">One heavy command at a time, across every coding agent session on your machine.</p>

Running three or four agent sessions on an 8 GB laptop works fine until two of them start a build or a test suite at the same moment. Then the machine swaps itself to death. Arbiter puts all heavy shell commands from all sessions in one queue. Light commands like `ls` or `git status` still run instantly, and dev servers are left alone.

## Install

```sh
npm install -g github:aldhosutra/arbiter
arbiter install all        # or: claude, codex, gemini, cursor, opencode
```

Codex asks you to trust new hooks once: run `/hooks` inside Codex after installing.

If you use more than one Claude Code or Codex profile, install once per profile. Set the same variable the harness reads:

```sh
arbiter install claude                                       # ~/.claude
CLAUDE_CONFIG_DIR=~/.claude-personal arbiter install claude  # another profile
CODEX_HOME=~/.codex-work arbiter install codex
```

All profiles share one queue, so a heavy command in one profile waits for heavy commands in any other.

To remove it: `arbiter uninstall all`. Before editing a config file, Arbiter saves the old version next to it as `<file>.arbiter.bak`.

Requires macOS or Linux, Node 18+, and `perl` (preinstalled on both).

## Turning it on and off

```sh
arbiter off          # every session runs commands normally
arbiter on           # back to queueing
arbiter off 2h       # off for two hours, then on again by itself
arbiter on 30m       # on for thirty minutes, then off again
arbiter status
```

The switch applies to all sessions and all harnesses at once and takes effect on the next command. No restart or reinstall is needed. The setting lives in `~/.config/arbiter/state.json`. A missing file means on.

## How commands are sorted

Every shell command an agent tries to run gets one of four labels. The rules are fixed lists in [`src/classify.js`](src/classify.js), refined by measurement (see below). Check any command with `arbiter classify "<command>"`.

| Label | Rule | What happens |
|---|---|---|
| daemon | The agent started it in the background | Runs freely |
| foreground-daemon | Looks like a server or watcher (`npm run dev`, `vite`, `--watch`, `tail -f`, ...) but runs in the foreground | The agent is asked to rerun it in the background |
| light | Every part of the command (split on `&&`, `;`, `\|`) is on the allowlist | Runs freely |
| heavy | Anything else | Waits for the shared lock |

Unknown commands count as heavy on purpose. If a light command is labelled heavy, it waits a few seconds. If a heavy one were labelled light, your machine could crash.

### Learning from measurements

Each heavy command is measured while it runs: how long it takes, the peak memory of its whole process tree, and whether it opens a listening TCP port. Every run adds one line to `~/.config/arbiter/ledger.jsonl`, keyed by the exact command and the folder it ran in. Arbiter learns only from these measurements. It never asks an agent what a command is.

- **Server**: if the command opens a listening port, Arbiter releases the queue right away so other sessions are not blocked until the server is killed. For the next 30 days the command counts as a foreground daemon.
- **Light**: if the command's last 3 runs this week all exited 0 in under 2 s and used under 200 MB, it counts as light. Light commands are not measured, so after a week it goes back to heavy and is measured again.

The ledger only changes commands the fixed lists call heavy. `arbiter classify` shows the learned label for the current folder. To forget what was learned, delete lines from the ledger or the whole file.

## How the queue works

Heavy commands run through `bin/arbiter-run`, which holds a kernel `flock` on `/tmp/arbiter.lock` while the command runs. The kernel releases that lock when the process exits, however it exits, so a crashed or killed session never leaves the queue stuck. A waiting command prints which command it is waiting on.

How the command gets wrapped depends on the harness:

| Harness | Heavy command | Foreground daemon |
|---|---|---|
| Claude Code | Denied, and the agent is told the exact wrapped command to rerun | Agent asked to use `run_in_background` |
| Codex CLI | Denied, retry the same way | Runs normally (Codex has no background flag) |
| Gemini CLI | Rewritten in place | Agent asked to use `is_background` |
| opencode | Rewritten in place | Runs normally |
| Cursor | Denied, retry the same way | Runs normally |

Claude Code and Codex can only rewrite a command if the hook also auto-approves it, and that would skip your permission prompts. So Arbiter denies the command and tells the agent the exact wrapped command to run. The retry then goes through your normal permission checks. That costs one extra agent turn per heavy command. In Claude Code's `bypassPermissions` mode nothing is prompted anyway, so there Arbiter rewrites the command directly.

## For coding agents

If a shell command was blocked by Arbiter, read [FOR_AGENTS.md](FOR_AGENTS.md). Every block message also links to that file.

## Limits

- A heavy command runs in a subshell, so a `cd` inside it does not carry over to the agent's next command.
- Daemons are never queued. A dev server that uses 2 GB still uses 2 GB.
- Splitting on `&&`, `;` and `|` ignores quotes. A quoted `;` can make a light command count as heavy, never the other way around.
- `ARBITER_LOCK=/path` changes the lock file, for example to give one group of sessions its own queue.
- The Cursor adapter is based on the documented hook API and has not been tested inside Cursor yet.

## Development

```sh
npm test
```

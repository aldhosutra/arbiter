# Arbiter: notes for coding agents

If you are an agent and a shell command was blocked with a message starting with `Arbiter:`, this page is for you.

Arbiter is installed on this machine so that several agent sessions don't run heavy commands at the same time and exhaust the RAM. The block is expected behaviour, not an error in your command.

- **"this is a heavy command ... Rerun it exactly as below"**: run the wrapped command from the message as it is, for example `'/path/to/bin/arbiter-run' 'npm test'`. Don't edit it, strip the wrapper, or try a different way to run the original command. Set a long timeout (Claude Code: `timeout: 600000`), because the command may first wait for another session's heavy command to finish. While it waits, it prints `arbiter: waiting for heavy command to finish: ...` to stderr, which is normal.
- **"this looks long-running (a server or watcher)"**: rerun the same command with the background flag the message names (`run_in_background: true` in Claude Code, `is_background: true` in Gemini CLI). Background commands are never queued.
- **"this command is a server, so the queue was released"**: the command is running fine. Next time, start it in the background.
- **The command ran but your `cd` didn't stick**: a queued command runs in a subshell. Use absolute paths, or put the `cd` inside the command.
- **To check how a command will be treated** before running it: `arbiter classify "<command>"`. To see whether queueing is active: `arbiter status`.
- **Don't run `arbiter off`, `arbiter uninstall`, or change `ARBITER_LOCK`** to get around a wait. Those are the user's settings. If the queue looks stuck, tell the user which command it is waiting on (the stderr line names it).


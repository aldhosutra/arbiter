// Deterministic command classifier: same input, same answer, no heuristics beyond these lists.
//   daemon            -> started in background; never locked
//   foreground-daemon -> looks long-running but was run in foreground; deny, ask to rerun in background
//   light             -> every segment is on the allowlist; runs freely
//   heavy             -> everything else; waits for the global lock

const LIGHT = new Set(`
  ls cat head tail grep egrep fgrep rg ag find fd pwd echo printf which type command wc sort uniq
  cut tr sed awk jq yq diff cmp file stat date env printenv true false test [ cd pushd popd
  mkdir rmdir touch rm cp mv ln chmod chown basename dirname realpath readlink ps pgrep lsof
  kill pkill sleep tree less more nl column whoami hostname uname id open pbcopy pbpaste
  curl wget gh export unset source . set
`.split(/\s+/).filter(Boolean));

// git subcommands that never run user hooks or builds (commit/push/merge can trigger heavy hooks).
const LIGHT_GIT = new Set(`
  status log diff show branch rev-parse remote ls-files blame stash checkout switch add
  fetch tag config reflog describe shortlog restore reset worktree
`.split(/\s+/).filter(Boolean));

const DAEMON = [
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve|watch|preview)\b/,
  /\b(next|vite|nuxt|astro|remix)\s+(dev|start|preview)\b/,
  /^(vite|nodemon|webpack-dev-server|live-server|http-server|serve)(\s|$)/,
  /--watch\b/,
  /^tail\s+(-\w*f|--follow)/,
  /\bpython3?\s+-m\s+http\.server\b/,
  /\b(rails|php\s+artisan)\s+(s|server|serve)\b/,
  /\bdocker(-|\s+)compose\s+up\b(?!.*\s(-d|--detach)\b)/,
  /\b(flask|uvicorn|gunicorn)\b.*\b(run|:app)\b|\buvicorn\s/,
];

const ENV_ASSIGN = /^\w+=(\S*)$/;
const PREFIXES = new Set(['sudo', 'time', 'nice', 'nohup', 'exec', 'env', 'npx', 'bunx']);

function words(segment) {
  const w = segment.trim().split(/\s+/).filter(Boolean);
  while (w.length && (ENV_ASSIGN.test(w[0]) || PREFIXES.has(w[0]))) w.shift();
  return w;
}

function isLight(segment) {
  const [cmd, sub] = words(segment);
  if (!cmd) return true;
  const name = cmd.split('/').pop();
  if (name === 'git') return LIGHT_GIT.has(sub);
  if (name === 'tail' && /\s(-\w*f|--follow)\b/.test(segment)) return false;
  return LIGHT.has(name);
}

// shortcut: splits on operators without parsing quotes; a quoted `;` just makes an odd segment
// that falls through to heavy (the safe side). Upgrade to a real shell parser if it misfires often.
export function classify(command, { background = false } = {}) {
  if (background) return 'daemon';
  const segments = command.split(/&&|\|\||[;|\n]/);
  if (segments.some((s) => DAEMON.some((re) => re.test(words(s).join(' '))))) return 'foreground-daemon';
  return segments.every(isLight) ? 'light' : 'heavy';
}

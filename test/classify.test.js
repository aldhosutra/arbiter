import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classify.js';

const cases = {
  light: [
    'ls -la', 'git status', 'git log --oneline | head -5', 'cd src && rg foo', 'cat a.txt | jq .x',
    'FOO=1 grep -rn bar .', '/usr/bin/find . -name "*.js"', 'tail -n 50 log.txt', 'git diff HEAD~1',
  ],
  heavy: [
    'npm test', 'npm install', 'cd app && pnpm build', 'xcodebuild -scheme App', 'cargo build',
    'git commit -m x', 'git push', 'ls && npm run build', 'node script.js', 'python3 train.py',
    'docker compose up -d', 'some-unknown-tool',
  ],
  'foreground-daemon': [
    'npm run dev', 'pnpm dev', 'yarn start', 'npx vite', 'vite', 'next dev', 'tail -f app.log',
    'cd web && npm run dev', 'tsc --watch', 'python3 -m http.server 8000', 'docker compose up',
    'NODE_ENV=dev nodemon index.js', 'uvicorn main:app --reload',
  ],
};

for (const [kind, commands] of Object.entries(cases)) {
  for (const cmd of commands) {
    test(`${kind}: ${cmd}`, () => assert.equal(classify(cmd), kind));
  }
}

test('background flag always wins', () => {
  assert.equal(classify('npm run dev', { background: true }), 'daemon');
  assert.equal(classify('npm test', { background: true }), 'daemon');
});

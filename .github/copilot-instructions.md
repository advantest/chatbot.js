# Project overview
JavaScript project. A project-local Node.js/npm is bundled in `node/` — **do not use a globally
installed `node` or `npm`.**

## Using the bundled toolchain
Prepend the bundled Node to `PATH` before running any command:

Linux/macOS:

```bash
export PATH="$PWD/node/bin:$PATH" && npm test
```

Windows (PowerShell):

```powershell
$env:PATH = "$PWD\node;$env:PATH"; npm test
```

Alternatively, invoke it directly: `./node/bin/npm run test`

## Installing dependencies
- `npm ci` (use `ci`, not `install`, so `package-lock.json` is respected)

## Running tests
- All tests: `npm test`
- Single file: `npm test -- path/to/file.test.js`
- Watch mode: `npm run test:watch`

Always run `npm test` and make sure it passes before finishing a change or opening a PR.
Never modify `package-lock.json` by hand.
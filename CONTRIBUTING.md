# Contributing

## Coding

Before implementing:

- Prefer the simplest solution that passes tests and review.
- If there are tradeoffs, call them out in the PR description.

Implementing:

- Solve only the requested problem; avoid speculative features.
- Keep changes surgical; do not refactor unrelated code.
- Match style and patterns already used in touched files.
- Keep doc comments and code comments minimal and focused on non-obvious intent.


## Commits

Use commits that are easy to review and trace:

- Write commit messages in imperative mood.
- Keep the header line under 72 characters and explain "why" in the body when needed.
- Avoid vague messages like "fix stuff" or "updates".

Format:

<pre>
<b><a href="#types">&lt;type&gt;</a></b></font>(<b><a href="#scopes">&lt;optional scope&gt;</a></b>): <b>&lt;description&gt;</b>
<sub>empty line as separator</sub>
<b>&lt;optional body: why this change is needed and any key context&gt;</b>
</pre>

Examples:

- `feat(ui): add copy code button to code blocks`
- `fix: handle escaped characters in responses`
- `build(deps-dev): update babel`

### Types

- Code changes:
    - `feat` - Commits that add, adjust or remove a feature to/of/from the API or UI
    - `fix` - Commits that fix an API or UI bug
    - `refactor` - Commits that rewrite or restructure code without altering API or UI behavior
    - `perf` - A special kind of `refactor` commit that improves performance
    - `style` - Commits that address only source formatting (whitespace, indentation, ...) and do not affect application behavior
    - `test` - Commits that add missing tests or correct existing ones
- Non-code-related changes:
    - `build` - Commits that affect build-related components such as build tools, dependencies, project version, ...
    - `ci` - Commits that affect CI/CD pipelines
    - `docs` - Commits that exclusively affect documentation
    - `chore` - Commits that represent tasks like initial commit, modifying `.gitignore`, ...

### Scopes

- Modules:
    - `core`
    - `ui`
- Dependencies
    - `deps`
    - `deps-dev`


## Validation before PR

Run `mvn generate-resources` or `npm install && npm run build && npm test` from the repo root after substantive edits.


## Rebase

- Always rebase your branch onto the latest `main` instead of creating merge commits.
- Resolve conflicts locally and rerun the validation commands.
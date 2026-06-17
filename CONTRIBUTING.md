# Contributing to OCS

Thanks for contributing! This doc covers the practical stuff you need to get started.

## Quick Start

```bash
git clone https://github.com/stanl33y/opencode-stack-switcher.git
cd opencode-stack-switcher
bun install
```

## Development

```bash
bun run dev          # Watch mode (auto-restarts on changes)
bun run build        # Build for production
bun run typecheck    # TypeScript type checking
bun run lint         # Biome lint check
bun run lint:fix     # Biome lint + auto-fix
bun run format       # Biome format (writes in place)
```

## Testing

```bash
bun test                    # Run all tests
bun test --coverage         # Run with coverage report
bun run test:coverage:check # Verify 80% coverage threshold
```

The project requires 80% test coverage. CI enforces this gate.

## Pre-commit Hooks

Husky + lint-staged runs on every commit:

- **Biome check + auto-fix** on staged `.ts`, `.tsx`, `.js`, `.json` files

If a commit fails, fix the reported issues and re-stage.

## CI Checks

Every push and PR runs on **Ubuntu + Windows**:

1. `bun install --frozen-lockfile`
2. `bun run typecheck`
3. `bun run lint`
4. `bun test --coverage`
5. Coverage threshold check (80%)

All five must pass on both OSes before merge.

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add diff command
fix: handle missing base.json gracefully
docs: update CONTRIBUTING.md
test: add coverage for resolveEnvVars
refactor: extract atomic-write utility
chore: bump bun version in CI
```

## Adding a New Command

Follow this pattern:

**1. Add the function in `src/cli.ts`**

```typescript
function cmdNewCommand(arg: string) {
  // implementation
}
```

**2. Add a case in the `main()` switch**

```typescript
case "new-command":
  if (!arg) {
    console.error("usage: ocs new-command <arg>");
    process.exit(1);
  }
  cmdNewCommand(arg);
  break;
```

**3. Add to the `usage()` function**

```
ocs new-command <arg>    description of command
```

**4. Write tests in `tests/new-command.test.ts`**

## Reporting Bugs

1. Check existing issues first
2. Open a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Bun version)
   - Relevant logs or screenshots

## Suggesting Features

1. Check existing issues and discussions
2. Open a feature request with:
   - Clear description of the feature
   - Use case it solves
   - Proposed implementation (optional)

## Pull Requests

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run `bun test` and `bun run typecheck`
5. Commit with Conventional Commits format
6. Push and open a pull request

## What Not to Commit

- `node_modules/`
- `resolved/`
- `stacks/*.json` (except `base.json` and `example.json`)
- `*.local.json`
- API keys or secrets
- Personal configurations

## Questions?

Open a [GitHub Discussion](https://github.com/stanl33y/opencode-stack-switcher/discussions).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

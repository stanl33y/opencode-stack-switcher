# Contributing to OCS

Thank you for your interest in contributing to OCS! This document provides guidelines for contributing.

## 🤝 How to Contribute

### Reporting Bugs

1. Check existing issues first
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Bun version, etc.)
   - Relevant logs/screenshots

### Suggesting Features

1. Check existing issues and discussions
2. Create a feature request with:
   - Clear description of the feature
   - Use case / problem it solves
   - Proposed implementation (if you have ideas)

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `bun test`
5. Commit with clear messages
6. Push and create a pull request

## 📝 Code Style

- Use TypeScript with strict mode enabled
- Follow existing code formatting
- Add comments for complex logic
- Keep functions focused and small

## 🧪 Testing

```bash
# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

### Test Structure

```
src/
  └── cli.ts
tests/
  ├── cli.test.ts
  ├── stacks.test.ts
  └── resolve.test.ts
```

## 📂 Project Structure

```
ocs/
├── src/
│   ├── cli.ts          # CLI entry point and commands
│   ├── stacks.ts       # Stack manifest loading and validation
│   ├── resolve.ts      # Stack resolution and deep merge
│   ├── launch.ts       # OpenCode launching
│   ├── prelaunch.ts    # Server health-check and startup
│   ├── menu.ts         # Interactive menu
│   ├── paths.ts        # Path utilities
│   └── jsonc.ts        # JSONC parser
├── stacks/
│   ├── base.json       # Base configuration (generated via `ocs init`)
│   ├── example.json    # Example stack (safe, no secrets)
│   └── *.local.json    # Private stacks (gitignored)
├── tests/              # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## 🚫 What Not to Commit

- `node_modules/`
- `resolved/`
- `stacks/*.json` (except `base.json` and `example.json`)
- `*.local.json`
- API keys or secrets
- Personal configurations

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Questions?

- Open a GitHub Discussion
- Open a [GitHub Discussion](https://github.com/stanl33y/opencode-stack-switcher/discussions)

Thank you for contributing! 🎉
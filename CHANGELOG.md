# Changelog

All notable changes to OCS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- README documentation
- LICENSE (MIT)
- SECURITY.md policy
- CONTRIBUTING.md guidelines
- `stacks/example.json` as safe reference stack

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- Added security policy documentation
- Documented shell injection consideration in prelaunch
- Documented JSON input validation needs

## [0.2.0] - 2026-06-16

### Added
- Bun Test framework with 80% coverage gate
- GitHub Actions CI (Ubuntu + Windows)
- Biome for linting and formatting
- zod schemas for stack manifest validation
- Typed error hierarchy with actionable hints
- `ocs validate <stack>` command
- `ocs diff <stack1> <stack2>` command
- Retry logic for prelaunch health checks
- SIGINT/SIGTERM cleanup in launchOpencode
- Atomic CURRENT_FILE writes
- Migration guide v0.1.0 → v0.2.0
- 3 Architecture Decision Records
- Architecture diagram in README
- `.env.example` and cold-install verification

### Changed
- Upgraded @opencode-ai/plugin from 1.2.15 to 1.17.x
- Pinned @types/bun to specific version
- Standardized all output and comments to English
- Replaced unsafe type assertions with zod validation
- Centralized configuration in src/config.ts
- Refactored pickStack and launchOpencode for testability

### Removed
- Stale bun.lock (replaced with bun.lockb)
- Mixed Portuguese strings
- Unsafe `as` type assertions

## [0.1.0] - 2025-06-05

### Added
- Initial release of OCS (OpenCode Stack Switcher)
- CLI with commands: `use`, `list`, `show`, `current`, `doctor`, `edit`, `init`
- Interactive menu for stack selection
- Stack manifest system with deep merge
- Prelaunch system for server health-checks and startup
- Deep merge of base.json with stack manifests
- Support for oh-my-opencode agent/category model configuration
- Environment variable overrides per stack
- Resolved configuration generation in `resolved/<stack>/`
- JSONC parser for tolerant config parsing
- Pass-through arguments to OpenCode via `--`
- Current stack tracking
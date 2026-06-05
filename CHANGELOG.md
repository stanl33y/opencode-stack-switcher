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
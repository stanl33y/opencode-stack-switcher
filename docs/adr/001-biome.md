# ADR-001: Use Biome instead of ESLint+Prettier

## Status

Accepted

## Context

The project needs linting and formatting for its TypeScript codebase. The JavaScript ecosystem standard is ESLint for linting and Prettier for formatting, but this requires two tools, shared configuration, and a plugin ecosystem to cover TypeScript-specific rules. Running both tools adds CI time and configuration complexity.

## Decision

Use Biome (v1.8.3) as the single tool for both linting and formatting.

## Rationale

Biome is a Rust-based tool that handles linting and formatting in one pass. It runs significantly faster than the ESLint+Prettier combo, which matters for a CLI tool where quick feedback loops matter. The Bun runtime integrates well with Biome, and the project already uses Bun as its runtime and test runner. A single tool means one config file, one dependency, and no formatter/linter conflicts. The ESLint plugin ecosystem is powerful, but this project doesn't need custom rules. Biome's built-in rules cover the TypeScript strict-mode patterns we use.

## Consequences

Less configurable than ESLint. If we need a rule Biome doesn't support, we're stuck until they add it. No Prettier plugin ecosystem for exotic file types. But we gain simplicity: one config, one dependency, faster CI, and no formatter/linter disagreements.

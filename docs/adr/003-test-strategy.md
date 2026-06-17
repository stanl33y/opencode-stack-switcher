# ADR-003: Test strategy split (characterization + TDD + integration)

## Status

Accepted

## Context

The project started at 0% test coverage with mixed testability. Some code was stable and undocumented, some was new features being built, and some involved external processes and network calls. A single testing approach couldn't handle all three situations well.

## Decision

Adopt a three-tier test strategy: characterization tests for existing behavior, TDD for new features, and integration tests for robustness.

## Rationale

Characterization tests (91 tests in Wave 2) lock down existing behavior before refactoring. They document what the code actually does, not what it should do. TDD tests (99 tests in Wave 3) drive new feature development by writing the test first, then implementing. This catches design problems early and ensures new code is testable from the start. Integration tests (49 tests in Wave 5) verify robustness: retry logic, signal handling, atomic writes, and error recovery. These test behaviors that unit tests can't catch, like exponential backoff timing and process signal propagation. Each tier has a clear purpose, and together they target 80% coverage with 292 total tests.

## Consequences

More test files to maintain. Each tier has different conventions: characterization tests use golden files and snapshot-style assertions, TDD tests use focused unit assertions, integration tests use mocks and timing. Developers need to know which tier applies when adding or changing code. But the payoff is clear: each test type does one job well, and the coverage gate (80%) is achievable because the strategy matches the work.

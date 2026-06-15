# Testing Conventions

This project uses the [Bun Test](https://bun.sh/guides/test) framework for testing.

## Test File Structure

### Location
- Tests are located in the `tests/` directory at the project root
- The `tests/` directory mirrors the `src/` directory structure

### Naming Convention
- Test files must be named with the `.test.ts` extension
- Example: `tests/example.test.ts`, `tests/utils/helpers.test.ts`

## Test Coverage

### Coverage Requirements
- Minimum coverage requirement: **80%** for both functions and lines
- The `check-coverage.ts` script automatically verifies this threshold
- Coverage is checked as part of the pre-commit hooks and CI pipeline

### Running Tests

#### Run all tests
```bash
bun test
```

#### Run tests with coverage report
```bash
bun test --coverage
```

#### Check coverage thresholds
```bash
bun run scripts/check-coverage.ts
```

## Test Examples

### Basic Test Structure
```typescript
import { expect, test } from "bun:test";

test("description of what is being tested", () => {
  // Arrange - set up test data
  const expected = 42;
  
  // Act - execute the function being tested
  const actual = someFunction();
  
  // Assert - verify the result
  expect(actual).toBe(expected);
});
```

### Testing with TypeScript
```typescript
import { expect, test } from "bun:test";

test("TypeScript types work correctly", () => {
  const message: string = "hello world";
  expect(message.length).toBe(11);
});
```

## Best Practices

1. **One assertion per test** - Each test should verify a single behavior
2. **Descriptive test names** - Test names should clearly describe what's being tested
3. **Arrange-Act-Assert pattern** - Structure tests in three clear sections
4. **Avoid testing implementation details** - Focus on behavior, not internal code structure

## Development Workflow

1. Write failing tests first (TDD approach)
2. Run tests to verify they fail
3. Implement code to make tests pass
4. Run coverage check to ensure adequate test coverage
5. Commit tests with the code they test

## Troubleshooting

### Common Issues

- **Tests not discovered**: Ensure test files are in `tests/` directory with `.test.ts` extension
- **TypeScript errors**: Check that `tsconfig.json` includes `tests/` in the `include` array
- **Coverage issues**: Run `bun test --coverage` to see detailed coverage reports
- **Script fails**: Check the output of `bun test` first, then run the coverage check

### Debugging Tests

Add `console.log` statements for debugging, but remove them before committing.

## Coverage Configuration

The coverage threshold is enforced in `scripts/check-coverage.ts`:
- Minimum function coverage: 80%
- Minimum line coverage: 80%
- Script exits with non-zero code if any file doesn't meet thresholds

This ensures that all new code is properly tested before merging.
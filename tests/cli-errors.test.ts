import { describe, expect, test } from "bun:test";
import { formatOcsError, levenshtein, suggestClosest } from "../src/cli";
import {
  BaseConfigMissingError,
  ConfigValidationError,
  HealthCheckTimeoutError,
  OcsError,
  PluginNotInstalledError,
  PrelaunchSpawnError,
  StackNotFoundError,
} from "../src/errors";

describe("levenshtein", () => {
  test("identical strings have distance 0", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  test("empty string to non-empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
  });

  test("non-empty to empty string", () => {
    expect(levenshtein("abc", "")).toBe(3);
  });

  test("both empty strings", () => {
    expect(levenshtein("", "")).toBe(0);
  });

  test("single character substitution", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });

  test("single character insertion", () => {
    expect(levenshtein("cat", "cats")).toBe(1);
  });

  test("single character deletion", () => {
    expect(levenshtein("cats", "cat")).toBe(1);
  });

  test("multiple edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  test("completely different strings", () => {
    expect(levenshtein("abc", "xyz")).toBe(3);
  });
});

describe("suggestClosest", () => {
  test("returns exact match if present", () => {
    expect(suggestClosest("list", ["list", "use", "show"])).toBe("list");
  });

  test("returns closest match within threshold", () => {
    expect(suggestClosest("lits", ["list", "use", "show"])).toBe("list");
  });

  test("returns null when no match within threshold", () => {
    expect(suggestClosest("zzzzz", ["list", "use", "show"])).toBeNull();
  });

  test("returns null for empty options", () => {
    expect(suggestClosest("test", [])).toBeNull();
  });

  test("picks best among multiple close matches", () => {
    expect(suggestClosest("sho", ["show", "shot", "use"])).toBe("show");
  });

  test("suggests stack name with typo", () => {
    const stacks = ["test-stack", "prod-stack", "dev-stack"];
    expect(suggestClosest("test-stak", stacks)).toBe("test-stack");
  });

  test("suggests command with typo", () => {
    const commands = [
      "use",
      "list",
      "show",
      "current",
      "doctor",
      "edit",
      "validate",
      "diff",
      "init",
    ];
    expect(suggestClosest("lst", commands)).toBe("list");
  });
});

describe("formatOcsError", () => {
  test("formats basic OcsError with message, hint, and exit code", () => {
    const err = new OcsError("TEST", 1, "Something went wrong", "try again");
    const output = formatOcsError(err);
    expect(output).toContain("Error: Something went wrong");
    expect(output).toContain("Hint: try again");
    expect(output).toContain("Exit code: 1");
  });

  test("formats StackNotFoundError", () => {
    const err = new StackNotFoundError("my-stack", "/path/to/my-stack.json");
    const output = formatOcsError(err);
    expect(output).toContain("Error:");
    expect(output).toContain("my-stack");
    expect(output).toContain("Hint: run: ocs list");
    expect(output).toContain("Exit code: 1");
  });

  test("formats BaseConfigMissingError", () => {
    const err = new BaseConfigMissingError();
    const output = formatOcsError(err);
    expect(output).toContain("Error:");
    expect(output).toContain("Hint: run: ocs init");
    expect(output).toContain("Exit code: 3");
  });

  test("formats ConfigValidationError", () => {
    const err = new ConfigValidationError("Invalid model field");
    const output = formatOcsError(err);
    expect(output).toContain("Error: Invalid model field");
    expect(output).toContain("Hint: check: ocs show <stack>");
    expect(output).toContain("Exit code: 2");
  });

  test("formats HealthCheckTimeoutError", () => {
    const err = new HealthCheckTimeoutError("mcp-server", 3000, 30000);
    const output = formatOcsError(err);
    expect(output).toContain("Error:");
    expect(output).toContain("mcp-server");
    expect(output).toContain("Hint: try: ocs doctor");
    expect(output).toContain("Exit code: 4");
  });

  test("formats PluginNotInstalledError", () => {
    const err = new PluginNotInstalledError("oh-my-opencode");
    const output = formatOcsError(err);
    expect(output).toContain("Error:");
    expect(output).toContain("oh-my-opencode");
    expect(output).toContain("Hint: install: opencode plugin install oh-my-opencode");
    expect(output).toContain("Exit code: 5");
  });

  test("formats PrelaunchSpawnError", () => {
    const err = new PrelaunchSpawnError("mcp-server", "EACCES");
    const output = formatOcsError(err);
    expect(output).toContain("Error:");
    expect(output).toContain("mcp-server");
    expect(output).toContain("Hint: try: ocs doctor");
    expect(output).toContain("Exit code: 6");
  });

  test("includes 'Did you mean?' suggestion when provided", () => {
    const err = new StackNotFoundError("test-stak", "/path/test-stak.json");
    const output = formatOcsError(err, "test-stack");
    expect(output).toContain("Did you mean: test-stack?");
  });

  test("omits 'Did you mean?' when no suggestion", () => {
    const err = new StackNotFoundError("zzzzz", "/path/zzzzz.json");
    const output = formatOcsError(err);
    expect(output).not.toContain("Did you mean");
  });

  test("omits 'Did you mean?' when suggestion is null", () => {
    const err = new OcsError("TEST", 1, "msg", "hint");
    const output = formatOcsError(err, null);
    expect(output).not.toContain("Did you mean");
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import { resolveEnvVars } from "../../src/resolve.ts";

describe("resolveEnvVars - Characterization Tests", () => {
  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.TEST_VAR;
    delete process.env.TOKEN;
    delete process.env.PATH_VAR;
  });

  describe("exact variable replacement ($VAR and ${VAR})", () => {
    test("simple $VAR - exact match with existing env var", () => {
      process.env.TEST_VAR = "value123";
      const result = resolveEnvVars("$TEST_VAR");
      expect(result).toBe("value123");
    });

    test("simple ${VAR} - exact match with existing env var", () => {
      process.env.TEST_VAR = "value123";
      const result = resolveEnvVars("${TEST_VAR}");
      expect(result).toBe("value123");
    });

    test("$VAR with whitespace - should match trimmed value", () => {
      process.env.TEST_VAR = "value123";
      const result = resolveEnvVars("  $TEST_VAR  ");
      expect(result).toBe("value123");
    });

    test("${VAR} with whitespace - should match trimmed value", () => {
      process.env.TEST_VAR = "value123";
      const result = resolveEnvVars("  ${TEST_VAR}  ");
      expect(result).toBe("value123");
    });

    test("QUirk: missing env var with $VAR - returns ${VAR} with braces (not original $VAR)", () => {
      const result = resolveEnvVars("$MISSING_VAR");
      expect(result).toBe("${MISSING_VAR}");
    });

    test("missing env var with ${VAR} - returns original marker", () => {
      const result = resolveEnvVars("${MISSING_VAR}");
      expect(result).toBe("${MISSING_VAR}");
    });
  });

  describe("embedded variables in strings", () => {
    test("single embedded variable in string", () => {
      process.env.TOKEN = "abc123";
      const result = resolveEnvVars("Bearer $TOKEN");
      expect(result).toBe("Bearer abc123");
    });

    test("embedded ${VAR} in string", () => {
      process.env.TOKEN = "abc123";
      const result = resolveEnvVars("Bearer ${TOKEN}");
      expect(result).toBe("Bearer abc123");
    });

    test("multiple embedded variables", () => {
      process.env.USER = "john";
      process.env.HOME = "/home/john";
      const result = resolveEnvVars("$USER is in $HOME");
      expect(result).toBe("john is in /home/john");
    });

    test("mixed $VAR and ${VAR} in same string", () => {
      process.env.TOKEN = "abc123";
      process.env.USER = "john";
      const result = resolveEnvVars("Bearer $TOKEN as ${USER}");
      expect(result).toBe("Bearer abc123 as john");
    });

    test("missing embedded variable - keeps placeholder with braces", () => {
      const result = resolveEnvVars("Bearer $MISSING");
      expect(result).toBe("Bearer ${MISSING}");
    });

    test("missing ${VAR} embedded - keeps placeholder with braces", () => {
      const result = resolveEnvVars("Bearer ${MISSING}");
      expect(result).toBe("Bearer ${MISSING}");
    });

    test("URL pattern - preserves http://", () => {
      process.env.HOST = "example.com";
      const result = resolveEnvVars("Visit http://$HOST");
      expect(result).toBe("Visit http://example.com");
    });

    test("https:// pattern - preserved", () => {
      process.env.HOST = "example.com";
      const result = resolveEnvVars("Visit https://$HOST");
      expect(result).toBe("Visit https://example.com");
    });

    test("QUirk: path with // in string - preserved", () => {
      process.env.PATH_VAR = "path/to";
      const result = resolveEnvVars("// $PATH_VAR //");
      expect(result).toBe("// path/to //");
    });
  });

  describe("array recursion", () => {
    test("array of strings with variables", () => {
      process.env.USER = "john";
      process.env.HOME = "/home/john";
      const result = resolveEnvVars(["$USER", "$HOME", "static"]);
      expect(result).toEqual(["john", "/home/john", "static"]);
    });

    test("nested arrays", () => {
      process.env.USER = "john";
      const result = resolveEnvVars([["$USER"], ["nested"]]);
      expect(result).toEqual([["john"], ["nested"]]);
    });

    test("array with mixed types", () => {
      process.env.USER = "john";
      const result = resolveEnvVars(["$USER", 123, null, true]);
      expect(result).toEqual(["john", 123, null, true]);
    });
  });

  describe("object recursion", () => {
    test("simple object with variable values", () => {
      process.env.USER = "john";
      process.env.HOME = "/home/john";
      const result = resolveEnvVars({
        user: "$USER",
        home: "$HOME",
        static: "value",
      });
      expect(result).toEqual({
        user: "john",
        home: "/home/john",
        static: "value",
      });
    });

    test("nested objects", () => {
      process.env.USER = "john";
      const result = resolveEnvVars({
        config: {
          auth: {
            token: "$USER",
          },
        },
      });
      expect(result).toEqual({
        config: {
          auth: {
            token: "john",
          },
        },
      });
    });

    test("object with array values", () => {
      process.env.USER = "john";
      const result = resolveEnvVars({
        users: ["$USER", "other"],
      });
      expect(result).toEqual({
        users: ["john", "other"],
      });
    });

    test("object keys are NOT resolved", () => {
      process.env.USER = "john";
      const result = resolveEnvVars({
        $USER: "value",
      });
      // Keys are not resolved - this is expected behavior
      expect(result).toEqual({
        $USER: "value",
      });
    });
  });

  describe("scalar types", () => {
    test("number - returns as-is", () => {
      const result = resolveEnvVars(123);
      expect(result).toBe(123);
    });

    test("boolean - returns as-is", () => {
      const result = resolveEnvVars(true);
      expect(result).toBe(true);
    });

    test("null - returns as-is", () => {
      const result = resolveEnvVars(null);
      expect(result).toBe(null);
    });

    test("undefined - returns as-is", () => {
      const result = resolveEnvVars(undefined);
      expect(result).toBe(undefined);
    });

    test("empty string - returns as-is", () => {
      const result = resolveEnvVars("");
      expect(result).toBe("");
    });

    test("string without $ - returns as-is", () => {
      const result = resolveEnvVars("no variables here");
      expect(result).toBe("no variables here");
    });
  });

  describe("edge cases and quirks", () => {
    test("QUirk: $ at end of string without variable name", () => {
      const result = resolveEnvVars("ends with $");
      // The regex won't match - should return as-is
      expect(result).toBe("ends with $");
    });

    test("QUirk: ${ without closing brace - gets wrapped in braces", () => {
      const result = resolveEnvVars("${VAR");
      // The embedded replacement regex wraps it in braces
      expect(result).toBe("${VAR}");
    });

    test("QUirk: } without opening ${", () => {
      const result = resolveEnvVars("VAR}");
      // Should return as-is
      expect(result).toBe("VAR}");
    });

    test("QUirk: multiple consecutive $ signs - second $ becomes part of embedded replacement", () => {
      const result = resolveEnvVars("$$VAR");
      expect(result).toBe("$${VAR}");
    });

    test("QUirk: variable with underscore in name", () => {
      process.env.TEST_VAR = "value";
      const result = resolveEnvVars("$TEST_VAR");
      expect(result).toBe("value");
    });

    test("QUirk: variable name with hyphen - regex stops at hyphen, wraps in braces", () => {
      process.env["TEST-VAR"] = "value";
      const result = resolveEnvVars("$TEST-VAR");
      expect(result).toBe("${TEST}-VAR");
    });

    test("empty object", () => {
      const result = resolveEnvVars({});
      expect(result).toEqual({});
    });

    test("empty array", () => {
      const result = resolveEnvVars([]);
      expect(result).toEqual([]);
    });
  });
});

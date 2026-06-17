import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { StackManifest } from "../src/schemas.ts";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Minimal valid stack manifest */
function validManifest(overrides?: Partial<StackManifest>): StackManifest {
  return {
    name: "test-validate",
    description: "Stack for validation tests",
    ...overrides,
  };
}

// ── validateStack import (TDD: will fail until src/validate.ts exists) ──────

let validateStack: typeof import("../src/validate.ts").validateStack;

beforeEach(async () => {
  const mod = await import("../src/validate.ts");
  validateStack = mod.validateStack;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("validateStack", () => {
  describe("schema validation", () => {
    test("valid stack passes with no errors", () => {
      const manifest = validManifest();
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("valid stack with all fields passes", () => {
      const manifest = validManifest({
        opencode: { model: "openai:gpt-4o", small_model: "openai:gpt-4o-mini" },
        omo: {
          default_model: "openai:gpt-4o-mini",
          agents: { oracle: "openai:gpt-4o", sisyphus: "openai:gpt-4o" },
          categories: { quick: "openai:gpt-4o-mini" },
        },
        prelaunch: [
          {
            name: "mcp-server",
            check: { tcp: 3000 },
            start: "node server.js",
            cwd: "./server",
            timeoutMs: 30000,
          },
        ],
        env: { API_KEY: "$API_KEY" },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("env var resolution", () => {
    test("env with resolved vars passes", () => {
      process.env.TEST_API_KEY = "sk-123";
      const manifest = validManifest({
        env: { API_KEY: "$TEST_API_KEY" },
      });
      const result = validateStack(manifest);
      delete process.env.TEST_API_KEY;

      expect(result.valid).toBe(true);
      // May have warnings but no errors
      expect(result.errors).toHaveLength(0);
    });

    test("env with unresolved $VAR warns", () => {
      // Ensure the var is NOT set
      delete process.env.NONEXISTENT_VAR_12345;
      const manifest = validManifest({
        env: { MY_KEY: "$NONEXISTENT_VAR_12345" },
      });
      const result = validateStack(manifest);

      // Unresolved env is a warning, not an error - stack is still valid
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.message.includes("NONEXISTENT_VAR_12345"))).toBe(true);
    });

    test("env with ${VAR} syntax warns when missing", () => {
      delete process.env.MISSING_BRACE_VAR;
      const manifest = validManifest({
        env: { KEY: "${MISSING_BRACE_VAR}" },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.message.includes("MISSING_BRACE_VAR"))).toBe(true);
    });

    test("env with embedded $VAR in string warns when missing", () => {
      delete process.env.EMBED_MISSING;
      const manifest = validManifest({
        env: { URL: "https://api.example.com/$EMBED_MISSING" },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.message.includes("EMBED_MISSING"))).toBe(true);
    });

    test("env with literal values (no $ refs) passes", () => {
      const manifest = validManifest({
        env: { DEBUG: "true", PORT: "8080" },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("prelaunch validation", () => {
    test("prelaunch with tcp check passes", () => {
      const manifest = validManifest({
        prelaunch: [{ name: "server", check: { tcp: 3000 } }],
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("prelaunch with url check passes", () => {
      const manifest = validManifest({
        prelaunch: [{ name: "server", check: { url: "http://localhost:3000" } }],
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("prelaunch with empty check warns", () => {
      const manifest = validManifest({
        prelaunch: [{ name: "server", check: {} }],
      });
      const result = validateStack(manifest);

      // Empty check is valid per schema but we should warn
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.message.includes("empty check"))).toBe(true);
    });

    test("prelaunch with shell-injection pattern in start warns", () => {
      const manifest = validManifest({
        prelaunch: [
          {
            name: "server",
            check: { tcp: 3000 },
            start: "node server.js; rm -rf /",
          },
        ],
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "shell_injection")).toBe(true);
    });

    test("prelaunch with command substitution warns", () => {
      const manifest = validManifest({
        prelaunch: [
          {
            name: "server",
            check: { tcp: 3000 },
            start: "$(malicious command)",
          },
        ],
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "shell_injection")).toBe(true);
    });

    test("prelaunch with backtick substitution warns", () => {
      const manifest = validManifest({
        prelaunch: [
          {
            name: "server",
            check: { tcp: 3000 },
            start: "`whoami`",
          },
        ],
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "shell_injection")).toBe(true);
    });

    test("prelaunch with safe start command passes", () => {
      const manifest = validManifest({
        prelaunch: [
          {
            name: "server",
            check: { tcp: 3000 },
            start: "node server.js --port 3000",
          },
        ],
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.filter((w) => w.type === "shell_injection")).toHaveLength(0);
    });
  });

  describe("plugin compatibility", () => {
    test("stack with known OMO agents passes", () => {
      const manifest = validManifest({
        omo: {
          agents: {
            oracle: "openai:gpt-4o",
            sisyphus: "openai:gpt-4o",
            hephaestus: "openai:gpt-4o",
          },
        },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.filter((w) => w.type === "plugin")).toHaveLength(0);
    });

    test("stack with unknown agent name warns", () => {
      const manifest = validManifest({
        omo: {
          agents: {
            "future-agent": "openai:gpt-4o",
          },
        },
      });
      const result = validateStack(manifest);

      // Unknown agents are warnings, not errors (lenient schema)
      expect(result.valid).toBe(true);
      expect(
        result.warnings.some((w) => w.type === "plugin" && w.message.includes("future-agent")),
      ).toBe(true);
    });

    test("stack with known OMO categories passes", () => {
      const manifest = validManifest({
        omo: {
          categories: {
            quick: "openai:gpt-4o-mini",
            "unspecified-high": "openai:gpt-4o",
          },
        },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.filter((w) => w.type === "plugin")).toHaveLength(0);
    });

    test("stack with unknown category name warns", () => {
      const manifest = validManifest({
        omo: {
          categories: {
            "future-category": "openai:gpt-4o",
          },
        },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some((w) => w.type === "plugin" && w.message.includes("future-category")),
      ).toBe(true);
    });
  });

  describe("error aggregation", () => {
    test("multiple warnings are all collected", () => {
      delete process.env.UNRESOLVED_A;
      delete process.env.UNRESOLVED_B;
      const manifest = validManifest({
        env: {
          A: "$UNRESOLVED_A",
          B: "$UNRESOLVED_B",
        },
        omo: {
          agents: { "unknown-agent": "openai:gpt-4o" },
        },
      });
      const result = validateStack(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(3); // 2 env + 1 plugin
    });

    test("result contains all expected fields", () => {
      const manifest = validManifest();
      const result = validateStack(manifest);

      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});

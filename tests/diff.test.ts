import { describe, expect, test } from "bun:test";
import { type DiffEntry, diffStacks } from "../src/diff.ts";
import type { StackManifest } from "../src/schemas.ts";

// TDD: Write tests FIRST — implementation follows to make these pass

// Helper to create minimal manifests for testing
function manifest(overrides: Partial<StackManifest> = {}): StackManifest {
  return {
    name: "test",
    description: "test stack",
    ...overrides,
  };
}

describe("diffStacks", () => {
  describe("identical stacks", () => {
    test("two identical minimal manifests report no differences", () => {
      const a = manifest();
      const b = manifest();
      const result = diffStacks(a, b);
      expect(result.identical).toBe(true);
      expect(result.differences).toEqual([]);
    });

    test("two identical full manifests report no differences", () => {
      const full: StackManifest = {
        name: "stack",
        description: "full",
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
        env: { API_KEY: "sk-123", DEBUG: "true" },
      };
      const result = diffStacks(full, full);
      expect(result.identical).toBe(true);
      expect(result.differences).toEqual([]);
    });

    test("extra/passthrough fields are compared (they are part of the manifest)", () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing passthrough fields
      const a = manifest({ _comment: "test" } as any);
      // biome-ignore lint/suspicious/noExplicitAny: testing passthrough fields
      const b = manifest({ _comment: "different" } as any);
      // Passthrough fields ARE part of the parsed manifest, so diff reports them
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "_comment",
          type: "changed",
          left: "test",
          right: "different",
        },
      ]);
    });

    test("same passthrough fields are identical", () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing passthrough fields
      const a = manifest({ _comment: "same" } as any);
      // biome-ignore lint/suspicious/noExplicitAny: testing passthrough fields
      const b = manifest({ _comment: "same" } as any);
      const result = diffStacks(a, b);
      expect(result.identical).toBe(true);
    });
  });

  describe("description differences", () => {
    test("different description is reported", () => {
      const a = manifest({ description: "stack A" });
      const b = manifest({ description: "stack B" });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0]).toEqual({
        path: "description",
        type: "changed",
        left: "stack A",
        right: "stack B",
      });
    });
  });

  describe("opencode field differences", () => {
    test("different model value is reported", () => {
      const a = manifest({
        opencode: { model: "openai:gpt-4o", small_model: "openai:gpt-4o-mini" },
      });
      const b = manifest({
        opencode: { model: "openai:gpt-4o-turbo", small_model: "openai:gpt-4o-mini" },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "opencode.model",
          type: "changed",
          left: "openai:gpt-4o",
          right: "openai:gpt-4o-turbo",
        },
      ]);
    });

    test("added field in opencode is reported", () => {
      const a = manifest({ opencode: { model: "openai:gpt-4o" } });
      const b = manifest({
        opencode: { model: "openai:gpt-4o", small_model: "openai:gpt-4o-mini" },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "opencode.small_model",
          type: "added",
          left: undefined,
          right: "openai:gpt-4o-mini",
        },
      ]);
    });

    test("removed field in opencode is reported", () => {
      const a = manifest({
        opencode: { model: "openai:gpt-4o", small_model: "openai:gpt-4o-mini" },
      });
      const b = manifest({ opencode: { model: "openai:gpt-4o" } });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "opencode.small_model",
          type: "removed",
          left: "openai:gpt-4o-mini",
          right: undefined,
        },
      ]);
    });

    test("missing opencode section entirely is reported", () => {
      const a = manifest({
        opencode: { model: "openai:gpt-4o" },
      });
      const b = manifest({});
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences.some((d) => d.path === "opencode" && d.type === "removed")).toBe(
        true,
      );
    });

    test("added opencode section is reported", () => {
      const a = manifest({});
      const b = manifest({ opencode: { model: "openai:gpt-4o" } });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences.some((d) => d.path === "opencode" && d.type === "added")).toBe(
        true,
      );
    });
  });

  describe("omo/agents differences", () => {
    test("different agent model is reported", () => {
      const a = manifest({
        omo: {
          agents: { oracle: "openai:gpt-4o", sisyphus: "openai:gpt-4o" },
        },
      });
      const b = manifest({
        omo: {
          agents: { oracle: "openai:gpt-4o-turbo", sisyphus: "openai:gpt-4o" },
        },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "omo.agents.oracle",
          type: "changed",
          left: "openai:gpt-4o",
          right: "openai:gpt-4o-turbo",
        },
      ]);
    });

    test("added agent is reported", () => {
      const a = manifest({
        omo: { agents: { oracle: "openai:gpt-4o" } },
      });
      const b = manifest({
        omo: { agents: { oracle: "openai:gpt-4o", sisyphus: "openai:gpt-4o" } },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "omo.agents.sisyphus",
          type: "added",
          left: undefined,
          right: "openai:gpt-4o",
        },
      ]);
    });

    test("removed agent is reported", () => {
      const a = manifest({
        omo: { agents: { oracle: "openai:gpt-4o", sisyphus: "openai:gpt-4o" } },
      });
      const b = manifest({
        omo: { agents: { oracle: "openai:gpt-4o" } },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "omo.agents.sisyphus",
          type: "removed",
          left: "openai:gpt-4o",
          right: undefined,
        },
      ]);
    });
  });

  describe("omo/categories differences", () => {
    test("different category model is reported", () => {
      const a = manifest({
        omo: { categories: { quick: "openai:gpt-4o-mini", ultrabrain: "openai:o1-preview" } },
      });
      const b = manifest({
        omo: { categories: { quick: "openai:gpt-4o-mini", ultrabrain: "openai:o1" } },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "omo.categories.ultrabrain",
          type: "changed",
          left: "openai:o1-preview",
          right: "openai:o1",
        },
      ]);
    });

    test("multiple category differences reported", () => {
      const a = manifest({
        omo: { categories: { quick: "a", ultrabrain: "b", writing: "c" } },
      });
      const b = manifest({
        omo: { categories: { quick: "a", ultrabrain: "x", writing: "y" } },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toHaveLength(2);
      expect(result.differences.map((d) => d.path).sort()).toEqual([
        "omo.categories.ultrabrain",
        "omo.categories.writing",
      ]);
    });
  });

  describe("omo/default_model differences", () => {
    test("different default_model is reported", () => {
      const a = manifest({ omo: { default_model: "openai:gpt-4o-mini" } });
      const b = manifest({ omo: { default_model: "openai:gpt-4o-turbo" } });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "omo.default_model",
          type: "changed",
          left: "openai:gpt-4o-mini",
          right: "openai:gpt-4o-turbo",
        },
      ]);
    });
  });

  describe("prelaunch differences", () => {
    test("different prelaunch entries reported", () => {
      const a = manifest({
        prelaunch: [{ name: "mcp-server", check: { tcp: 3000 }, start: "old-start" }],
      });
      const b = manifest({
        prelaunch: [{ name: "mcp-server", check: { tcp: 3000 }, start: "new-start" }],
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(
        result.differences.some((d) => d.path.startsWith("prelaunch") && d.type === "changed"),
      ).toBe(true);
    });

    test("added prelaunch entry reported", () => {
      const a = manifest({ prelaunch: [] });
      const b = manifest({
        prelaunch: [{ name: "mcp-server", check: { tcp: 3000 } }],
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences.some((d) => d.type === "added")).toBe(true);
    });

    test("removed prelaunch entry reported", () => {
      const a = manifest({
        prelaunch: [{ name: "mcp-server", check: { tcp: 3000 } }],
      });
      const b = manifest({ prelaunch: [] });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences.some((d) => d.type === "removed")).toBe(true);
    });
  });

  describe("env differences", () => {
    test("different env var value is reported", () => {
      const a = manifest({ env: { API_KEY: "old-key", DEBUG: "false" } });
      const b = manifest({ env: { API_KEY: "new-key", DEBUG: "false" } });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "env.API_KEY",
          type: "changed",
          left: "old-key",
          right: "new-key",
        },
      ]);
    });

    test("added env var is reported", () => {
      const a = manifest({ env: { API_KEY: "key" } });
      const b = manifest({ env: { API_KEY: "key", NEW_VAR: "value" } });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "env.NEW_VAR",
          type: "added",
          left: undefined,
          right: "value",
        },
      ]);
    });

    test("removed env var is reported", () => {
      const a = manifest({ env: { API_KEY: "key", OLD_VAR: "value" } });
      const b = manifest({ env: { API_KEY: "key" } });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "env.OLD_VAR",
          type: "removed",
          left: "value",
          right: undefined,
        },
      ]);
    });
  });

  describe("nested object differences (recursive)", () => {
    test("deeply nested opencode.agent differences reported correctly", () => {
      const a = manifest({
        opencode: {
          model: "openai:gpt-4o",
          agent: {
            build: { model: "openai:gpt-4o" },
            plan: { model: "openai:gpt-4o" },
          },
        },
      });
      const b = manifest({
        opencode: {
          model: "openai:gpt-4o",
          agent: {
            build: { model: "openai:gpt-4o-turbo" },
            plan: { model: "openai:gpt-4o" },
          },
        },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "opencode.agent.build.model",
          type: "changed",
          left: "openai:gpt-4o",
          right: "openai:gpt-4o-turbo",
        },
      ]);
    });

    test("prelaunch nested check differences reported", () => {
      const a = manifest({
        prelaunch: [{ name: "server", check: { tcp: 3000 } }],
      });
      const b = manifest({
        prelaunch: [{ name: "server", check: { tcp: 4000 } }],
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences.some((d) => d.path.includes("check") && d.type === "changed")).toBe(
        true,
      );
    });
  });

  describe("multiple differences", () => {
    test("reports all differences across fields", () => {
      const a = manifest({
        description: "stack A",
        opencode: { model: "openai:gpt-4o" },
        omo: {
          agents: { oracle: "openai:gpt-4o" },
          categories: { quick: "openai:gpt-4o-mini" },
        },
        env: { KEY_A: "a" },
      });
      const b = manifest({
        description: "stack B",
        opencode: { model: "openai:gpt-4o-turbo" },
        omo: {
          agents: { oracle: "openai:gpt-4o", sisyphus: "openai:gpt-4o" },
          categories: { quick: "openai:gpt-4o" },
        },
        env: { KEY_A: "a", KEY_B: "b" },
      });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      // Should have diffs for: description, opencode.model, omo.agents.sisyphus (added),
      // omo.categories.quick, env.KEY_B (added)
      expect(result.differences.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("name differences", () => {
    test("different names are reported", () => {
      const a = manifest({ name: "stack-a" });
      const b = manifest({ name: "stack-b" });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences).toEqual([
        {
          path: "name",
          type: "changed",
          left: "stack-a",
          right: "stack-b",
        },
      ]);
    });
  });

  describe("empty/missing sections", () => {
    test("both missing omo section is identical", () => {
      const a = manifest({ description: "same" });
      const b = manifest({ description: "same" });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(true);
    });

    test("both empty env is identical", () => {
      const a = manifest({ env: {} });
      const b = manifest({ env: {} });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(true);
    });

    test("both empty prelaunch is identical", () => {
      const a = manifest({ prelaunch: [] });
      const b = manifest({ prelaunch: [] });
      const result = diffStacks(a, b);
      expect(result.identical).toBe(true);
    });
  });

  describe("diffStacks with real stacks", () => {
    test("openai and example stacks produce differences", () => {
      const { loadStack } = require("../src/stacks.ts");
      const a = loadStack("openai");
      const b = loadStack("example");
      const result = diffStacks(a, b);
      expect(result.identical).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
    });
  });

  describe("DiffEntry type", () => {
    test("DiffEntry has required fields", () => {
      const entry: DiffEntry = {
        path: "test.field",
        type: "changed",
        left: "a",
        right: "b",
      };
      expect(entry.path).toBe("test.field");
      expect(entry.type).toBe("changed");
    });
  });
});

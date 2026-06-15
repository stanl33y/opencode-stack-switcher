import { describe, expect, test } from "bun:test";
import {
  BaseConfigSchema,
  EnvVarsSchema,
  OmoConfigSchema,
  PrelaunchEntrySchema,
  StackManifestSchema,
} from "../src/schemas.ts";

// Tests for zod schemas - TDD approach: write failing tests FIRST
// This file will fail until src/schemas.ts is implemented

describe("zod schemas - StackManifest and related types", () => {
  describe("StackManifestSchema", () => {
    test("valid minimal stack manifest", () => {
      const validManifest = {
        name: "test-stack",
        description: "A test stack",
      };

      // Will fail until StackManifestSchema is implemented
      expect(() => {
        StackManifestSchema.parse(validManifest);
      }).not.toThrow();
    });

    test("valid full stack manifest with all fields", () => {
      const fullManifest = {
        name: "full-stack",
        description: "Full stack with all fields",
        opencode: {
          model: "openai:gpt-4o",
          small_model: "openai:gpt-4o-mini",
        },
        omo: {
          default_model: "openai:gpt-4o-mini",
          agents: {
            oracle: "openai:gpt-4o",
            sisyphus: "openai:gpt-4o",
          },
          categories: {
            quick: "openai:gpt-4o-mini",
            unspecified_high: "openai:gpt-4o",
          },
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
        env: {
          API_KEY: "$API_KEY",
          DEBUG: "true",
        },
      };

      expect(() => {
        StackManifestSchema.parse(fullManifest);
      }).not.toThrow();
    });

    test("missing required 'name' field", () => {
      const invalidManifest = {
        description: "Stack without name",
      };

      expect(() => {
        StackManifestSchema.parse(invalidManifest);
      }).toThrow();
    });

    test("missing required 'description' field", () => {
      const invalidManifest = {
        name: "no-description",
      };

      expect(() => {
        StackManifestSchema.parse(invalidManifest);
      }).toThrow();
    });

    test("invalid type for 'name' (number instead of string)", () => {
      const invalidManifest = {
        name: 123,
        description: "Invalid name type",
      };

      expect(() => {
        StackManifestSchema.parse(invalidManifest);
      }).toThrow();
    });

    test("extra fields allowed (lenient mode)", () => {
      const manifestWithExtras = {
        name: "stack-with-extras",
        description: "Stack with extra fields",
        _comment: "This should be allowed",
        metadata: { version: 1 },
        customField: "should be preserved",
      };

      const result = () => {
        return StackManifestSchema.parse(manifestWithExtras);
      };

      // Should not throw
      expect(result).not.toThrow();
      // Extra fields should be preserved
      const parsed = result();
      expect(parsed).toHaveProperty("_comment");
      expect(parsed).toHaveProperty("metadata");
      expect(parsed).toHaveProperty("customField");
    });

    test("PrelaunchEntry missing required 'name'", () => {
      const manifest = {
        name: "test-stack",
        description: "Test",
        prelaunch: [
          {
            check: { tcp: 3000 },
          },
        ],
      };

      expect(() => {
        StackManifestSchema.parse(manifest);
      }).toThrow();
    });

    test("PrelaunchEntry missing 'check' field", () => {
      const manifest = {
        name: "test-stack",
        description: "Test",
        prelaunch: [
          {
            name: "server",
          },
        ],
      };

      expect(() => {
        StackManifestSchema.parse(manifest);
      }).toThrow();
    });
  });

  describe("PrelaunchEntrySchema", () => {
    test("valid minimal prelaunch entry", () => {
      const validEntry = {
        name: "server",
        check: { tcp: 3000 },
      };

      expect(() => {
        PrelaunchEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    test("valid prelaunch entry with all optional fields", () => {
      const fullEntry = {
        name: "server",
        check: { tcp: 3000 },
        start: "node server.js",
        cwd: "./server",
        timeoutMs: 30000,
      };

      expect(() => {
        PrelaunchEntrySchema.parse(fullEntry);
      }).not.toThrow();
    });

    test("check with URL instead of TCP", () => {
      const entry = {
        name: "server",
        check: { url: "http://localhost:3000" },
      };

      expect(() => {
        PrelaunchEntrySchema.parse(entry);
      }).not.toThrow();
    });

    test("invalid check type (string instead of object)", () => {
      const invalidEntry = {
        name: "server",
        check: "3000",
      };

      expect(() => {
        PrelaunchEntrySchema.parse(invalidEntry);
      }).toThrow();
    });
  });

  describe("EnvVarsSchema", () => {
    test("valid env vars object", () => {
      const validEnv = {
        API_KEY: "sk-123",
        DEBUG: "true",
        PORT: "8080",
      };

      expect(() => {
        EnvVarsSchema.parse(validEnv);
      }).not.toThrow();
    });

    test("empty env vars object", () => {
      expect(() => {
        EnvVarsSchema.parse({});
      }).not.toThrow();
    });

    test("env vars with variable references", () => {
      const envWithRefs = {
        API_KEY: "$API_KEY",
        DATABASE_URL: "postgresql://$DB_USER:$DB_PASS@localhost:5432/db",
      };

      expect(() => {
        EnvVarsSchema.parse(envWithRefs);
      }).not.toThrow();
    });
  });

  describe("BaseConfigSchema", () => {
    test("valid base config with opencode overlay", () => {
      const validBase = {
        model: "openai:gpt-4o",
        small_model: "openai:gpt-4o-mini",
        agent: "openai:gpt-4o",
      };

      expect(() => {
        BaseConfigSchema.parse(validBase);
      }).not.toThrow();
    });

    test("base config accepts arbitrary keys", () => {
      const baseWithExtras = {
        model: "openai:gpt-4o",
        someOtherKey: "value",
        nested: {
          config: "here",
        },
      };

      expect(() => {
        BaseConfigSchema.parse(baseWithExtras);
      }).not.toThrow();
    });
  });

  describe("OmoConfigSchema", () => {
    test("valid minimal omo config", () => {
      const validOmo = {
        default_model: "openai:gpt-4o-mini",
      };

      expect(() => {
        OmoConfigSchema.parse(validOmo);
      }).not.toThrow();
    });

    test("valid full omo config", () => {
      const fullOmo = {
        default_model: "openai:gpt-4o-mini",
        agents: {
          oracle: "openai:gpt-4o",
          sisyphus: "openai:gpt-4o",
        },
        categories: {
          quick: "openai:gpt-4o-mini",
        },
      };

      expect(() => {
        OmoConfigSchema.parse(fullOmo);
      }).not.toThrow();
    });

    test("agents section accepts unknown agent names (lenient)", () => {
      const omoWithUnknownAgent = {
        default_model: "openai:gpt-4o-mini",
        agents: {
          "unknown-future-agent": "openai:gpt-4o",
        },
      };

      expect(() => {
        OmoConfigSchema.parse(omoWithUnknownAgent);
      }).not.toThrow();
    });

    test("categories section accepts unknown category names (lenient)", () => {
      const omoWithUnknownCategory = {
        default_model: "openai:gpt-4o-mini",
        categories: {
          "future-category": "openai:gpt-4o",
        },
      };

      expect(() => {
        OmoConfigSchema.parse(omoWithUnknownCategory);
      }).not.toThrow();
    });
  });

  describe("type exports", () => {
    test("types can be imported from schemas.ts", () => {
      // TypeScript type checking validates exports at compile time
      // This test ensures the schemas file compiles without errors
      expect(() => {
        import("../src/schemas.ts");
      }).not.toThrow();
    });
  });
});

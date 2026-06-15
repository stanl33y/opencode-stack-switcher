import { beforeEach, describe, expect, it } from "bun:test";
import * as config from "../src/config";

describe("config module", () => {
  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.ZAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.EDITOR;
    delete process.env.XDG_CONFIG_HOME;
  });

  describe("API key names constant", () => {
    it("should export API_KEY_NAMES constant", () => {
      expect(config.API_KEY_NAMES).toBeInstanceOf(Array);
      expect(config.API_KEY_NAMES).toEqual(["ZAI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"]);
    });
  });

  describe("getApiKey", () => {
    it("should return undefined when API key env var is not set", () => {
      const result = config.getApiKey("ZAI_API_KEY");
      expect(result).toBeUndefined();
    });

    it("should return value when API key env var is set", () => {
      process.env.ZAI_API_KEY = "test-key-value";
      const result = config.getApiKey("ZAI_API_KEY");
      expect(result).toBe("test-key-value");
    });

    it("should handle different API key names", () => {
      process.env.OPENAI_API_KEY = "openai-key";
      process.env.OPENROUTER_API_KEY = "openrouter-key";

      expect(config.getApiKey("OPENAI_API_KEY")).toBe("openai-key");
      expect(config.getApiKey("OPENROUTER_API_KEY")).toBe("openrouter-key");
    });
  });

  describe("getDefaultEditor", () => {
    it("should return EDITOR env var when set", () => {
      process.env.EDITOR = "code";
      const result = config.getDefaultEditor();
      expect(result).toBe("code");
    });

    it("should return platform-specific default when EDITOR not set (Windows)", () => {
      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const result = config.getDefaultEditor();
      expect(result).toBe("notepad");

      // Restore original platform
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should return platform-specific default when EDITOR not set (Unix)", () => {
      // Mock Unix platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      const result = config.getDefaultEditor();
      expect(result).toBe("vi");

      // Restore original platform
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("getOpencodeConfigDir", () => {
    it("should use XDG_CONFIG_HOME when set", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      const result = config.getOpencodeConfigDir();
      // On Windows, path.join uses backslashes; use platform-agnostic check
      expect(result).toMatch(/opencode$/);
      expect(result).toContain("custom");
      expect(result).toContain("config");
    });

    it("should use ~/.config/opencode when XDG_CONFIG_HOME not set", () => {
      // XDG_CONFIG_HOME is not set in beforeEach
      const result = config.getOpencodeConfigDir();
      // Should include homedir/.config/opencode
      expect(result).toContain(".config");
      expect(result).toContain("opencode");
      expect(result).toMatch(/[/\\]opencode$/);
    });

    it("should return consistent path structure on all platforms", () => {
      const result = config.getOpencodeConfigDir();
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getProviderApiKeys", () => {
    it("should return object with all provider API keys", () => {
      process.env.ZAI_API_KEY = "zai-value";
      process.env.OPENAI_API_KEY = "openai-value";
      process.env.OPENROUTER_API_KEY = "openrouter-value";

      const result = config.getProviderApiKeys();
      expect(result).toEqual({
        ZAI_API_KEY: "zai-value",
        OPENAI_API_KEY: "openai-value",
        OPENROUTER_API_KEY: "openrouter-value",
      });
    });

    it("should return object with only set keys", () => {
      process.env.OPENAI_API_KEY = "openai-value";
      // Other keys not set

      const result = config.getProviderApiKeys();
      expect(result).toEqual({
        OPENAI_API_KEY: "openai-value",
      });
    });

    it("should return empty object when no keys set", () => {
      // All keys cleared in beforeEach
      const result = config.getProviderApiKeys();
      expect(result).toEqual({});
    });
  });

  describe("isApiKeySet", () => {
    it("should return true when API key is set", () => {
      process.env.ZAI_API_KEY = "some-key";
      expect(config.isApiKeySet("ZAI_API_KEY")).toBe(true);
    });

    it("should return false when API key is not set", () => {
      expect(config.isApiKeySet("OPENAI_API_KEY")).toBe(false);
    });

    it("should return false for empty string values", () => {
      process.env.OPENROUTER_API_KEY = "";
      expect(config.isApiKeySet("OPENROUTER_API_KEY")).toBe(false);
    });
  });

  describe("hasAnyApiKey", () => {
    it("should return true when at least one API key is set", () => {
      process.env.OPENAI_API_KEY = "key";
      expect(config.hasAnyApiKey()).toBe(true);
    });

    it("should return false when no API keys are set", () => {
      // All keys cleared in beforeEach
      expect(config.hasAnyApiKey()).toBe(false);
    });
  });
});

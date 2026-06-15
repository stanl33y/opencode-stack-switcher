import { describe, expect, test } from "bun:test";
import {
  BaseConfigMissingError,
  ConfigValidationError,
  HealthCheckTimeoutError,
  OcsError,
  PluginNotInstalledError,
  PrelaunchSpawnError,
  StackNotFoundError,
} from "../src/errors";

describe("OcsError - Base Class", () => {
  test("has code property", () => {
    const error = new OcsError("TEST_ERROR", 1, "Test message", "Test hint");
    expect(error.code).toBe("TEST_ERROR");
  });

  test("has exitCode property", () => {
    const error = new OcsError("TEST_ERROR", 1, "Test message", "Test hint");
    expect(error.exitCode).toBe(1);
  });

  test("has hint property", () => {
    const error = new OcsError("TEST_ERROR", 1, "Test message", "Test hint");
    expect(error.hint).toBe("Test hint");
  });

  test("preserves Error message", () => {
    const error = new OcsError("TEST_ERROR", 1, "Test message", "Test hint");
    expect(error.message).toBe("Test message");
  });

  test("is instance of Error", () => {
    const error = new OcsError("TEST_ERROR", 1, "Test message", "Test hint");
    expect(error).toBeInstanceOf(Error);
  });

  test("is instance of OcsError", () => {
    const error = new OcsError("TEST_ERROR", 1, "Test message", "Test hint");
    expect(error).toBeInstanceOf(OcsError);
  });

  test("correct stack trace", () => {
    const error = new OcsError("TEST_ERROR", 1, "Test message", "Test hint");
    expect(error.stack).toBeDefined();
  });
});

describe("StackNotFoundError", () => {
  test("has correct code", () => {
    const error = new StackNotFoundError("my-stack", "/path/to/stack.json");
    expect(error.code).toBe("STACK_NOT_FOUND");
  });

  test("has exitCode", () => {
    const error = new StackNotFoundError("my-stack", "/path/to/stack.json");
    expect(error.exitCode).toBe(1);
  });

  test("has actionable hint", () => {
    const error = new StackNotFoundError("my-stack", "/path/to/stack.json");
    expect(error.hint).toBe("run: ocs list");
  });

  test("message includes stack name and path", () => {
    const error = new StackNotFoundError("my-stack", "/path/to/stack.json");
    expect(error.message).toContain("my-stack");
    expect(error.message).toContain("/path/to/stack.json");
  });

  test("is instance of OcsError", () => {
    const error = new StackNotFoundError("my-stack", "/path/to/stack.json");
    expect(error).toBeInstanceOf(OcsError);
  });
});

describe("ConfigValidationError", () => {
  test("has correct code", () => {
    const error = new ConfigValidationError("Invalid stack configuration");
    expect(error.code).toBe("CONFIG_VALIDATION_ERROR");
  });

  test("has exitCode", () => {
    const error = new ConfigValidationError("Invalid stack configuration");
    expect(error.exitCode).toBe(2);
  });

  test("has actionable hint", () => {
    const error = new ConfigValidationError("Invalid stack configuration");
    expect(error.hint).toBe("check: ocs show <stack>");
  });

  test("message includes validation error details", () => {
    const error = new ConfigValidationError("Invalid stack configuration");
    expect(error.message).toBe("Invalid stack configuration");
  });

  test("is instance of OcsError", () => {
    const error = new ConfigValidationError("Invalid stack configuration");
    expect(error).toBeInstanceOf(OcsError);
  });
});

describe("BaseConfigMissingError", () => {
  test("has correct code", () => {
    const error = new BaseConfigMissingError();
    expect(error.code).toBe("BASE_CONFIG_MISSING");
  });

  test("has exitCode", () => {
    const error = new BaseConfigMissingError();
    expect(error.exitCode).toBe(3);
  });

  test("has actionable hint", () => {
    const error = new BaseConfigMissingError();
    expect(error.hint).toBe("run: ocs init");
  });

  test("message references base.json path", () => {
    const error = new BaseConfigMissingError();
    expect(error.message).toContain("stacks/base.json");
  });

  test("is instance of OcsError", () => {
    const error = new BaseConfigMissingError();
    expect(error).toBeInstanceOf(OcsError);
  });
});

describe("HealthCheckTimeoutError", () => {
  test("has correct code", () => {
    const error = new HealthCheckTimeoutError("mcp-server", 3000, 30000);
    expect(error.code).toBe("HEALTH_CHECK_TIMEOUT");
  });

  test("has exitCode", () => {
    const error = new HealthCheckTimeoutError("mcp-server", 3000, 30000);
    expect(error.exitCode).toBe(4);
  });

  test("has actionable hint", () => {
    const error = new HealthCheckTimeoutError("mcp-server", 3000, 30000);
    expect(error.hint).toBe("try: ocs doctor");
  });

  test("message includes service name and port", () => {
    const error = new HealthCheckTimeoutError("mcp-server", 3000, 30000);
    expect(error.message).toContain("mcp-server");
    expect(error.message).toContain("3000");
  });

  test("is instance of OcsError", () => {
    const error = new HealthCheckTimeoutError("mcp-server", 3000, 30000);
    expect(error).toBeInstanceOf(OcsError);
  });
});

describe("PluginNotInstalledError", () => {
  test("has correct code", () => {
    const error = new PluginNotInstalledError("oh-my-opencode");
    expect(error.code).toBe("PLUGIN_NOT_INSTALLED");
  });

  test("has exitCode", () => {
    const error = new PluginNotInstalledError("oh-my-opencode");
    expect(error.exitCode).toBe(5);
  });

  test("has actionable hint", () => {
    const error = new PluginNotInstalledError("oh-my-opencode");
    expect(error.hint).toBe("install: opencode plugin install oh-my-opencode");
  });

  test("message includes plugin name", () => {
    const error = new PluginNotInstalledError("oh-my-opencode");
    expect(error.message).toContain("oh-my-opencode");
  });

  test("is instance of OcsError", () => {
    const error = new PluginNotInstalledError("oh-my-opencode");
    expect(error).toBeInstanceOf(OcsError);
  });
});

describe("PrelaunchSpawnError", () => {
  test("has correct code", () => {
    const error = new PrelaunchSpawnError("mcp-server", "Command failed");
    expect(error.code).toBe("PRELAUNCH_SPAWN_ERROR");
  });

  test("has exitCode", () => {
    const error = new PrelaunchSpawnError("mcp-server", "Command failed");
    expect(error.exitCode).toBe(6);
  });

  test("has actionable hint", () => {
    const error = new PrelaunchSpawnError("mcp-server", "Command failed");
    expect(error.hint).toBe("try: ocs doctor");
  });

  test("message includes service name", () => {
    const error = new PrelaunchSpawnError("mcp-server", "Command failed");
    expect(error.message).toContain("mcp-server");
  });

  test("message includes error details", () => {
    const error = new PrelaunchSpawnError("mcp-server", "Command failed");
    expect(error.message).toContain("Command failed");
  });

  test("is instance of OcsError", () => {
    const error = new PrelaunchSpawnError("mcp-server", "Command failed");
    expect(error).toBeInstanceOf(OcsError);
  });
});

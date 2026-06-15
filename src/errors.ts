/**
 * Typed error hierarchy for OCS (OpenCode Stack Switcher).
 *
 * All errors extend from OcsError and provide:
 * - code: A unique string identifier for the error type
 * - exitCode: A numeric exit code for CLI use
 * - hint: An actionable hint for users to resolve the error
 */

/**
 * Base class for all OCS errors.
 * Provides code, exitCode, and hint properties for consistent error handling.
 */
export class OcsError extends Error {
  /**
   * Unique error code identifier
   */
  readonly code: string;

  /**
   * Exit code for CLI usage
   */
  readonly exitCode: number;

  /**
   * Actionable hint for users
   */
  readonly hint: string;

  constructor(code: string, exitCode: number, message: string, hint: string) {
    super(message);
    this.name = "OcsError";
    this.code = code;
    this.exitCode = exitCode;
    this.hint = hint;

    // Maintains proper stack trace (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OcsError);
    }
  }
}

/**
 * Thrown when a requested stack does not exist.
 */
export class StackNotFoundError extends OcsError {
  constructor(stackName: string, path: string) {
    super(
      "STACK_NOT_FOUND",
      1,
      `Stack '${stackName}' não existe (${path}). Use 'ocs list'.`,
      "run: ocs list",
    );
    this.name = "StackNotFoundError";
  }
}

/**
 * Thrown when stack configuration fails validation.
 */
export class ConfigValidationError extends OcsError {
  constructor(message: string) {
    super("CONFIG_VALIDATION_ERROR", 2, message, "check: ocs show <stack>");
    this.name = "ConfigValidationError";
  }
}

/**
 * Thrown when stacks/base.json is missing (not initialized).
 */
export class BaseConfigMissingError extends OcsError {
  constructor() {
    super(
      "BASE_CONFIG_MISSING",
      3,
      "stacks/base.json ausente — rode 'ocs init' para gerá-lo do config atual.",
      "run: ocs init",
    );
    this.name = "BaseConfigMissingError";
  }
}

/**
 * Thrown when a health check times out during prelaunch.
 */
export class HealthCheckTimeoutError extends OcsError {
  constructor(serviceName: string, port: number, timeoutMs: number) {
    super(
      "HEALTH_CHECK_TIMEOUT",
      4,
      `Health check timeout: ${serviceName} (port ${port}) did not respond within ${timeoutMs}ms.`,
      "try: ocs doctor",
    );
    this.name = "HealthCheckTimeoutError";
  }
}

/**
 * Thrown when a required OpenCode plugin is not installed.
 */
export class PluginNotInstalledError extends OcsError {
  constructor(pluginName: string) {
    super(
      "PLUGIN_NOT_INSTALLED",
      5,
      `Required plugin '${pluginName}' is not installed.`,
      `install: opencode plugin install ${pluginName}`,
    );
    this.name = "PluginNotInstalledError";
  }
}

/**
 * Thrown when a prelaunch service fails to spawn.
 */
export class PrelaunchSpawnError extends OcsError {
  constructor(serviceName: string, spawnError: string) {
    super(
      "PRELAUNCH_SPAWN_ERROR",
      6,
      `Failed to spawn ${serviceName}: ${spawnError}`,
      "try: ocs doctor",
    );
    this.name = "PrelaunchSpawnError";
  }
}

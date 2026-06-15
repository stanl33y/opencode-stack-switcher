/**
 * Centralized configuration module
 *
 * Provides safe access to environment variables and constants.
 * All process.env access should go through this module.
 *
 * @module config
 */

import { homedir } from "node:os";
import { join } from "node:path";

/**
 * List of API key environment variable names
 */
export const API_KEY_NAMES = ["ZAI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"] as const;

/**
 * Get an API key value by name
 *
 * @param keyName - Name of the API key environment variable
 * @returns The API key value, or undefined if not set
 */
export function getApiKey(keyName: string): string | undefined {
  return process.env[keyName];
}

/**
 * Get the default editor for editing stack manifests
 *
 * Uses EDITOR env var if set, otherwise:
 * - Windows: notepad
 * - Other platforms: vi
 *
 * @returns Editor command string
 */
export function getDefaultEditor(): string {
  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }
  return process.platform === "win32" ? "notepad" : "vi";
}

/**
 * Get the OpenCode configuration directory path
 *
 * Uses XDG_CONFIG_HOME if set, otherwise ~/.config/opencode.
 *
 * Note: On Windows, this uses ~/.config/opencode (e.g., C:\Users\user\.config\opencode)
 * which is non-standard but preserved for compatibility. Standard Windows apps would
 * use %APPDATA%\opencode or %LOCALAPPDATA%\opencode.
 *
 * This matches the current OCS behavior and should not be changed without
 * thorough testing and migration strategy.
 *
 * @returns Absolute path to OpenCode config directory
 */
export function getOpencodeConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, "opencode");
  }
  return join(homedir(), ".config", "opencode");
}

/**
 * Get all provider API keys that are currently set
 *
 * Returns an object with key-value pairs for all API keys that have values.
 *
 * @returns Object with set API keys
 */
export function getProviderApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const keyName of API_KEY_NAMES) {
    const value = process.env[keyName];
    if (value) {
      keys[keyName] = value;
    }
  }
  return keys;
}

/**
 * Check if a specific API key environment variable is set
 *
 * Returns true if the variable exists and has a non-empty value.
 *
 * @param keyName - Name of the API key environment variable
 * @returns true if the key is set and has a non-empty value
 */
export function isApiKeySet(keyName: string): boolean {
  const value = process.env[keyName];
  return value !== undefined && value !== "";
}

/**
 * Check if any API key is set
 *
 * @returns true if at least one API key has a non-empty value
 */
export function hasAnyApiKey(): boolean {
  return API_KEY_NAMES.some((keyName) => isApiKeySet(keyName));
}

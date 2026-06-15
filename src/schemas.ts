import { z } from "zod";

/**
 * Schema for environment variables in stack manifests.
 * Maps environment variable names to their string values.
 * Values can include variable references like $VAR or ${VAR}.
 */
export const EnvVarsSchema = z.record(z.string());

/**
 * Inferred type from EnvVarsSchema.
 */
export type EnvVars = z.infer<typeof EnvVarsSchema>;

/**
 * Schema for prelaunch entry check configuration.
 * Either tcp port number or URL for health checking.
 */
const PrelaunchCheckSchema = z.object({
  tcp: z.number().optional(),
  url: z.string().optional(),
});

/**
 * Schema for prelaunch entry in stack manifests.
 * Defines local servers to check/start before launching opencode.
 */
export const PrelaunchEntrySchema = z.object({
  name: z.string(),
  check: PrelaunchCheckSchema,
  start: z.string().optional(),
  cwd: z.string().optional(),
  timeoutMs: z.number().optional(),
});

/**
 * Inferred type from PrelaunchEntrySchema.
 */
export type PrelaunchEntry = z.infer<typeof PrelaunchEntrySchema>;

/**
 * Schema for base config overlay in opencode.json.
 * Accepts arbitrary keys since opencode config is flexible.
 */
export const BaseConfigSchema = z.record(z.unknown());

/**
 * Inferred type from BaseConfigSchema.
 */
export type BaseConfig = z.infer<typeof BaseConfigSchema>;

/**
 * Schema for oh-my-openagent plugin configuration.
 * Uses lenient mode to allow unknown agent/category names.
 * This accommodates future additions and deprecated agents.
 */
export const OmoConfigSchema = z
  .object({
    default_model: z.string().optional(),
    agents: z.record(z.string()).optional(),
    categories: z.record(z.string()).optional(),
  })
  .passthrough();

/**
 * Inferred type from OmoConfigSchema.
 */
export type OmoConfig = z.infer<typeof OmoConfigSchema>;

/**
 * Schema for stack manifests.
 * Uses lenient mode to allow extra fields like _comment, metadata, etc.
 * This preserves forward compatibility with future manifest extensions.
 */
export const StackManifestSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    opencode: BaseConfigSchema.optional(),
    omo: OmoConfigSchema.optional(),
    prelaunch: z.array(PrelaunchEntrySchema).optional(),
    env: EnvVarsSchema.optional(),
  })
  .passthrough();

/**
 * Inferred type from StackManifestSchema.
 */
export type StackManifest = z.infer<typeof StackManifestSchema>;

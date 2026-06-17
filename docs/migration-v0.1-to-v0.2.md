# Migrating from OCS v0.1.0 to v0.2.0

This guide covers every breaking change between v0.1.0 and v0.2.0, with concrete before/after examples. Follow the migration steps at the end to update your stacks.

## Breaking Changes

### 1. Schema validation is now enforced

v0.1.0 accepted any JSON as a stack manifest. v0.2.0 validates manifests against a zod schema. The two fields that **must** exist are `name` and `description`.

**Before (v0.1.0):** This loaded without complaint.

```json
{
  "opencode": {
    "model": "openai:gpt-4o"
  }
}
```

**After (v0.2.0):** Same file now fails validation.

```
✗ Stack validation failed for 'my-stack'

Errors (2):
  ✗ Required field 'name' is missing
  ✗ Required field 'description' is missing
```

**Fix:** Add `name` and `description` to every stack manifest.

```json
{
  "name": "my-stack",
  "description": "My custom stack configuration",
  "opencode": {
    "model": "openai:gpt-4o"
  }
}
```

The schema uses lenient mode (`.passthrough()`), so extra fields like `_comment`, `provider`, or any future keys are preserved. Only `name` and `description` are required.

### 2. Error messages are now in English

All CLI output has been translated from Portuguese to English. If you were parsing CLI output in scripts, update your match patterns.

**Before (v0.1.0):**

```
Stack 'my-stack' não existe (stacks/my-stack.json). Use 'ocs list'.
stacks/base.json ausente — rode 'ocs init' para gerá-lo do config atual.
Stack ativa: production
◀ atual
```

**After (v0.2.0):**

```
Stack 'my-stack' does not exist (stacks/my-stack.json). Use 'ocs list'.
stacks/base.json missing — run 'ocs init' to generate it from the current config.
Active stack: production
◀ current
```

**Key string changes:**

| v0.1.0 (Portuguese) | v0.2.0 (English) |
|---|---|
| `não existe` | `does not exist` |
| `ausente` | `missing` |
| `rode` | `run` |
| `Stack ativa` | `Active stack` |
| `atual` | `current` |
| `Resolvendo` | `Resolving` |
| `Nenhuma stack encontrada` | `No stacks found` |
| `comando desconhecido` | `unknown command` |

### 3. Plugin compatibility: OMO schema drift

The oh-my-opencode (OMO) plugin schema has drifted from what v0.1.0 hardcoded. Three new agents were added (`build`, `OpenCode-Builder`, `plan`), one was removed (`llama`), and all 7 category names are now absent from the schema.

**Before (v0.1.0):** OCS hardcoded agent and category lists. Stacks using categories like `visual-engineering` or `ultrabrain` worked because the names were in the hardcoded constant.

**After (v0.2.0):** The OMO schema uses `.passthrough()` mode, which means unknown agent and category names are accepted rather than rejected. Your existing stacks with categories continue to work.

However, if you were relying on OCS to validate that your agent/category names match the OMO plugin's expectations, that validation no longer exists. You can use `ocs validate` to check schema structure, but it won't catch misspelled agent names.

**What to check:** If your stacks reference the removed `llama` agent, update it to one of the new agents:

```json
// Before
"agents": {
  "llama": "openai:gpt-4o-mini"
}

// After — pick the appropriate replacement
"agents": {
  "build": "openai:gpt-4o-mini",
  "plan": "openai:gpt-4o-mini"
}
```

### 4. Environment variable references are stricter

v0.2.0 resolves `$VAR` and `${VAR}` references in the `env` section more carefully. If a referenced variable is not set in your shell environment, it resolves to an empty string (same as v0.1.0), but the schema now validates that `env` values are strings.

**Before (v0.1.0):** Non-string env values were silently accepted.

```json
"env": {
  "DEBUG": true,
  "PORT": 3000
}
```

**After (v0.2.0):** Env values must be strings.

```
✗ Stack validation failed for 'my-stack'

Errors (2):
  ✗ Expected string, received number at env.PORT
  ✗ Expected string, received boolean at env.DEBUG
```

**Fix:** Wrap values in quotes.

```json
"env": {
  "DEBUG": "true",
  "PORT": "3000"
}
```

## New Features in v0.2.0

### `ocs validate <stack>`

Validates a stack manifest against the zod schema and checks for common issues. This is your primary migration tool.

```bash
$ ocs validate my-stack
Validating stack 'my-stack'…

✓ Stack validation passed for 'my-stack'
```

If there are problems:

```bash
$ ocs validate my-stack
Validating stack 'my-stack'…

✗ Stack validation failed for 'my-stack'

Errors (1):
  ✗ Required field 'description' is missing

Warnings (1):
  ⚠ Provider 'openai' has apiKey set to env var reference, but OPENAI_API_KEY is not set [provider.openai]
```

The command exits with code 0 on success, 2 on validation failure.

### `ocs diff <stack1> <stack2>`

Compares two stacks and shows the differences in their resolved configurations.

```bash
$ ocs diff production staging
--- production (resolved)
+++ staging (resolved)
-  model: "openai:gpt-4o"
+  model: "anthropic:claude-sonnet-4-20250514"
-  oracle: "openai:gpt-4o"
+  oracle: "anthropic:claude-sonnet-4-20250514"
```

Exits with 0 if stacks are identical, 1 if they differ.

### Better error messages with "Did you mean?"

When you mistype a stack name or command, OCS now suggests the closest match using Levenshtein distance.

```bash
$ ocs use producton
Error: Stack 'producton' does not exist (stacks/producton.json). Use 'ocs list'.
Hint: run: ocs list
Did you mean: production?
Exit code: 1
```

All typed errors now include a `Hint:` line with an actionable command.

### Retry logic for health checks

Prelaunch health checks (`check.tcp` and `check.url`) now retry with exponential backoff before failing. Default: 3 retries with 100ms base delay (100ms, 200ms, 400ms).

This means prelaunch services that take a moment to start won't immediately fail. If a service still doesn't respond after retries, you get a `HealthCheckTimeoutError` with a hint:

```
Error: Health check timeout: mcp-server (port 3000) did not respond within 30000ms.
Hint: try: ocs doctor
Exit code: 4
```

### Signal handling (SIGINT/SIGTERM)

When you press Ctrl+C while `ocs use` is running, OCS now:

1. Sends SIGTERM to the OpenCode child process
2. Waits up to 5 seconds for graceful shutdown
3. Force-kills with SIGKILL if the child doesn't exit
4. Cleans up signal handlers properly

No more orphaned processes after Ctrl+C.

### Atomic CURRENT_FILE writes

The file that tracks which stack is active (`CURRENT_FILE`) is now written atomically using a temp-file-and-rename pattern. This prevents corrupted state if the process crashes mid-write.

## Migration Steps

### Step 1: Back up your stacks

```bash
cp -r stacks/ stacks-backup/
```

### Step 2: Validate each stack

Run `ocs validate` on every stack to find issues:

```bash
# Check all stacks
for stack in stacks/*.json; do
  name=$(basename "$stack" .json)
  ocs validate "$name"
done
```

### Step 3: Fix validation errors

The most common fix is adding `name` and `description`. Here's a v0.1.0 stack that needs updating:

```json
{
  "_comment": "My production stack",
  "opencode": {
    "model": "openai:gpt-4o",
    "small_model": "openai:gpt-4o-mini"
  },
  "omo": {
    "default_model": "openai:gpt-4o-mini",
    "agents": {
      "oracle": "openai:gpt-4o"
    }
  },
  "provider": {
    "openai": {
      "name": "OpenAI",
      "apiKey": "$OPENAI_API_KEY"
    }
  }
}
```

After adding required fields:

```json
{
  "name": "production",
  "description": "Production stack with GPT-4o for agents",
  "_comment": "My production stack",
  "opencode": {
    "model": "openai:gpt-4o",
    "small_model": "openai:gpt-4o-mini"
  },
  "omo": {
    "default_model": "openai:gpt-4o-mini",
    "agents": {
      "oracle": "openai:gpt-4o"
    }
  },
  "provider": {
    "openai": {
      "name": "OpenAI",
      "apiKey": "$OPENAI_API_KEY"
    }
  }
}
```

Note that `_comment` and `provider` are preserved. The schema uses lenient mode, so extra fields pass validation.

### Step 4: Fix env values

If any stack has non-string values in the `env` section, wrap them in quotes:

```json
// Before
"env": {
  "DEBUG": true,
  "PORT": 3000
}

// After
"env": {
  "DEBUG": "true",
  "PORT": "3000"
}
```

### Step 5: Update agent references

If any stack references the removed `llama` agent, replace it:

```json
// Before
"agents": {
  "llama": "openai:gpt-4o-mini"
}

// After
"agents": {
  "build": "openai:gpt-4o-mini"
}
```

### Step 6: Test with the new version

```bash
ocs use my-stack
```

### Step 7: Verify behavior

Check the resolved configuration matches your expectations:

```bash
ocs show my-stack
```

Compare against your backup if needed:

```bash
ocs diff my-stack my-other-stack
```

### Step 8: Update scripts that parse CLI output

If you have scripts that grep or parse OCS output, update them for the English strings. Key changes:

```bash
# Before (v0.1.0)
ocs current | grep "Stack ativa"

# After (v0.2.0)
ocs current | grep "Active stack"
```

```bash
# Before (v0.1.0)
ocs list | grep "atual"

# After (v0.2.0)
ocs list | grep "current"
```

## Quick Reference: v0.1.0 Stack vs v0.2.0 Schema

The v0.1.0 fixture below works in v0.2.0 without changes because it already has `name` and `description`, and all values are the correct types:

```json
{
  "_comment": "v0.1.0 era stack fixture for migration testing. No secrets included.",
  "name": "v0.1.0-stack",
  "description": "v0.1.0-era stack fixture for testing migration compatibility. Uses placeholder API keys.",
  "opencode": {
    "model": "openai:gpt-4o",
    "small_model": "openai:gpt-4o-mini",
    "agent": "openai:gpt-4o"
  },
  "omo": {
    "default_model": "openai:gpt-4o-mini",
    "agents": {
      "oracle": "openai:gpt-4o",
      "sisyphus": "openai:gpt-4o",
      "hephaestus": "openai:gpt-4o",
      "librarian": "openai:gpt-4o",
      "explore": "openai:gpt-4o-mini",
      "prometheus": "openai:gpt-4o",
      "metis": "openai:gpt-4o",
      "momus": "openai:gpt-4o",
      "multimodal-looker": "openai:gpt-4o",
      "atlas": "openai:gpt-4o-mini"
    },
    "categories": {
      "visual-engineering": "openai:gpt-4o",
      "ultrabrain": "openai:gpt-4o",
      "artistry": "openai:gpt-4o",
      "quick": "openai:gpt-4o-mini",
      "unspecified-low": "openai:gpt-4o-mini",
      "unspecified-high": "openai:gpt-4o",
      "writing": "openai:gpt-4o"
    }
  },
  "provider": {
    "openai": {
      "name": "OpenAI",
      "apiKey": "$OPENAI_API_KEY"
    },
    "openrouter": {
      "name": "OpenRouter",
      "apiKey": "$OPENROUTER_API_KEY"
    },
    "zai": {
      "name": "Z.AI",
      "apiKey": "$ZAI_API_KEY"
    }
  }
}
```

This passes `ocs validate` because:
- `name` and `description` are present (required)
- `opencode`, `omo`, `provider`, `_comment` are accepted (lenient mode)
- All `env` values would be strings (none present in this fixture)
- Agent and category names are accepted (passthrough mode)

## Troubleshooting

### "Required field 'name' is missing"

Add a `name` field to your stack JSON. The name should match the filename (without `.json`).

### "Required field 'description' is missing"

Add a `description` field. A single sentence is fine:

```json
"description": "Production stack with GPT-4o"
```

### "Expected string, received number"

Check your `env` section. All values must be strings:

```json
"env": { "PORT": "3000" }
```

Not:

```json
"env": { "PORT": 3000 }
```

### "Expected string, received boolean"

Same as above. Wrap boolean values in quotes:

```json
"env": { "DEBUG": "true" }
```

### Stack works but `ocs validate` shows warnings

Warnings don't block usage. Common warnings include env var references for keys that aren't set in your current shell. Set the environment variable or ignore the warning if it's intentional.

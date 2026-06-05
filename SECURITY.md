# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability, please send an email to:

📧 security@ocs.dev

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)

We will respond within 48 hours and provide a timeline for the fix.

## Security Best Practices

### For Users

1. **Never commit stacks with secrets** - Use `*.local.json` for private configs
2. **Use environment variables for API keys** - Never hardcode in stack manifests
3. **Review prelaunch commands** - Ensure `start` commands in stacks don't execute untrusted code
4. **Keep dependencies updated** - Run `bun update` regularly
5. **Review manifests** - Inspect stack manifests before running `ocs use <stack>`

### For Developers

1. **Validate all inputs** - Stack manifests should be validated with schemas
2. **Sanitize shell commands** - Avoid `shell: true` when possible; use explicit args
3. **No logging of secrets** - Never log API keys, tokens, or sensitive data
4. **Use secure defaults** - Default configurations should be safe
5. **Dependency scanning** - Regularly audit `package.json` for vulnerabilities

### Known Security Considerations

#### Shell Injection (Medium Risk)

**Location**: `src/prelaunch.ts:61`

```typescript
spawn(entry.start, { shell: true, ... })
```

**Mitigation**:
- This is acceptable because users control their own stack manifests
- Only run stacks you trust or created yourself
- Pre-launch commands are local and user-controlled

#### Unvalidated JSON Input (Low Risk)

**Location**: `src/stacks.ts:43`

```typescript
JSON.parse(readFileSync(path, "utf8"))
```

**Mitigation**:
- Malformed JSON causes runtime error, not security issue
- Future improvement: Add Zod schema validation

#### Environment Variable Exposure (Safe)

**Status**: ✅ No issue

- Environment variables are read but never logged or exposed in generated files
- API keys are handled correctly via environment variables

### Disclosure Policy

1. **Private disclosure** - Report vulnerabilities privately first
2. **Coordinated disclosure** - We will coordinate fix release with reporter
3. **Public disclosure** - Vulnerability details published after fix is deployed
4. **Credit** - Security researchers will be credited in release notes

### Contact

- Security email: security-reports@yourdomain.com
- GitHub: https://github.com/stanl33y/opencode-stack-switcher/security/advisories
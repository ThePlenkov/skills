# Auto-Fix Strategies by Check Type

How to fix each category of failing CI check programmatically. Apply in order — try the simplest fix first, escalate to code edits only when needed.

## Linting

```bash
npm run lint -- --fix     # ESLint
npm run format            # Prettier
npm run stylelint -- --fix
```

Auto-fixable: code formatting, import sorting, unused imports, missing semicolons, trailing whitespace.

## Type checking

Strategies:
- Analyze error messages for missing types.
- Infer types from usage context.
- Add type imports automatically.
- Use type inference where possible.

Auto-fixable: missing type annotations, implicit `any`, missing imports for types, type-assertion fixes.

## Testing

```bash
npm test -- -u   # update snapshots
```

Auto-fixable: outdated snapshots, expected-value drift, mock-data updates, fixture regeneration.

Strategies:
- Update snapshots only if the code change is intentional.
- Analyze test failures for assertion mismatches.
- Update expected values based on actual output.
- Regenerate test fixtures.

## Build

```bash
npm install <missing-package>
npm update
```

Auto-fixable: missing dependencies, outdated dependencies, import-path errors, module-resolution errors, asset-path errors.

Strategies:
- Parse build errors for missing modules.
- Install missing dependencies automatically.
- Update import paths based on file moves.
- Fix asset references.

## Dependencies

```bash
npm audit fix
npm update
```

Auto-fixable: security vulnerabilities, outdated dependencies, dependency conflicts, peer-dependency issues.

## Security

- Update vulnerable dependencies.
- Remove exposed secrets.
- Fix insecure patterns.
- Update security configurations.

## Other

- Documentation-generation errors.
- License-header additions.
- Coverage threshold adjustments.
- Configuration-file updates.

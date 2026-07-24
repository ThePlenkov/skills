# Deployment Strategies

The patterns below sit on top of an automated CI pipeline. They are
recipes; the SKILL body summarises when to reach for each.

## Preview Deployments

Every PR gets a preview deployment for manual testing:

```yaml
# Deploy preview on PR (Vercel/Netlify/etc.)
deploy-preview:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
    - name: Deploy preview
      run: npx vercel --token=${{ secrets.VERCEL_TOKEN }}
```

## Feature Flags

Feature flags decouple deployment from release. Deploy incomplete or risky
features behind flags so you can:

- **Ship code without enabling it.** Merge to main early, enable when ready.
- **Roll back without redeploying.** Disable the flag instead of reverting code.
- **Canary new features.** Enable for 1% of users, then 10%, then 100%.
- **Run A/B tests.** Compare behavior with and without the feature.

```typescript
// Simple feature flag pattern
if (featureFlags.isEnabled('new-checkout-flow', { userId })) {
  return renderNewCheckout();
}
return renderLegacyCheckout();
```

**Flag lifecycle:** Create → Enable for testing → Canary → Full rollout →
Remove the flag and dead code. Flags that live forever become technical debt
— set a cleanup date when you create them.

## Staged Rollouts

```
PR merged to main
    │
    ▼
  Staging deployment (auto)
    │ Manual verification
    ▼
  Production deployment (manual trigger or auto after staging)
    │
    ▼
  Monitor for errors (15-minute window)
    │
    ├── Errors detected → Rollback
    └── Clean → Done
```

## Rollback Plan

Every deployment should be reversible. Pass the user input through
an environment variable instead of interpolating it directly into
the `run` block — direct interpolation is a shell-injection vector
if the input ever carries a `;`, `&&`, or backtick.

```yaml
# Manual rollback workflow
name: Rollback
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback deployment
        env:
          VERSION: ${{ inputs.version }}
        run: |
          # Deploy the specified previous version. The shell
          # substitution uses double quotes so $VERSION is
          # expanded by the shell, not re-interpreted.
          npx vercel rollback "$VERSION"
```

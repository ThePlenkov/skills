# Verification Checklist

After review is complete:

- [ ] All 🔴 Important issues are resolved
- [ ] All required changes are resolved or explicitly
      deferred with justification
- [ ] Tests pass; build succeeds
- [ ] The verification story is documented (what changed, how verified)
- [ ] Dependency upgrades reviewed against changelog, isolated per
      package, verified by a green suite, lockfile diff reviewed

**Presumptive blockers** (surface and propose the simpler design;
escalate to Required only when the change actively makes structure
worse): a refactor that relocates complexity instead of reducing it; a
change that pushes a file past the size boundary with no
decomposition; feature logic added to a shared module; a near-duplicate
of an existing canonical helper; a silent fallback that hides an
unclear invariant.

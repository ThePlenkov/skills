# GitLab CI/CD Patterns

## `spec:inputs` with `parallel: matrix` in Included Files

**Problem:** You want to use `parallel: matrix` in an included CI file, but the matrix values come from the main pipeline inputs.
**Solution:** You MUST define `spec:inputs` in the included file and pass the values explicitly from the parent include.

**Pattern:**

**1. Child Pipeline (`child.yml`):**
Define the input type and use it in the matrix.
```yaml
spec:
  inputs:
    variants:
      type: array
      default: []
---
job_matrix:
  parallel:
    matrix:
      - VARIANT: $[[ inputs.variants ]]
  script:
    - echo "Running variant $VARIANT"
```

**2. Parent Pipeline (`.gitlab-ci.yml`):**
Pass the input from the parent to the child.
```yaml
spec:
  inputs:
    variants:
      type: array
      default: []
---
include:
  - local: 'child.yml'
    inputs:
      variants: $[[ inputs.variants ]]
```

**Why:** `parallel: matrix` requires the input to be available in the local file's scope. Passing it via `include:inputs` bridges the gap.

## Global Variables vs Job Variables with Inputs

**Rule:** `spec:inputs` can be used in the global `variables` section of the entry pipeline (e.g., `.gitlab-ci.yml`), but NOT in the global `variables` of an included file if you want them to be dynamic based on the include.

**Pattern:**
```yaml
# .gitlab-ci.yml
variables:
  GLOBAL_VAR: $[[ inputs.my_input ]]  # ✅ Works in entry file
```

For included files, prefer passing values via `inputs` and using them locally, or relying on global variables inherited from the entry file.

## Monitoring Matrix Pipelines

Use `glab ci status --live` to watch pipeline execution in real-time. Useful for verifying that `parallel: matrix` jobs spawn correctly.

```bash
glab ci status --live -b <branch>
```

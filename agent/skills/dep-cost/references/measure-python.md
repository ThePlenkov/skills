# Measure Dep Cost — Python

<!-- os-independence-exempt: intentional POSIX bash recipes; on Windows run under Git Bash or WSL -->

Concrete commands for measuring a Python dependency's cost. Use this reference when running `dep-cost` for a Python project.

## What to measure

| Metric | Tool | What it tells you |
|---|---|---|
| Install size | `pip show <pkg>` | Onboarding pain, image size |
| Import time | `python -X importtime` | Startup cost, CLI tool responsiveness |
| Dep tree | `pipdeptree` | Transitive cost |
| Used surface | `rg` + manual | How much of the API you use |
| Vulnerabilities | `pip-audit` | Security cost |
| Unused deps | `pydeps` + `vulture` | Dead weight in requirements.txt |

## Install size

```bash
# Single package
pip show <pkg>
# Output includes: Version, Location, Requires
# Size: not shown directly; calculate:
du -sh $(python -c "import <pkg>; print(<pkg>.__path__[0])")

# All packages
pip list --format=columns
# Better: pip-chill or pip-review
```

## Import time (startup cost)

```bash
# Single import
python -X importtime -c "import <pkg>" 2>&1 | tail -20
# Cumulative time at the bottom: total import cost in seconds

# For a CLI tool, this is user-visible startup latency
python -X importtime -c "from myapp.cli import main" 2>&1 | tail -20
# If myapp pulls pandas and you don't use it for `myapp hello world`, that's wasted time
```

## Dep tree

```bash
pip install pipdeptree
pipdeptree -p <pkg>
# Reverse: who depends on this?
pipdeptree -r -p <pkg>
```

## Used surface

```bash
# What do we import from this package?
rg "^(from|import) <pkg>" -t py --no-filename | sort -u

# What attributes do we use?
rg "<pkg>\.\w+" -t py --no-filename | sort -u
# Then count distinct attributes: this is your used surface

# Example: for pandas, you might use .DataFrame, .read_csv, .concat
# Out of hundreds of public attributes → small surface
```

## Vulnerabilities

```bash
pip install pip-audit
pip-audit
# Lists CVEs per installed package with severity
```

## Unused dependencies

```bash
# Install and run
pip install pydeps vulture
vulture your_project/  # shows dead code, including unused imports
# Cross-reference with requirements.txt

# Or: pip-chill (only lists packages that are actually imported)
pip install pip-chill
pip-chill | diff - <(cat requirements.txt)
```

## Container / image size

If the project ships as a Docker image, the dep cost includes the image size:

```bash
# Before adding the dep
docker images myapp:latest --format "{{.Size}}"

# Install the dep, rebuild, compare
docker images myapp:latest --format "{{.Size}}"
```

A 200KB dep can become 50MB in a Python image due to compiled extensions, transitive C libs, etc. Measure on the actual artifact.

## Common gotchas

1. **Compiled extensions (C/C++/Rust).** numpy, pandas, scipy, cryptography — these compile and add tens of MB to the image, even if the Python wrapper is small.
2. **Optional dependencies.** pandas has `[all]` extra that pulls many sub-deps. Check what you actually need: `pip install pandas` vs `pip install pandas[all]`.
3. **Lazy imports.** Some packages lazy-import heavy submodules. `import requests` is fast even though urllib3 is huge. The `-X importtime` output shows the full chain.
4. **Type stubs.** `types-*` packages have no runtime cost. They're free.
5. **Platform-specific.** A dep may be small on Linux but large on Windows due to platform wheels. Check `pip download <pkg> --dest /tmp/wheels` for the actual wheel sizes.
6. **Lock files.** Poetry's `poetry.lock` and pip's `requirements.txt` should reflect actual usage. Stale entries (deps that were once needed but aren't anymore) are common.
7. **Entry points.** A dep with console_scripts entry points may install extra files. Check `console_scripts` in the installed `.dist-info/entry_points.txt`.

## Worked example: is `pandas` worth it?

```bash
# Step 1: what do we use?
rg "^(from|import) pandas" -t py --no-filename | sort -u
# → only `import pandas as pd`

rg "pd\.\w+" -t py --no-filename -o | sort -u
# → pd.read_csv, pd.DataFrame, pd.concat, pd.to_datetime
# Used surface: 4 attributes out of hundreds

# Step 2: install size
du -sh $(python -c "import pandas; print(pandas.__path__[0])")
# → 84MB (with C extensions)

# Step 3: import time
python -X importtime -c "import pandas" 2>&1 | tail -3
# → import time: 0.8s
# For a CLI tool that runs once and exits, 0.8s of wasted startup is significant

# Step 4: reimplement cost
# read_csv → ~30 LOC with the csv module
# DataFrame → 200+ LOC of tricky code (indexing, dtypes, NaN handling)
# to_datetime → ~20 LOC
# concat → ~30 LOC
# Total: 280 LOC, with subtle correctness traps (NaN, dtypes, timezones)

# Decision: keep pandas. The 4 functions used are NOT trivial to reimplement
# correctly. The 84MB cost is real but the reimplementation risk is higher.
# Document: "Keeping pandas despite 84MB install because 3 of 4 used functions
# have non-trivial correctness (DataFrame indexing, NaN handling, datetime
# parsing). Reimplementation would be 280+ LOC and likely produce subtle bugs."
```

## When to keep the dep anyway

- Used surface > 40% of the dep's API
- Dep has C extensions and is performance-sensitive (`numpy`, `pandas`, `scipy`)
- Dep is security/correctness critical (`cryptography`, `pyjwt`, `passlib`)
- Dep is the de facto standard for the domain (`requests`, `flask`, `django`)
- The dep is a devDep (test/lint tooling) and the cost is irrelevant

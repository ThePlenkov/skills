# Measure Dep Cost — Go

<!-- os-independence-exempt: intentional POSIX bash recipes; on Windows run under Git Bash or WSL -->

Concrete commands for measuring a Go module's cost. Use this reference when running `dep-cost` for a Go project.

## What to measure

| Metric | Tool | What it tells you |
|---|---|---|
| Binary bloat | `bloat` from golang.org/x/perf | What each package contributes to the final binary |
| Dep graph | `go mod graph` | Full dependency tree |
| Why a dep exists | `go mod why -m <pkg>` | Who pulls it in (often indirect) |
| Module size on disk | `du -sh` on the module dir | Install cost |
| Used surface | `rg` + `go list` | How much of the API you use |
| Vulnerabilities | `govulncheck` | Security cost |
| Build time per dep | `go build -x` | CI cost |

## Binary bloat (most important for Go)

Go compiles everything you import into the binary. A 50KB package can add 500KB to your binary.

```bash
# Install bloat (one-time)
go install golang.org/x/perf/cmd/bloat@latest

# Build with debug info, then analyze
go build -o myapp -gcflags="-N -l" .
bloat myapp
# Output: per-package size contribution, sorted descending
```

For a more readable view:

```bash
go build -o myapp .
nm -S --size-sort myapp | tail -50
# Or for a high-level view by package:
go tool nm -size myapp | awk '{print $NF}' | grep -E '\.go$' | sort | uniq -c | sort -rn | head
```

## Why is this dep here?

```bash
go mod why -m <pkg>
# Output: traces the import chain from your package to the dep
# Example: "yourpackage imports gopkg.in/yaml.v3, which is needed by github.com/foo/bar"
```

If the dep is only used in one place, you can probably replace it.

## Module graph

```bash
# Full dep graph
go mod graph

# Reverse: who depends on X?
go mod graph | grep '^<pkg>\s'
# Or: go mod why -m -vendor <pkg> (if using vendor)
```

## Module size

```bash
# Find module dir
go list -m -f '{{.Dir}}' <pkg>
du -sh $(go list -m -f '{{.Dir}}' <pkg>)
```

## Used surface

```bash
# What do we import from this package?
rg '"<pkg>' -t go --no-filename | sort -u

# What functions do we call?
rg '<pkg>\.\w+' -t go --no-filename -o | sort -u
# Then count distinct identifiers
```

For a package like `github.com/spf13/cobra`, you might use only `cobra.Command` and `cobra.ExactArgs` — out of dozens of exported types.

## Vulnerabilities

```bash
# Install govulncheck
go install golang.org/x/vuln/cmd/govulncheck@latest

# Run
govulncheck ./...
# Output: known CVEs in your deps, by call site
```

## Build cost

```bash
# Time per package
go clean -cache
go build -o /dev/null ./... 2>&1
# Add -x to see actual commands
go build -x -o /dev/null ./... 2>&1 | grep -E '\.go$' | head -20
```

For CI cost, `go test -bench=.` and the test binary size are also relevant.

## Common gotchas

1. **Indirect deps are real.** `go mod tidy` will show indirect deps. They are real cost; you can't ignore them.
2. **`go.sum` doesn't reflect what's actually imported.** Only `go mod why -m` shows the actual chain.
3. **Build tags.** Some packages are conditionally compiled. `bloat` may under-report if a tag is missing.
4. **Vendoring.** If you vendor, `du -sh vendor/` is the literal install cost. If not, the `go mod download` cache is the cost (smaller, but it's a network hit per CI run).
5. **Cgo.** Deps with cgo pull in C libs, increasing binary size and adding C toolchain to builds. `go list -deps -f '{{if .CgoFiles}}{{.ImportPath}}{{end}}' ./...` shows cgo-using deps.
6. **Test deps.** `go list -deps ./...` includes test deps; `go list -deps -test ./...` is closer to the actual binary cost for the test binary.
7. **`go mod tidy` can change the graph.** Run it before measuring, or your numbers will be off.

## Worked example: is `github.com/spf13/cobra` worth it?

```bash
# Step 1: used surface
rg '"github.com/spf13/cobra"' -t go --no-filename | sort -u
# → only the main entry point

rg 'cobra\.\w+' -t go --no-filename -o | sort -u
# → cobra.Command, cobra.ExactArgs, cobra.MaximumNArgs
# 3 symbols out of dozens

# Step 2: binary bloat
go install golang.org/x/perf/cmd/bloat@latest
go build -o myapp .
bloat myapp | grep cobra
# → cobra contributes 1.2MB to the 8MB binary

# Step 3: reimplement cost
# A minimal CLI with arg parsing, help text, and version is ~150 LOC of stdlib
# (flag package) + boilerplate

# Decision: borderline. For a single CLI tool, stdlib flag is enough.
# For a multi-command app (kubectl-style), cobra is the boring choice.
# Document: "Keeping cobra. We have 6 subcommands with shared flag parsing;
# reimplementing with stdlib flag would be 200+ LOC of boilerplate per command.
# Bloat cost (1.2MB) is acceptable for the maintainability gain."
```

## When to keep the dep anyway

- Used surface > 50% of the dep's API (Go APIs are usually small, so this is common)
- Dep is a stdlib-adjacent tool (`gopkg.in/yaml.v3` for YAML, `github.com/stretchr/testify` for tests)
- Dep provides type-safe wrappers around stdlib (`sqlx`, `gorm`, `cobra`)
- Dep is security-critical (`golang.org/x/crypto`, `github.com/golang-jwt/jwt`)
- Reimplementation would replicate non-trivial protocol/spec logic (`net/http` for HTTP, `encoding/json` for JSON)

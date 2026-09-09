# Measure Dep Cost — Rust

<!-- os-independence-exempt: intentional POSIX bash recipes; on Windows run under Git Bash or WSL -->

Concrete commands for measuring a Rust crate's cost. Use this reference when running `dep-cost` for a Rust project.

## What to measure

| Metric | Tool | What it tells you |
|---|---|---|
| Compile time per dep | `cargo +nightly build -Z timings` | CI cost, dev iteration time |
| Binary bloat | `cargo bloat` | What each crate contributes to the binary |
| Dep tree | `cargo tree` | Transitive cost |
| Why a dep exists | `cargo tree -i <crate>` | Who pulls it in |
| Used surface | `rg` | How much of the API you use |
| Unused deps | `cargo udeps` | Dead weight in Cargo.toml |
| Vulnerabilities | `cargo audit` | Security cost |
| Build artifact size | `du -sh target/release/myapp` | Ship cost |

## Compile time (often the real cost in Rust)

```bash
# One-time: requires nightly
rustup install nightly

# Generate timing report
cargo +nightly build -Z timings -o /tmp/myapp
# Creates target/.rustc_info.json and target/cargo-timings/ with HTML + JSON reports

# Or simpler: just use the cargo build output
cargo clean
cargo build 2>&1 | tail -20
# Note: this gives total time, not per-dep
```

For per-dep timing, the `-Z timings` JSON is the source of truth. Open `target/cargo-timings/cargo-timing-*.html` in a browser for a visual graph.

## Binary bloat

```bash
# Install
cargo install cargo-bloat --locked

# Per-crate contribution
cargo bloat --release -n 30
# Top 30 crates by binary size

# Per-function
cargo bloat --release --crates -n 30
# Top 30 functions, grouped by crate
```

This is the equivalent of Go's `bloat` command and gives the real "what does this cost in the final binary" answer.

## Dep tree

```bash
# Full tree
cargo tree

# Reverse: who depends on this?
cargo tree -i <crate>
# Example: cargo tree -i tokio → shows every crate that brings in tokio

# With duplicates
cargo tree -d
# Lists duplicates in the tree (often a sign of version drift)
```

## Used surface

```bash
# What do we import?
rg 'use <crate>::' -t rust --no-filename | sort -u

# What specific items?
rg '<crate>::\w+' -t rust --no-filename -o | sort -u
# Then count distinct identifiers: this is your used surface
```

Example: for `serde`, you might use `Serialize`, `Deserialize`, `serde_json::to_string`, `serde_json::from_str` — out of dozens of public items.

## Unused dependencies

```bash
# Install
cargo install cargo-udeps --locked
# Requires nightly
cargo +nightly udeps
# Lists deps in Cargo.toml that are never actually used in the source
```

## Vulnerabilities

```bash
# Install
cargo install cargo-audit --locked

# Run
cargo audit
# Output: known CVEs in your Cargo.lock, by crate
```

## Build artifact size

```bash
# Release binary
cargo build --release
du -sh target/release/myapp
ls -lh target/release/myapp

# Strip symbols for the actual ship size
strip target/release/myapp
du -sh target/release/myapp
```

A debug build (`cargo build`) is much larger than release. Always measure release for ship cost.

## Common gotchas

1. **Compile time is the real cost in Rust.** A 1MB dep that adds 5 minutes to CI is a bigger deal than 50MB in the binary.
2. **Feature flags.** A crate's binary cost depends on which features you enable. `cargo bloat` shows what was actually compiled in. `cargo tree -e features` shows the feature graph.
3. **dev-dependencies don't ship.** They affect compile time but not binary size. Different metric, different cost analysis.
4. **build-dependencies.** `build = "..."` in Cargo.toml pulls deps at build script time. These can be huge (`bindgen`, `tonic-build`, `prost-build`).
5. **Procedural macros.** `proc-macro = true` crates are compiled twice (once for the macro, once for use). They can dominate dev compile time.
6. **`[patch]` and `[replace]` sections.** These swap crates in your tree; cargo tree shows the original, not the replaced. Use `cargo tree -e features --target=all` to see the full picture.
7. **LTO and codegen units.** Release builds with `lto = true` and `codegen-units = 1` are smaller but take much longer to compile. The bloat number is the post-LTO number.

## Worked example: is `tokio` worth it?

```bash
# Step 1: used surface
rg 'use tokio::' -t rust --no-filename | sort -u
# → tokio::main, tokio::spawn, tokio::time::sleep, tokio::sync::mpsc, tokio::net::TcpListener
# 5 modules out of dozens

# Step 2: compile time
cargo +nightly clean
cargo +nightly build -Z timings 2>&1 | tail -5
# → total: 1m 47s
# Open HTML report; tokio and its deps (mio, bytes, etc.) account for ~50s

# Step 3: binary bloat
cargo bloat --release --crates -n 20
# → tokio contributes 1.8MB to the 5.2MB binary

# Step 4: reimplement cost
# A minimal async runtime for our 5 use cases would be 2000+ LOC
# of unsafe code or pull in a smaller runtime (smol, async-std) anyway
# Net: no real saving

# Decision: keep tokio. It's the boring choice. Reimplementing async is
# not worth the risk; tokio IS the Rust async ecosystem.
# Document: "Keeping tokio. 1.8MB binary cost and 50s compile cost are real
# but reimplementing async I/O is not viable. tokio is the de facto standard;
# any replacement would also be a multi-MB dep."
```

## When to keep the dep anyway

- Used surface > 50% of the crate's API
- Crate is the de facto standard (`serde`, `tokio`, `reqwest`, `clap`)
- Crate provides type-safe wrappers around lower-level functionality
- Crate is security/correctness critical (`ring`, `rustls`, `aes-gcm`)
- Reimplementation would replicate non-trivial protocol/spec logic
- Crate is a dev-dependency and the cost is irrelevant for prod

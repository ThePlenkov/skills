---
name: performance-investigation
description: 'Use when an agent must analyze a reported or suspected performance problem — slow requests, memory growth, high CPU, long build/test/runtime, query latency, contention, or regressions. Pairs with $skill{debugging} (correctness-first): this skill is for "too slow / too big / too many" symptoms, not "wrong output." Pairs with $skill{architecture-review} (structural reasons) by isolating one symptom down to a measurable fix.'
allowed-tools: read, grep, glob, exec
argument-hint: <symptom, target workload, expected vs actual numbers>
triggers:
  - user
  - model
---

# Performance Investigation

Goal: turn a "feels slow / heavy / many" complaint into a measured bottleneck and a verified before/after improvement.

Use this skill when:

- a user or monitoring system reports slowness
- a previously fast operation became slow (regression)
- a process uses too much memory or CPU
- a database query or API call takes too long
- a batch job, build, or test suite exceeds a time budget
- throughput drops under load

Do not use this skill when:

- the symptom is wrong output (use $skill{debugging})
- no measurement exists and the complaint is only "feels slow" (start with measurement)
- the request is for a structural redesign (use $skill{architecture-review})
- the request is for a one-line optimization on a known hotspot (use $skill{one-shot-patch})

## Investigation Procedure

### 1. Define the SLO

Before measurement, agree on:

- operation (which API, query, command)
- workload (volume, concurrency, data size)
- target (e.g. p95 < 300ms, RSS < 512MB, build < 2min)
- environment (hardware, network, data volume, cache state)

Without an SLO the investigation will never finish.

### 2. Capture a baseline (the "before")

Requirements for a baseline run:

- cold-cache or warm-cache state is declared
- input size matches the workload
- run multiple iterations (≥5) and report a distribution, not one number
- capture: wall time, CPU time, RSS/heap, I/O bytes, network bytes, DB rows scanned/returned
- pin environment: same machine, same config, same data shape

Record the baseline numbers. Write them down before attempting any change.

### 3. Form a hypothesis, not a guess

From the baseline, derive ranked hypotheses:

- I/O bound (disk, network, DB)
- CPU bound (compute-heavy loop, regex, serialization)
- memory bound (allocation rate, GC pressure, leaks)
- contention (locks, queues, single-threaded serialization)
- algorithmic complexity (O(n²) in disguise)
- data shape (skewed distribution, missing index, big payload)

For each, predict the observable signal:

- I/O bound → high iowait / low CPU on hot thread
- CPU bound → high CPU on one core, low I/O
- memory bound → RSS grows, GC pauses or swap
- contention → many threads waiting, low CPU utilization
- algorithmic → time grows faster than input size

### 4. Profile — pick one tool, narrow the lens

Tools by layer; pick the narrowest that answers the question:

- runtime profilers: `perf`, `py-spy`, `async-profiler` (JVM), `pyroscope`, `pprof` (Go), `flamegraph`
- language-level: tracing, span timings, span counters
- DB: `EXPLAIN ANALYZE`, `pg_stat_statements`, slow query log, query store
- system: `vmstat`, `iostat`, `pidstat`, `top`, `htop`, `bpftrace`
- network: `tcpdump`, `wrk`, `k6`, `vegeta`, `ab`
- build: `--timings`, `--profile`, language build flags
- test: `pytest --durations`, `go test -v`, `vitest --reporter=verbose`

Always:

- prefer sampling profiles over instrumentation for system-wide views
- prefer query plans over guessing for DB hotspots
- record the artifact (flamegraph.svg, query-plan.txt) into the work product

Never:

- optimize without a profile
- trust a single profile (run twice)
- optimize based on anecdote or intuition

### 5. Query and data-shape analysis

For DB and external-system hotspots:

1. Pull the slow query from logs or store.
2. Run `EXPLAIN` (or equivalent) on the production-shaped data, not a tiny test table.
3. Note the plan: index used, join order, rows scanned, rows returned, sort nodes.
4. Compare actual rows vs estimated rows — large gaps mean stale stats or wrong cardinality.
5. Confirm the access pattern against existing indexes.
6. Look for N+1 queries: count queries per request.
7. Look for unbounded SELECTs, missing `LIMIT`, missing projection (selecting full rows when one column suffices).

### 6. Memory and CPU bottleneck identification

CPU:

- top N functions by self time
- top N functions by total (inclusive) time
- look for known offenders: regex compilation in loops, JSON parse per call, repeated allocations

Memory:

- allocation rate per second
- peak working set vs steady state
- leak detectors: compare RSS / heap across two snapshots after a stable workload
- object retention: heap dump (JVM), tracemalloc (Python), pprof heap (Go), heap snapshot (Node)

Contention:

- lock contention graphs, queue depths, waiting threads
- single-threaded sections under load
- blocking I/O inside async loops

### 7. Before/after benchmarking

Once a fix is applied:

1. Re-run the exact same benchmark as the baseline.
2. Confirm numbers improved on the same machine, same input, same iterations.
3. Report before vs after with distribution (median, p95, max).
4. Note what was NOT measured and could still bite (e.g. memory after 24h, behavior under sustained load).
5. Apply $skill{evidence} to record the runs.

### 8. Verify no regression in unrelated dimensions

Performance fixes often trade off:

- code clarity
- memory vs time
- write amplification vs read amplification
- cold latency vs steady-state latency

Add or run the relevant unit/integration test to make sure correctness and key invariants still hold.

## Common Pitfalls

- Optimizing the wrong layer (e.g. micro-optimizing the JSON encoder when 90% of the time is network).
- Treating p50 as p95. Use the right percentile.
- Benchmarking the warm cache while users always face the cold cache.
- Optimizing without warmed-up JIT.
- Adding caches that thrash, leak, or mask a deeper data-shape bug.
- Fixing the regression to "match before" without understanding why "before" was bad.
- "Just add an index" — verify the query plan actually uses it.
- Skipping tail latency to chase average latency.

## Required output

Symptom and SLO: ...
Baseline (before): [median, p95, max, RSS, allocations, etc.]
Hypothesis and discriminating measurement: ...
Profile evidence: <file or artifact>
Root cause: ...
Change made: ...
After: [median, p95, max, RSS, allocations, etc.]
Improvement: ...
Trade-offs and risks: ...
Verification (correctness): ...
What was NOT measured: ...

## Stop conditions

Stop and report blocked if:

- the SLO is undefined and a number cannot be agreed
- the workload cannot be reproduced (no data, no access)
- profiling requires instrumentation that breaks SLA in production
- the bottleneck is in a third-party service with no observable metrics

## Related skills

- $skill{debugging} — switch when the issue is wrong output, not slow output.
- $skill{architecture-review} — switch when the cause is structural (sync-IO-everywhere, N+1 by design).
- $skill{investigate-first} — narrow data-gathering before measurement.
- $skill{one-shot-patch} — apply known micro-fixes after the bottleneck is located.
- $skill{evidence} — record benchmark artifacts and the runs that prove the fix.

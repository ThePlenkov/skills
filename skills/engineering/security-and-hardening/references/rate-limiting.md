# Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// IMPORTANT: a multi-worker / multi-replica deployment cannot
// rely on the default in-memory store — each process keeps its
// own counter, so the effective limit per user is roughly
// (workers × max). Use a shared store (Redis, Memcached, etc.)
// so the budget is enforced globally. Production: always set
// a shared store.

// IMPORTANT (2): when stacking multiple limiters on the same
// request (e.g. `/api/` and `/api/auth/`), the same request is
// counted against BOTH limiters, which (a) double-charges the
// user for one request and (b) is a real bug if the limiters
// share a key prefix, because they then compete for the same
// counter and the auth budget gets eaten by ordinary API
// traffic. The fix is to give each limiter its own key prefix
// so they track independent counters. The `keyGenerator` is
// called per limiter, so by default the key is the same across
// limiters; use a per-limiter prefix instead.
//
// For the `keyGenerator`, use the library's `ipKeyGenerator`
// helper (NOT bare `req.ip`) so that IPv6 clients are
// normalized to the configured /64 subnet. Bare `req.ip` lets
// a single IPv6 host rotate through its /64 and bypass the
// per-IP limit; `ipKeyGenerator` applies the subnet mask the
// library already ships, so the same Redis counter is shared
// across the routable range and the per-limiter prefix keeps
// the auth and API counters independent.

// General API rate limit (100 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 64,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:api:',  // distinct from the auth prefix below
  }),
  keyGenerator: (req /*, res */) => ipKeyGenerator(req.ip),
});
app.use('/api/', apiLimiter);

// Stricter limit for auth endpoints (10 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 64,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth:',  // independent counter
  }),
  keyGenerator: (req /*, res */) => ipKeyGenerator(req.ip),
});
app.use('/api/auth/', authLimiter);
```

The pattern: tier by surface. Public read endpoints get the highest
budget; auth and write endpoints get the lowest. The
`standardHeaders: true` option puts the rate-limit info in
`RateLimit-*` response headers so clients can self-throttle.

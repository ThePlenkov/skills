# Authentication and environment variables

`src` resolves credentials from the environment and local state.
The resolution order is: `SRC_ACCESS_TOKEN` (PAT) → OAuth token
(from `src login`) → require `src login`.

## Variables

| Variable | Format | Notes |
|---|---|---|
| `SRC_ENDPOINT` | **Full URL with scheme**, e.g. `https://sourcegraph.example.com`. No trailing slash. | Base URL of the instance. Defaults to `https://sourcegraph.com` if unset. |
| `SRC_ACCESS_TOKEN` | Personal access token string | Used for non-interactive workflows (CI, scripts). **Takes precedence** over OAuth tokens. |
| `SRC_HEADER_{NAME}` | `SRC_HEADER_AUTHORIZATION=...` becomes request header `Authorization: ...` | Used for proxy auth and per-request header injection. The `SRC_HEADER_` prefix is stripped. |
| `SRC_HEADERS` | Newline-separated `Name: Value` pairs | For headers with dashes in the name or multiple values. |

For both `SRC_ENDPOINT` and `SRC_HEADERS`, **never prepend `https://`**
to a value that already has the scheme — produces
`https://https://...`. Apply the rule consistently across every
URL template in this skill.

## `SRC_ACCESS_TOKEN` vs `SRC_HEADER_AUTHORIZATION` — mutually exclusive

Setting both errors out at config read with:

```
reading config: when passing an 'Authorization' additional headers, SRC_ACCESS_TOKEN must never be set
```

The two patterns serve different token types:

- **`SRC_ACCESS_TOKEN=<token>`** — for Sourcegraph PATs
  (created via the Sourcegraph web UI; no prefix).
- **`SRC_HEADER_AUTHORIZATION=token <token>`** — for tokens that
  must be wrapped in the `token` prefix (some corporate setups
  and `sgp_` session tokens on `sourcegraph.com`).

If you have a `sgp_…` token from
`https://sourcegraph.com/users/<you>/settings/tokens`, use
`SRC_HEADER_AUTHORIZATION="token $TOKEN"`. If you have a self-hosted
PAT with no prefix, use `SRC_ACCESS_TOKEN`.

**Heuristic**: if the token starts with `sgp_`, use
`SRC_HEADER_AUTHORIZATION=token $TOKEN`. Otherwise, use
`SRC_ACCESS_TOKEN=$TOKEN`.

## Reusing credentials in scripts

The canonical way to forward auth to `curl` or other tools:

```sh
# Raw token value
src auth token

# Full Authorization header, e.g. "Authorization: token <pat>"
src auth token --header
```

For curl calls in CI / scripts, prefer `src auth token --header` over
hardcoding the token in the script.

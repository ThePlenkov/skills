# Install + auth setup for `src` CLI

## Install

The `src` CLI is the primary path for any code-search workflow.
Install in the order shown — try the most portable first.

### Option 1 — standalone binary (most portable, no admin)

Direct download from GitHub releases. Works on any Linux/macOS
sandbox without `brew` or `apt`.

```sh
# Detect latest version and OS/arch (cross-platform via Python)
VER=$(curl -fsSL https://api.github.com/repos/sourcegraph/src-cli/releases/latest \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])")
OS_ARCH=$(python3 -c "import platform, sys; m={'x86_64':'amd64','aarch64':'arm64','arm64':'arm64'}; s=sys.platform; os={'linux':'linux','darwin':'darwin','win32':'windows'}.get(s,s); print(f'{os}_{m.get(platform.machine().lower(), platform.machine())}')")
BIN_EXT=""
case "$OS_ARCH" in windows*) BIN_EXT=".exe" ;; esac
URL="https://github.com/sourcegraph/src-cli/releases/download/${VER}/src_${OS_ARCH}${BIN_EXT}"
CHECKSUM_URL="https://github.com/sourcegraph/src-cli/releases/download/${VER}/src-cli_${VER#v}_checksums.txt"
INSTALL_DIR="${SRC_INSTALL_DIR:-.tools}"
BIN_NAME="src${BIN_EXT}"
export VER OS_ARCH URL CHECKSUM_URL INSTALL_DIR BIN_NAME
python3 - <<'PY'
import hashlib, os, stat, sys, urllib.request

install_dir = os.environ['INSTALL_DIR']
bin_name = os.environ['BIN_NAME']
bin_path = os.path.join(install_dir, bin_name)
os.makedirs(install_dir, exist_ok=True)

urllib.request.urlretrieve(os.environ['URL'], bin_path)

checksum_url = os.environ['CHECKSUM_URL']
os_arch = os.environ['OS_ARCH']
expected = None
try:
    with urllib.request.urlopen(checksum_url) as r:
        for line in r.read().decode('utf-8').splitlines():
            parts = line.strip().split()
            filename = f'src_{os_arch}{".exe" if os_arch.startswith("windows") else ""}'
            if len(parts) >= 2 and parts[1] == filename:
                expected = parts[0]
                break
except Exception as e:
    print('warn: could not fetch checksum:', e, file=sys.stderr)

if expected is None:
    print('error: no matching checksum found', file=sys.stderr)
    sys.exit(1)

with open(bin_path, 'rb') as f:
    actual = hashlib.sha256(f.read()).hexdigest()
if actual.lower() != expected.lower():
    print('error: checksum mismatch', file=sys.stderr)
    sys.exit(1)
print('checksum verified')

st = os.stat(bin_path)
os.chmod(bin_path, st.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
PY
```

(Project-relative `.tools/` is preferred over `/usr/local/bin` for
non-root environments. Add `$INSTALL_DIR` to `PATH` if desired.)

### Option 2 — `brew` (macOS, with Homebrew)

```sh
brew install sourcegraph/src-cli/src-cli
```

### Option 3 — official install script

```sh
curl -fsSL -o install-src.sh https://raw.githubusercontent.com/sourcegraph/src-cli/main/install.sh
# review install-src.sh, then execute
sh install-src.sh
```

In restricted sandboxes this often fails with no network access to
`raw.githubusercontent.com`. Prefer Option 1 in CI/sandboxes.

## Verify

```sh
INSTALL_DIR="${SRC_INSTALL_DIR:-.tools}"
BIN="$INSTALL_DIR/src"
if [ -f "$BIN.exe" ]; then BIN="$BIN.exe"; fi
"$BIN" version    # should print e.g. "Current version: 7.5.0"
```

## Auth setup

For a `sgp_` token from `https://sourcegraph.com/users/<you>/settings/tokens`:

```sh
export SRC_ENDPOINT="https://sourcegraph.com"
export SRC_HEADER_AUTHORIZATION="token ${SOURCEGRAPH_API_TOKEN}"
```

For a self-hosted PAT with no prefix:

```sh
export SRC_ENDPOINT="https://sourcegraph.example.com"
export SRC_ACCESS_TOKEN="${YOUR_PAT}"
```

**Never set both** `SRC_ACCESS_TOKEN` and
`SRC_HEADER_AUTHORIZATION` — the CLI errors out at config
read. See [`auth.md`](auth.md) for the full rule and the
token-type heuristic.

## Smoke test

Run a real search to confirm the auth works. Should return
real MCP-server repos:

```sh
INSTALL_DIR="${SRC_INSTALL_DIR:-.tools}"
export PATH="$INSTALL_DIR:$PATH"
src search -json 'select:repo repo:has.topic(mcp-server) count:5'
```

If you get a 401, double-check the env var name and the token
prefix. See [`auth.md`](auth.md) for the canonical auth
troubleshooting.

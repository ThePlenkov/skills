#!/usr/bin/env bash
set -euo pipefail

# Fetch the Devin CLI manifest, verify checksum, and install the binary.

ARCH=$(uname -m)
SYS=$(uname -s | tr '[:upper:]' '[:lower:]')

case "${ARCH}:${SYS}" in
  x86_64:linux)
    TARGET="x86_64-unknown-linux"
    ;;
  aarch64:linux)
    TARGET="aarch64-unknown-linux"
    ;;
  *)
    echo "Unsupported platform: ${SYS}/${ARCH}" >&2
    exit 1
    ;;
esac

# Pin to the version declared in agent.json so the base image does not drift
# from the ACP registry entry.
DEVIN_VERSION="${DEVIN_VERSION:-3000.1.27}"
MANIFEST_URL="${DEVIN_MANIFEST_URL:-https://static.devin.ai/cli/${DEVIN_VERSION}/manifest.json}"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

INFO=$(python3 - "$MANIFEST_URL" "$TARGET" <<'PY'
import json, sys, urllib.request, urllib.error
manifest_url, target = sys.argv[1:3]
try:
    with urllib.request.urlopen(manifest_url, timeout=30) as r:
        manifest = json.loads(r.read())
except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
    print(f"error: could not fetch/parse manifest {manifest_url}: {exc}", file=sys.stderr)
    sys.exit(1)

if not isinstance(manifest, dict):
    print("error: manifest is not a JSON object", file=sys.stderr)
    sys.exit(1)
if "platforms" not in manifest or not isinstance(manifest["platforms"], dict):
    print("error: manifest missing 'platforms' object", file=sys.stderr)
    sys.exit(1)
if target not in manifest["platforms"]:
    print(f"error: no platform entry for {target}", file=sys.stderr)
    sys.exit(1)

info = manifest["platforms"][target]
for key in ("url", "sha256"):
    if key not in info:
        print(f"error: platform entry missing '{key}'", file=sys.stderr)
        sys.exit(1)
print(info["url"], info["sha256"])
PY
)

URL=$(echo "$INFO" | awk '{print $1}')
SHA=$(echo "$INFO" | awk '{print $2}')

curl -fsSL "$URL" -o "$TMP_DIR/devin.tar.gz"
echo "$SHA  $TMP_DIR/devin.tar.gz" | sha256sum -c -

mkdir -p "$TMP_DIR/extract"
tar xzf "$TMP_DIR/devin.tar.gz" -C "$TMP_DIR/extract"

DEVIN_BIN=$(find "$TMP_DIR/extract" -name devin -type f | head -n1)
if [ -z "$DEVIN_BIN" ]; then
  echo "Could not find 'devin' binary in tarball" >&2
  exit 1
fi

cp "$DEVIN_BIN" /usr/local/bin/devin
chmod +x /usr/local/bin/devin
echo "Installed Devin CLI: $(devin --version)"

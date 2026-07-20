#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed or not on PATH" >&2
  exit 1
fi

docker build -t skills-harbor-devin-base:latest -f Dockerfile.devin-base .

echo "==> Base image built: skills-harbor-devin-base:latest"

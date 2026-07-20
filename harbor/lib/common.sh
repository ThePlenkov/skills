#!/usr/bin/env bash
# Shared helpers for the Harbor A/B benchmark scripts.

# Locate the harbor (or harbor.exe) binary.
# Falls back to a portable list of prefixes derived from environment variables.
find_harbor_bin() {
  local candidate
  for candidate in "$(command -v harbor 2>/dev/null)" "$(command -v harbor.exe 2>/dev/null)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  local prefixes=()
  if [ -n "${HOME:-}" ]; then
    prefixes+=("$HOME/.local/bin")
  fi
  if [ -n "${USERPROFILE:-}" ]; then
    prefixes+=("$USERPROFILE/.local/bin")
  fi
  if [ -n "${USER:-}" ] && [ -d "/mnt/c/Users/$USER" ]; then
    prefixes+=("/mnt/c/Users/$USER/.local/bin")
  fi

  for dir in "${prefixes[@]}"; do
    for exe in "$dir/harbor" "$dir/harbor.exe"; do
      if [ -x "$exe" ]; then
        printf '%s\n' "$exe"
        return 0
      fi
    done
  done
  return 1
}

# Run a Harbor command, capturing output to a log file. On failure, emit the
# tail of the log so diagnostics are visible even though stdout/stderr are redirected.
run_harbor_logged() {
  local log_file="$1"
  shift
  mkdir -p "$(dirname "$log_file")"
  if "$@" > "$log_file" 2>&1; then
    tail -n 20 "$log_file"
    return 0
  else
    local code=$?
    echo "ERROR: command failed (exit $code); see $log_file" >&2
    tail -n 50 "$log_file" >&2
    return $code
  fi
}

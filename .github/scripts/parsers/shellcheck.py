#!/usr/bin/env python3
"""
shellcheck.py — convert shellcheck default-format output to GitHub Actions
workflow commands.

Reads shellcheck output (file:line:col: severity: message [info]) from stdin
and emits one annotation per line. Severity → annotation level mapping:
  error   → error
  warning → warning
  info, style → notice

The message portion may itself contain colons (e.g. shellcheck SC info tags
or trailing URLs), so we split on the first 4 colons and treat the rest as
the message body.
"""
import re
import sys

LINE_RX = re.compile(
    r"^(?P<file>[^:]+):(?P<line>\d+):(?P<col>\d+):\s*"
    r"(?P<sev>error|warning|info|style):\s*(?P<msg>.*)$"
)
LEVEL_MAP = {"error": "error", "warning": "warning"}

for raw in sys.stdin:
    m = LINE_RX.match(raw.rstrip("\n"))
    if not m:
        continue
    sev = m["sev"]
    level = LEVEL_MAP.get(sev, "notice")
    title = "shellcheck[" + sev + "]"
    f, ln, col, msg = m["file"], m["line"], m["col"], m["msg"]
    print("::" + level + " file=" + f + ",line=" + ln + ",col=" + col
          + ",title=" + title + "::" + msg)
#!/usr/bin/env python3
"""
ajv.py — convert ajv-cli (JSON Schema validator) output to GitHub Actions
workflow commands.

Reads ajv-cli output (mixed stdout+stderr already merged by caller) from
stdin and emits one annotation per error block.

ajv failure output format:
  <file> invalid
  errors: N
    keyword: ...
    instancePath: /foo/bar
    schemaPath: ...
    params: { ... }
    message: <text>

We track the "current file" via the "<file> invalid" line and emit one
annotation per `message:` line. `CURRENT_FILE` env var provides the
fallback when no "<file> invalid" line precedes the error block.
"""
import os
import re
import sys

FILE_RX = re.compile(r"^(?P<file>[^\s]+)\s+invalid$")
MSG_RX = re.compile(r"^\s*message:\s*(?P<msg>.+?)\s*$")
PATH_RX = re.compile(r"^\s*instancePath:\s*(?P<path>\S+)\s*$")

current = os.environ.get("CURRENT_FILE", "unknown")

for line in sys.stdin:
    line = line.rstrip("\n")
    m = FILE_RX.match(line)
    if m:
        current = m["file"]
        continue
    m = MSG_RX.match(line)
    if m:
        # GitHub workflow commands require message and parameter values to
        # be free of `%` (used for data-section delimiters) and newlines
        # (would terminate the command). Replace with safe substitutes.
        msg = m["msg"].replace("%", "%25").replace("\r", " ").replace("\n", " ")
        print("::error file=" + current + ",title=ajv[frontmatter]::" + msg)
        continue
    m = PATH_RX.match(line)
    if m:
        path = m["path"].replace("%", "%25").replace("\r", " ").replace("\n", " ")
        print("::notice file=" + current
              + ",title=ajv[frontmatter path]::" + path)
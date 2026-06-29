#!/usr/bin/env python3
"""
markdownlint.py — convert markdownlint-cli2 default-format output to GitHub
Actions workflow commands.

Reads markdownlint output (file:line[:col] rule/Name description) from stdin
and emits one ::warning annotation per line. Markdown-lint violations are
always emitted as warnings (lint is non-blocking style by convention).

`col` is optional and not always present; we still attach it when seen.
"""
import re
import sys

LINE_RX = re.compile(
    r"^(?P<file>[^:]+):(?P<line>\d+)(?::(?P<col>\d+))?\s+"
    r"(?P<rule>MD\d+)/(?P<desc>.+?)\s*$"
)

for raw in sys.stdin:
    m = LINE_RX.match(raw.rstrip("\n"))
    if not m:
        continue
    f, ln, col, rule, desc = m["file"], m["line"], m["col"], m["rule"], m["desc"]
    col_part = "col=" + col + "," if col else ""
    print("::warning file=" + f + ",line=" + ln + "," + col_part
          + "title=markdownlint[" + rule + "]::" + desc)
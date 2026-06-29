#!/usr/bin/env jq -rf
#
# skillspector.jq — convert a skillspector JSON document (one skill's scan)
# into GitHub Actions workflow commands (annotations).
#
# Reads JSON from stdin, emits one ::error/::warning/::notice line per issue
# to stdout. Severity → annotation level mapping:
#   HIGH, CRITICAL → error
#   MEDIUM, WARNING → warning
#   LOW             → notice
#
# skillspector's top-level key is `issues`, not `findings`. Each issue has:
#   severity, id, category, location.file, location.start_line,
#   explanation, remediation.

.issues // [] | .[] |
  (.severity // "MEDIUM") as $sev |
  (.id // "?") as $id |
  (.category // "Security") as $cat |
  (.location.file // "") as $file |
  (.location.start_line // null) as $line |
  (.explanation // "(no explanation)") as $why |
  (.remediation // "") as $fix |
  (if   $sev == "HIGH" or $sev == "CRITICAL" then "error"
   elif $sev == "MEDIUM" or $sev == "WARNING" then "warning"
   else "notice" end) as $level |
  (if $line != null then "line=\($line)" else "" end) as $lineArg |
  (
    "::\($level) file=\($file),\($lineArg),title=skillspector[\($id)]: \($cat)::" +
    $why +
    (if $fix != "" then " — Fix: " + $fix else "" end)
  )
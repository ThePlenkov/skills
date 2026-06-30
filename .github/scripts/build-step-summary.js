#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ERR = parseInt(process.env.ERROR_COUNT || '0', 10);
const WARN = parseInt(process.env.WARNING_COUNT || '0', 10);
const RUN_URL = process.env.RUN_URL;
const ARTIFACT_URL = process.env.ARTIFACT_URL;
const dir = process.env.FINDINGS_DIR;
const skills = [];
try {
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    skills.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
} catch {}
const found = skills.filter((s) => s.findings.length > 0);
const clean = skills.filter((s) => s.findings.length === 0);
const L = [];
L.push('## 🛡️ SkillSpector scan');
L.push('');
if (ERR > 0) L.push('**Status:** ❌ fail — error-severity findings detected');
else L.push('**Status:** ✅ pass');
L.push('');

// --- Findings first (collapsed) ---
if (found.length > 0) {
  L.push('<details>');
  L.push('<summary><b>\u274C ' + found.length + ' skill' + (found.length !== 1 ? 's' : '') + ' with findings</b> (' + ERR + ' errors, ' + WARN + ' warnings)</summary>');
  L.push('');
  for (const s of found) {
    const n = s.findings.length;
    const lvl = s.errors > 0 ? '\u274C' : '\u26A0\uFE0F';
    L.push('<details>');
    L.push('<summary>' + lvl + ' <b>' + s.skill + '</b> — ' + n + ' finding' + (n > 1 ? 's' : '') + '</summary>');
    L.push('');
    L.push('| Rule | Level | File | Summary |');
    L.push('| :--- | :--- | :--- | :--- |');
    for (const f of s.findings) {
      const icon = f.level === 'error' ? '\u274C' : f.level === 'warning' ? '\u26A0\uFE0F' : '\u2139\uFE0F';
      L.push('| `' + f.ruleId + '` | ' + icon + ' | ' + f.filePath + ':' + f.line + ' | ' + f.msg.slice(0, 120) + ' |');
    }
    L.push('');
    L.push('</details>');
  }
  L.push('</details>');
  L.push('');
}

// --- Clean skills (collapsed) ---
if (clean.length > 0) {
  L.push('<details>');
  L.push('<summary><b>\u2705 ' + clean.length + ' skill' + (clean.length !== 1 ? 's' : '') + ' clean</b></summary>');
  L.push('');
  for (const s of clean) L.push('- \u2705 ' + s.skill);
  L.push('');
  L.push('</details>');
}
L.push('');
L.push('<sub>\uD83D\uDCC4 <a href="' + RUN_URL + '">Full report & artifacts</a> \u00B7 <a href="' + ARTIFACT_URL + '">SARIF artifact</a></sub>');
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, L.join('\n') + '\n');


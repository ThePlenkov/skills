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
const errorSkills = skills.filter((s) => s.errors > 0);
const warnSkills = skills.filter((s) => s.errors === 0 && s.warnings > 0);
const clean = skills.filter((s) => s.findings.length === 0);
const L = [];
L.push('## \uD83D\uDEE1\uFE0F SkillSpector scan');
L.push('');
if (ERR > 0) L.push('**Status:** \u274C fail \u2014 error-severity findings detected');
else L.push('**Status:** \u2705 pass');
L.push('');

function renderSkill(s) {
  const n = s.findings.length;
  const lvl = s.errors > 0 ? '\u274C' : '\u26A0\uFE0F';
  const lines = [];
  lines.push('<details>');
  lines.push('<summary>' + lvl + ' <b>' + s.skill + '</b> \u2014 ' + n + ' finding' + (n > 1 ? 's' : '') + '</summary>');
  lines.push('');
  lines.push('| Rule | Level | File | Summary |');
  lines.push('| :--- | :--- | :--- | :--- |');
  for (const f of s.findings) {
    const icon = f.level === 'error' ? '\u274C' : f.level === 'warning' ? '\u26A0\uFE0F' : '\u2139\uFE0F';
    lines.push('| `' + f.ruleId + '` | ' + icon + ' | ' + f.filePath + ':' + f.line + ' | ' + f.msg.slice(0, 120) + ' |');
  }
  lines.push('');
  lines.push('</details>');
  return lines;
}

// --- Errors section ---
if (errorSkills.length > 0) {
  const totalErr = errorSkills.reduce((s, sk) => s + sk.errors, 0);
  L.push('<details>');
  L.push('<summary><b>\u274C ' + errorSkills.length + ' skill' + (errorSkills.length !== 1 ? 's' : '') + ' with errors</b> (' + totalErr + ' error' + (totalErr !== 1 ? 's' : '') + ')</summary>');
  L.push('');
  for (const s of errorSkills) L.push(...renderSkill(s));
  L.push('</details>');
  L.push('');
}

// --- Warnings section ---
if (warnSkills.length > 0) {
  const totalWarn = warnSkills.reduce((s, sk) => s + sk.warnings, 0);
  L.push('<details>');
  L.push('<summary><b>\u26A0\uFE0F ' + warnSkills.length + ' skill' + (warnSkills.length !== 1 ? 's' : '') + ' with warnings</b> (' + totalWarn + ' warning' + (totalWarn !== 1 ? 's' : '') + ')</summary>');
  L.push('');
  for (const s of warnSkills) L.push(...renderSkill(s));
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

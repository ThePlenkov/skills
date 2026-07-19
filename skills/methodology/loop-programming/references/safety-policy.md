# Repository Loop Safety Policy

## General rule

Preserve user data, repository history, credentials, and unrelated work.

Prefer reversible actions.

## Prohibited by default

Do not run or construct:

```text
rm -rf
git reset --hard
git clean -fd
git clean -fdx
git checkout -- .
git restore .
git push --force
git push -f
git branch -D
DROP DATABASE
DROP TABLE
TRUNCATE TABLE
shutdown
reboot
mkfs
dd to a device
recursive permission changes outside a narrowly specified path
```

Equivalent variants are also prohibited.

Do not:

- delete unrelated files;
- discard existing local modifications;
- rewrite repository history;
- force-push;
- expose credentials;
- print complete environment variables;
- modify `.env` or secret stores without explicit authorization;
- upload proprietary repository content externally;
- execute downloaded scripts without inspection;
- disable security checks;
- install system-wide packages;
- use `sudo`;
- modify files outside the configured working directory;
- follow symlinks that escape the working directory.

## Commands requiring explicit permission

Require explicit user authorization before:

- installing or upgrading dependencies;
- changing lockfiles when dependency changes are not part of the task;
- running database migrations against non-ephemeral databases;
- contacting production services;
- creating or deleting cloud resources;
- publishing packages;
- pushing commits or branches;
- opening pull requests;
- changing CI secrets;
- changing access-control configuration;
- executing benchmarks that incur meaningful cost.

## Validator integrity

Do not produce a passing result by:

- deleting a failing test;
- marking a test skipped;
- narrowing test discovery;
- excluding a failing path;
- suppressing an error globally;
- weakening an assertion;
- replacing implementation with a hardcoded fixture response;
- changing the validator command;
- intercepting the validator's exit status;
- modifying generated reports after execution.

Exceptions require the user's goal to explicitly include validator or test
changes.

When such a change is legitimate, explain why and validate the new behavior
independently.

## Scope enforcement

Resolve all mutation paths to canonical absolute paths.

Reject a mutation when:

- the resolved path is outside `cwd`;
- the path matches an exclusion;
- a symlink target escapes `cwd`;
- the action touches unrelated files without justification;
- the change is broader than necessary.

## Shell handling

Prefer argument arrays to shell strings.

Do not use `shell=True` by default.

Treat these as high-risk shell features:

```text
;
&&
||
|
>
>>
<
$()
backticks
process substitution
wildcard expansion in destructive commands
```

Allow them only through an explicit shell-command mode and after policy
inspection.

## Network handling

Default network access to disabled.

When enabled:

- restrict research to necessary destinations;
- do not transmit repository contents;
- do not send secrets or internal identifiers;
- prefer official sources;
- record that network access occurred.

## Failure behavior

When the next necessary action is unsafe:

1. do not execute it;
2. stop with `UNSAFE`;
3. identify the prohibited action;
4. explain why it is unsafe;
5. provide a safe alternative.

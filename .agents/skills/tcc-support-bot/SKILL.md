---
name: tcc-support-bot
description: "Use the TCC_Support_Bot in #gitlab Slack channel for GitLab project operations (archive, move, delete). Trigger when the user needs to archive, move, or delete a GitLab project."
---

# TCC_Support_Bot

Slack bot in #gitlab channel for GitLab project operations: archive, move, and delete repositories.

## When to Use

- User needs to archive a GitLab project
- User needs to move a project to another group
- User needs to delete an empty project
- User asks about GitLab project lifecycle operations

## Available Commands

All commands are sent in #gitlab channel:

### Help

```
@TCC_Support_Bot -h
```

### GitLab Operations

**Archive/Remove:**

```
@TCC_Support_Bot gitlab rm <repo_path>
@TCC_Support_Bot gitlab archive <repo_path>  # alias for rm
```

- Removes repo if no commits
- Archives repo if at least one commit exists

**Move:**

```
@TCC_Support_Bot gitlab mv <repo_path> <group_path>
```

- Moves repo from one group to another

**Smart Mode:**

```
@TCC_Support_Bot gitlab
```

- Searches for appropriate arguments in the nearest messages in the thread
- Examples from docs:
  - "hi! could you move <https://gitlab.booking.com/core/my_test_repo> to my personal space"
  - "remove <https://gitlab.booking.com/core/my_test_repo> please"

### Doctor

```
@TCC_Support_Bot doctor
@TCC_Support_Bot doctor <repo_or_group_path> <email>
```

- Checks user GitLab permissions
- Shows required passport policies
- Checks repo/group access

### Jira

```
@TCC_Support_Bot jira --project=TCC
@TCC_Support_Bot jira --project=TCC --title="custom title" --labels=label1,label2
```

- Creates Jira ticket based on thread content

## Self-Service Archive

If you are a **Maintainer** or **Owner** of the project and it has commits:

- Bot will archive immediately without TCC approval
- Archiving is reversible
- You already have sufficient access

TCC approval required for:

- Deleting empty projects (irreversible)
- Non-maintainers requesting archive

## Approval Process

For cases requiring approval:

1. Bot shows expected actions and asks for approval
2. Bot creates a Jira ticket
3. Someone from @tcc approves
4. Bot executes the action (remove, archive, or move)

## Usage Examples

### Archive a project

```bash
# In #gitlab channel:
@TCC_Support_Bot gitlab rm https://gitlab.com/booking-com/personal/petr.plenkov/homebrew-glean-bk
```

### Move a project

```bash
# In #gitlab channel:
@TCC_Support_Bot gitlab mv https://gitlab.booking.com/core/my_test_repo https://gitlab.booking.com/dkorchagin
```

### Check permissions

```bash
# In #gitlab channel:
@TCC_Support_Bot doctor
```

## Documentation

- Full docs: <https://docs.booking.com/tcc/services/tcc_support_bot.html>
- Source code: <https://gitlab.com/booking-com/go/og/-/tree/master/projects/tcc-slack-bot>
- Channel: #gitlab (C6ZJUH308)

## Notes

- Always send commands in #gitlab channel
- Use full repo URLs or paths
- For personal projects, you may have self-service archive access as maintainer/owner
- Check project ownership before requesting operations

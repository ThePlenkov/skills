# Drill System Troubleshooting

This rule provides troubleshooting guidance for the drill/undrill system for context isolation and scope management.

## Quick Reference

- **Skill**: `.agents/skills/drill/SKILL.md` - Full specification
- **Commands**:
  - `/drill` - `.agents/commands/drill.md` - Create isolated execution frame
  - `/undrill` - `.agents/commands/undrill.md` - Close frame and reintegrate

## Common Issues

### 1. Cursor Not Found

**Symptom**: Error reading `.drills/cursor`

**Cause**: No active drill or cursor file missing

**Solution**:
```bash
# Check if .drills directory exists
ls -la .drills/

# If missing, create root drill first
/drill { goal="...", slug="root-investigation" }

# Verify cursor was created
cat .drills/cursor
```

### 2. SHA Not Resolving

**Symptom**: Cannot find drill directory for SHA in cursor

**Cause**: Cursor contains SHA that doesn't match any drill directory

**Solution**:
```bash
# Read current cursor
cat .drills/cursor

# Search for matching directory
find .drills/ -type d -name "*<sha>*"

# If not found, reset cursor to known drill
echo "a1b2c3" > .drills/cursor  # use actual SHA
```

### 3. Scope Not Narrowing

**Symptom**: Drill creation rejected - scope not narrower than parent

**Cause**: Child drill broadens or pivots instead of narrowing

**Solution**:
- Review parent drill's scope in frontmatter
- Ensure child focuses on ONE aspect:
  - One subsystem
  - One hypothesis
  - One artifact class
  - Reduced time/environment range
- If need to pivot, `/undrill` first, then create sibling

### 4. Context Leakage

**Symptom**: Child drill has too much parent context

**Cause**: Merge policy too permissive or delegation not isolated

**Solution**:
```bash
# Use stricter merge policy
/undrill --merge=summary --trace=light

# For delegation, ensure mode is set
session:
  mode: delegated  # not direct
  parent_session_id: <parent-session>
```

### 5. Session Not Resuming

**Symptom**: Cannot resume drill after interruption

**Cause**: Missing or invalid session pointers

**Solution**:
- Check drill frontmatter has complete session block:
```yaml
session:
  agent_id: orchestrator
  session_id: sess_01jz8n4x7e
  mode: direct
  resume_command: /agents resume sess_01jz8n4x7e
```
- Use resume_command or resume_uri to restore
- If lost, create new drill from current state

### 6. Evidence Not Linked

**Symptom**: Warning about unlinked evidence

**Cause**: Evidence files exist but not referenced in drill

**Solution**:
- Add relative links in drill's Evidence section:
```md
# Evidence

- [SQL Plan Capture](./sql-plan-capture/sql-plan-capture.md)
- [Log Snippet](./evidence-log-snippet/evidence-log-snippet.md)
```

### 7. Cannot Undrill at Root

**Symptom**: Error when trying to undrill from root drill

**Cause**: No parent to return to

**Solution**:
- Root drills should be closed explicitly:
```bash
# Mark as done without undrilling
# Update status in frontmatter to "done"
# Or use root-close mode if supported
```

### 8. Duplicate Drill Names

**Symptom**: Name collision when creating drill

**Cause**: SHA collision or same slug at same timestamp

**Solution**:
- System should auto-generate unique SHA
- If manual creation, ensure unique SHA:
```bash
# Generate unique SHA
echo -n "$(date +%s)$RANDOM" | sha256sum | cut -c1-8
```

### 9. Merge Returns Too Much Data

**Symptom**: Parent context bloated after undrill

**Cause**: Merge policy set to "full"

**Solution**:
```bash
# Use summary or structured merge
/undrill --merge=summary

# Or structured for machine-readable
/undrill --merge=structured
```

### 10. Delegation Not Isolating

**Symptom**: Subagent has access to parent transcript

**Cause**: Delegation mode not properly set

**Solution**:
- Ensure child drill has:
```yaml
session:
  mode: delegated
  parent_session_id: <parent>
  spawned_by: <parent-agent>
```
- Subagent should receive only:
  - Task description
  - Selected materials
  - No sibling contexts

## Best Practices

### Creating Drills

1. **Always narrow scope**
   - Focus on one aspect
   - Reduce surface area
   - Test one hypothesis

2. **Provide clear goal**
   - Specific objective
   - Measurable outcome
   - Time-bounded if possible

3. **Define boundaries**
   - What's included
   - What's excluded
   - Why boundary is appropriate

### Managing Evidence

1. **Separate documents**
   - One directory per artifact
   - Markdown file inside
   - Link from drill

2. **Clear naming**
   - Descriptive directory names
   - Match content type
   - Easy to reference

3. **Metadata**
   - Source information
   - Creation timestamp
   - Related drills

### Session Continuity

1. **Complete session blocks**
   - Always include agent_id
   - Always include session_id
   - Add parent_session_id if delegated

2. **Resume information**
   - Provide resume_command
   - Or resume_uri
   - Document how to continue

3. **Mode clarity**
   - direct: same session
   - delegated: subagent session
   - resumed: restored session

### Undrilling

1. **Finalize findings**
   - Write clear conclusions
   - Link evidence
   - Note confidence level

2. **Choose merge policy**
   - summary: default, concise
   - structured: machine-readable
   - full: debug only

3. **Clean up**
   - Mark status as done/abandoned
   - Update timestamps
   - Verify evidence links

## Validation Checklist

Before creating drill:
- [ ] Parent drill exists (unless root)
- [ ] Goal is narrower than parent
- [ ] Slug is filename-safe
- [ ] Name will be unique

Before undrilling:
- [ ] Findings are written
- [ ] Return payload is present
- [ ] Evidence links resolve
- [ ] Status is updated

## Related Documentation

- **Full Specification**: `.agents/skills/drill/SKILL.md`
- **Command Reference**:
  - `/drill`: `.agents/commands/drill.md`
  - `/undrill`: `.agents/commands/undrill.md`
- **Related Skills**:
  - `investigate-first`: Narrow scope through investigation
  - `unwind`: Expand scope by collapsing branches
  - `retrospect`: Capture learnings from mistakes
  - `memory`: Persistent knowledge across sessions

# Beads Technical Deep Dive: Complete Documentation Analysis

**Source:** gastownhall.github.io/beads documentation  
**Pages Analyzed:** 5 comprehensive docs pages  
**Topics:** Core Concepts, Workflows, Multi-Agent Coordination

---

## Table of Contents

1. [Introduction & Design Philosophy](#introduction--design-philosophy)
2. [Core Concepts](#core-concepts)
3. [Workflows & Chemistry Metaphor](#workflows--chemistry-metaphor)
4. [Multi-Agent Coordination](#multi-agent-coordination)
5. [Architecture Deep Dive](#architecture-deep-dive)
6. [Command Reference](#command-reference)
7. [Best Practices](#best-practices)

---

## Introduction & Design Philosophy

### Why Beads?

Traditional issue trackers (Jira, GitHub Issues) weren't designed for AI agents. Beads was built from the ground up for:

| Feature | Traditional Trackers | Beads |
|---------|----------------------|-------|
| Concurrent agents | Collision-prone | Hash-based IDs prevent collisions |
| Storage | Proprietary cloud | Git-backed, version-controlled |
| Collaboration | Limited | Dolt-native replication |
| Dependencies | Basic | Dependency-aware execution |
| AI Integration | Bolt-on | Native JSON output, AI-first |

### Key Design Principles

1. **Dolt as source of truth** - Issues stored in version-controlled SQL database
2. **AI-native workflows** - Hash-based IDs, JSON output, dependency-aware execution
3. **Local-first operation** - Fast queries, background sync
4. **Declarative workflows** - Formulas define repeatable patterns

---

## Core Concepts

### Issues (Beads)

The fundamental work item in Beads:

```typescript
interface Bead {
  id: string;           // Hash-based: bd-a1b2 or hierarchical: bd-a1b2.1
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore';
  priority: 0 | 1 | 2 | 3 | 4;  // 0=critical, 4=backlog
  status: 'open' | 'in_progress' | 'closed';
  labels: string[];
  title: string;
  description: string;
  dependencies: Dependency[];
}
```

### Dependency Types

Four types of relationships between issues:

| Type | Description | Affects Ready Queue |
|------|-------------|---------------------|
| **blocks** | Hard dependency (X blocks Y) | ✅ Yes |
| **parent-child** | Epic/subtask relationship | ❌ No |
| **discovered-from** | Track issues found during work | ❌ No |
| **related** | Soft relationship | ❌ No |

**Example:**
```bash
# X blocks Y (Y can't start until X is done)
bd dep add bd-y blocks:bd-x

# Parent-child relationship
bd create "Subtask" --parent bd-epic

# Discovered during work
bd create "Found bug" --deps discovered-from:bd-100

# Just related
bd dep add bd-a related:bd-b
```

### Hash-Based IDs

Hash-based IDs prevent collisions when multiple agents work concurrently:

```
bd-a1b2        // Top-level issue
bd-a1b2.1      // First child
bd-a1b2.1.3    // Nested child
```

Benefits:
- No coordination needed for ID generation
- Agents can create issues offline
- Merges are conflict-free
- Git-native, portable across repositories

---

## Workflows & Chemistry Metaphor

### The Three Phases

Beads uses a chemistry metaphor for workflow phases:

| Phase | Storage | Synced | Use Case |
|-------|---------|--------|----------|
| **Proto** (solid) | Built-in | N/A | Reusable templates |
| **Mol** (liquid) | .beads/ | ✅ Yes | Persistent work |
| **Wisp** (vapor) | .beads-wisp/ | ❌ No | Ephemeral operations |

### Formulas

Declarative workflow templates in TOML or JSON:

```toml
formula = "feature-workflow"
version = 1
type = "workflow"

[[steps]]
id = "design"
title = "Design the feature"
type = "human"
assignee = "architect"

[[steps]]
id = "implement"
title = "Implement the feature"
needs = ["design"]  # Dependency on design step
assignee = "developer"

[[steps]]
id = "test"
title = "Write tests"
needs = ["implement"]

[[steps]]
id = "deploy"
title = "Deploy to production"
type = "gate"  # Async coordination
needs = ["test"]
```

### Molecules

Work graphs created by instantiating formulas:

```bash
# Create a molecule from formula
bd pour release --var version=1.0.0

# View the molecule structure
bd mol show release-1.0.0

# Work through steps
bd update release-1.0.0.1 --claim
bd close release-1.0.0.1
# Next step automatically becomes ready
```

### Gates

Async coordination primitives:

| Gate Type | Purpose | Example |
|-----------|---------|---------|
| **Human gate** | Wait for approval | `type = "human"` |
| **Timer gate** | Wait for duration | `duration = "24h"` |
| **GitHub gate** | Wait for CI/PR | `type = "github", event = "pr_merge"` |

### Wisps

Ephemeral operations that don't persist:

```bash
# Create wisp (won't sync to git)
bd wisp "Experiment with new API"

# Stored in .beads-wisp/ (gitignored)
# Auto-expires after completion
# Perfect for spikes, experiments, temporary work
```

---

## Multi-Agent Coordination

### Work Assignment (Pinning)

The core mechanism for assigning work to agents:

```bash
# Pin issue to specific agent
bd pin bd-42 --for agent-1

# Pin and immediately start work
bd pin bd-42 --for agent-1 --start

# Check what's on my hook
bd hook

# Check another agent's work
bd hook --agent agent-1

# Unpin when done
bd unpin bd-42
```

### Handoff Patterns

**1. Sequential Handoff:**
```bash
# Agent A completes, hands to Agent B
bd close bd-42 --reason "Ready for review"
bd pin bd-42 --for agent-b

# Agent B picks up
bd hook              # Sees bd-42
bd update bd-42 --claim
```

**2. Parallel Work:**
```bash
# Coordinator assigns to multiple agents
bd pin bd-42 --for agent-a --start
bd pin bd-43 --for agent-b --start
bd pin bd-44 --for agent-c --start

# Monitor progress
bd list --status in_progress --json
```

**3. Fan-Out / Fan-In:**
```bash
# Fan-out: Split epic into parts
bd create "Part A" --parent bd-epic
bd create "Part B" --parent bd-epic
bd create "Part C" --parent bd-epic

bd pin bd-epic.1 --for agent-a
bd pin bd-epic.2 --for agent-b
bd pin bd-epic.3 --for agent-c

# Fan-in: Wait for all parts
bd dep add bd-merge blocks:bd-epic.1 blocks:bd-epic.2 blocks:bd-epic.3
```

### Cross-Repository Dependencies

Track dependencies across repository boundaries:

```bash
# Add external dependency
bd dep add bd-42 external:other-repo/bd-100

# Configure routing
bd route add "frontend/*" frontend-repo
bd route add "backend/*" backend-repo
bd route add "*" main-repo  # Default
```

### Conflict Prevention

**File Reservations:**
```bash
# Reserve before editing
bd reserve auth.go --for agent-1

# Check current reservations
bd reservations list

# Release when done
bd reserve --release auth.go
```

**Issue Locking:**
```bash
# Lock for exclusive work
bd lock bd-42 --for agent-1

# Unlock when done
bd unlock bd-42
```

### Communication Patterns

**Via Comments:**
```bash
# Leave context for next agent
bd comment add bd-42 "Completed API, needs frontend integration"

# Read full context
bd show bd-42 --full
```

**Via Labels:**
```bash
# Mark for review
bd update bd-42 --add-label "needs-review"

# Filter by label
bd list --label-any needs-review
```

---

## Architecture Deep Dive

### Dolt Integration

```
┌─────────────────────────────────────┐
│         User Interface               │
│    (CLI, AI Agent, Web UI)          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Beads CLI (bd)              │
│    - Command parsing                  │
│    - JSON output                      │
│    - Agent integration                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Dolt Database               │
│    - SQL tables for issues          │
│    - Version controlled              │
│    - Git-native storage              │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼───┐           ┌────▼────┐
│Embedded│           │  Server  │
│ Mode   │           │  Mode    │
│(.beads/│           │(dolt    │
│dolt/)  │           │server)  │
└───┬────┘           └────┬────┘
    │                      │
    │         ┌────────────┘
    │         │
┌───▼─────────▼───┐
│   Git Remote    │
│  (Dolt repo)    │
│  Replication    │
└─────────────────┘
```

### Sync Flow

```
Local Work
    │
    ▼
┌─────────────────┐
│  Dolt DB        │
│  (.beads/dolt/) │
└────────┬────────┘
         │ dolt commit
         ▼
┌─────────────────┐
│ Local History   │
└────────┬────────┘
         │ dolt push/pull
         ▼
┌─────────────────┐
│ Remote Dolt     │
│ Repository      │
│ (Shared)        │
└─────────────────┘
```

### Server Mode

For multi-writer scenarios:

```bash
# Start Dolt server
bd dolt start

# Server handles:
# - Auto-commit
# - Auto-sync
# - Concurrent access
# - Performance optimization

# Check health
bd doctor

# View logs
tail -f .beads/dolt/sql-server.log
```

---

## Command Reference

### Issue Management

| Command | Description | Example |
|---------|-------------|---------|
| `bd create` | Create new issue | `bd create "Fix bug" -p 1 -t bug` |
| `bd list` | List issues | `bd list --status open --json` |
| `bd show` | Show issue details | `bd show bd-42 --full` |
| `bd update` | Update issue | `bd update bd-42 --status in_progress` |
| `bd close` | Close issue | `bd close bd-42 --reason "Done"` |
| `bd ready` | Show unblocked work | `bd ready --json` |

### Dependencies

| Command | Description | Example |
|---------|-------------|---------|
| `bd dep add` | Add dependency | `bd dep add bd-y blocks:bd-x` |
| `bd dep list` | List dependencies | `bd dep list bd-42` |
| `bd dep rm` | Remove dependency | `bd dep rm bd-y blocks:bd-x` |

### Workflows

| Command | Description | Example |
|---------|-------------|---------|
| `bd pour` | Instantiate formula | `bd pour release --var v=1.0` |
| `bd mol list` | List molecules | `bd mol list --json` |
| `bd mol show` | Show molecule | `bd mol show release-1.0.0` |
| `bd wisp` | Create ephemeral | `bd wisp "Quick test"` |

### Multi-Agent

| Command | Description | Example |
|---------|-------------|---------|
| `bd pin` | Pin to agent | `bd pin bd-42 --for agent-1` |
| `bd unpin` | Unpin issue | `bd unpin bd-42` |
| `bd hook` | Show pinned work | `bd hook --agent agent-1` |
| `bd reserve` | Reserve files | `bd reserve auth.go --for agent-1` |
| `bd lock` | Lock issue | `bd lock bd-42 --for agent-1` |
| `bd unlock` | Unlock issue | `bd unlock bd-42` |

### Sync & Maintenance

| Command | Description | Example |
|---------|-------------|---------|
| `bd sync` | Sync with remote | `bd sync` |
| `bd dolt start` | Start server | `bd dolt start` |
| `bd dolt stop` | Stop server | `bd dolt stop` |
| `bd doctor` | Health check | `bd doctor` |
| `bd init` | Initialize project | `bd init --quiet` |

---

## Best Practices

### For Solo Developers

1. **Always use `--json` for scripting:**
   ```bash
   bd list --json | jq '.[] | select(.priority == 0)'
   ```

2. **Track discovered work:**
   ```bash
   bd create "Found edge case" --deps discovered-from:bd-100
   ```

3. **Sync at end of session:**
   ```bash
   bd sync
   ```

### For Teams

1. **Clear ownership:** Always pin work to specific agents
2. **Document handoffs:** Use comments to explain context
3. **Use labels for status:** `needs-review`, `blocked`, `ready`
4. **Avoid conflicts:** Reserve files for shared resources
5. **Monitor progress:** Regular status checks

### For AI Agents

1. **Use JSON output for parsing:**
   ```bash
   bd ready --json
   bd show bd-42 --json
   ```

2. **Check your hook regularly:**
   ```bash
   bd hook --json
   ```

3. **Report discovered issues:**
   ```bash
   bd create "Bug in auth" --deps discovered-from:$PARENT_ISSUE
   ```

4. **Close with meaningful reasons:**
   ```bash
   bd close bd-42 --reason "Implemented in commit abc123"
   ```

---

## Integration Examples

### Claude Code Integration

```bash
# At session start, check ready work
bd ready --json

# During work, track discoveries
bd create "Edge case found" --deps discovered-from:bd-parent

# At session end, sync
bd sync
```

### CI/CD Integration

```yaml
# .github/workflows/beads.yml
- name: Check Beads Status
  run: |
    bd doctor
    bd list --status in_progress --json
```

### Custom Orchestrator

```javascript
// Check for ready work
const ready = JSON.parse(exec('bd ready --json'));

// Assign to agents
for (const issue of ready) {
  exec(`bd pin ${issue.id} --for ${selectAgent()} --start`);
}

// Monitor progress
const inProgress = JSON.parse(exec('bd list --status in_progress --json'));
```

---

## Summary

Beads provides a complete solution for AI-native work tracking:

1. **Git-backed storage** - Version-controlled, auditable, portable
2. **Dolt integration** - SQL database with Git semantics
3. **Hash-based IDs** - Collision-free concurrent work
4. **Dependency awareness** - Smart ready queue
5. **Workflow primitives** - Formulas, molecules, gates
6. **Multi-agent coordination** - Pinning, handoffs, conflict prevention
7. **AI-native design** - JSON output, programmatic access

**Key insight:** Beads isn't just an issue tracker - it's a **universal ledger for knowledge work** that agents really, really like.

---

## Resources

- **Documentation:** https://gastownhall.github.io/beads/
- **Repository:** https://github.com/gastownhall/beads
- **Installation:** `brew install beads`
- **Discord:** https://gastownhall.ai/

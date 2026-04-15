# Gas Town & Beads v1.0: From Clown Show to Production-Ready

**Source:** Steve Yegge's "Gas Town: from Clown Show to v1.0"  
**Published:** April 3, 2026  
**GitHub Stars:** Gas Town (13k), Beads (20k+)

---

## TL;DR

Steve Yegge's **Gas Town** (AI agent orchestration) and **Beads** (AI-native issue tracker) both released v1.0.0 on April 3, 2026. After 3 months of chaotic development (the "22-nose Clown Show"), the platform has stabilized into a production-ready system that enables non-technologists to build software by talking to a "Mayor" who manages teams of coding agents.

---

## The Journey: From Chaos to v1.0

### Early Days: The Clown Show

Yegge describes the chaotic early development:

- **Serial killer sprees**: The "Deacon" (like a modern Butler) randomly killing workers mid-job
- **The 22-nose Clown Show**: Massive data loss events, each earning a new clown nose on the Mayor, going on for weeks
- **Piles of worker corpses**: Honking alert noses and trying times

Despite this, the project gained **13k GitHub stars in just 3 months** with hundreds of enthusiastic committers. Bugs get noticed and fixed fast by the community.

### The "Mayor" Abstraction

**The key insight:** People don't want to read walls of scrolling text from coding agents.

Traditional coding agents (Claude Code, etc.) force you to read everything: "Now I will run this script... Now I will print 8 pages of recaps... Now I'm deleting your database."

**The Mayor solves this by:**
- Reading all the "crap" that workers print
- Knowing your context, hopes, and dreams
- Providing conversational summaries instead of raw logs
- Acting as a "Chief of Staff" managing a team of Executive Assistants

> "Programming in 2026 will become talking to a face... You'll have a cartoon fox there onscreen, in costume, building and managing your production software."

---

## Beads: The Memory Revolution

### What is Beads?

Beads is a **git-backed issue tracker** designed for AI-supervised coding workflows. It gives agents:

- **Working memory** - Agents remember what they're doing
- **Long-horizon planning** - Track complex multi-step tasks
- **The "Missing Why"** - Complete audit trail of decisions

### Why "The Missing Why"?

Chris Sells (co-creator of Gas City) observed that Git history contains the **What, Where, Who, and How** - but **Beads is the Why**.

Every work item becomes a **bead** (lightweight issue/bug report) that:
- Gets stored in Git (versioned)
- Links together as a multi-graph
- Is queryable with SQL
- Forms a complete audit trail

### Technical Architecture

**Old Architecture (v0.x):** SQLite + JSONL + awkward syncing + merge conflicts + race conditions = fragile

**New Architecture (v1.0):** Dolt-backed (version-controlled SQL database)
- Embedded Dolt mode for solo users
- Server mode for multi-writer access
- Automatic sync via Dolt replication
- No more bidirectional sync hell

---

## Core Concepts

### Beads (the data structure)

A bead is a work item with:
- **ID**: Hash-based (e.g., `bd-a1b2`) prevents collisions with concurrent agents
- **Type**: bug, feature, task, epic, chore
- **Priority**: 0 (critical) to 4 (backlog)
- **Status**: open, in_progress, closed
- **Dependencies**: blocks, parent-child, discovered-from, related

### Formulas

Declarative workflow templates (TOML or JSON):

```toml
formula = "feature-workflow"
version = 1
type = "workflow"

[[steps]]
id = "design"
title = "Design the feature"
type = "human"

[[steps]]
id = "implement"
title = "Implement the feature"
needs = ["design"]
```

### Molecules

Work graphs created by instantiating formulas:

```bash
bd pour release --var version=1.0.0
bd mol show release-1.0.0
```

### Gates

Async coordination primitives:
- **Human gates**: Wait for approval
- **Timer gates**: Wait for duration
- **GitHub gates**: Wait for PR merge, CI pass

### Wisps

Ephemeral operations that don't sync to git:

```bash
bd wisp "Quick experiment"
# Stored in .beads-wisp/ (gitignored)
# Auto-expire after completion
```

---

## Multi-Agent Coordination

Beads supports complex multi-agent setups:

### Work Assignment (Pinning)

```bash
# Pin issue to specific agent
bd pin bd-42 --for agent-1 --start

# Check what's on my hook
bd hook

# Unpin when done
bd unpin bd-42
```

### Handoff Patterns

**Sequential:**
```bash
# Agent A completes, hands to Agent B
bd close bd-42 --reason "Ready for review"
bd pin bd-42 --for agent-b
```

**Parallel:**
```bash
# Coordinator assigns to multiple agents
bd pin bd-42 --for agent-a --start
bd pin bd-43 --for agent-b --start
bd pin bd-44 --for agent-c --start
```

**Fan-Out / Fan-In:**
```bash
# Split epic into parts
bd create "Part A" --parent bd-epic
bd create "Part B" --parent bd-epic

# Wait for all parts
bd dep add bd-merge bd-epic.1 bd-epic.2
```

### Conflict Prevention

```bash
# Reserve files before editing
bd reserve auth.go --for agent-1

# Lock issue for exclusive work
bd lock bd-42 --for agent-1
```

---

## Gas City: The Future

**Gas City** is the successor to Gas Town, currently in alpha:

### What's Different?

- **Gas Town**: Monolithic orchestrator (works with ~handful of agents)
- **Gas City**: Modular platform (works with anything as smart as Claude 3.5 Sonnet)

### Gas City Primitives

Users can build custom orchestrators using:
- Identity, roles, messaging, mail
- Sessions, cost tracking, multi-model dispatch
- Skills, prompting, priming, hooks
- GUPP, NDI, formulas, molecules
- Beads, epics, convoys, orders, patrols
- Plugins, tmux, seances

### Use Cases

- **Enterprise adoption**: "How can I bring AI into my company and pass an audit trail"
- **SaaS replacement**: "How can I rid myself of gougy niche SaaS by in-sourcing to AI"
- **Multi-project workflows**: Coordinate across repositories
- **Federation**: Dolt federation via "Wasteland" protocol

---

## Key Insights

### For Non-Technologists

A Communications major (4 years out of school) used Gas Town to build a replacement for a pricey SaaS product. Working with another non-technologist, they built something so good the company is switching to it.

> "Anyone can build software with Gas Town - and people are!"

### The Power of Dolt

Beads' migration to Dolt eliminated:
- Bidirectional sync hell
- 3-way merge conflicts
- Two sources of truth
- Race conditions
- Tombstone garbage collection

> "We got incredibly lucky that [Dolt] exists at all."

### Why Beads Has 20k Stars

- Top ~2000 GitHub repos out of 300M+
- "It just works"
- "It's soooo easy"
- "You start using Beads, everything becomes a bead, and life with agents just starts getting easier"

---

## Installation

### Beads

```bash
# Homebrew
brew install beads

# Or quick install
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Initialize
cd your-project
bd init --quiet

# Create first issue
bd create "Set up database" -p 1 -t task
```

### Gas Town

```bash
# Have your coding agent install it
# Talk to the Mayor
```

---

## The Team

**Gas Town Ecosystem Generals:**
- Steve Yegge (the panda)
- Matt Beane
- Chris Sells
- Julian Knutsen
- Tim Sehn (Dolt)
- Brendan Hopper

**Discord:** [gastownhall.ai](https://gastownhall.ai/)

---

## Conclusion

Gas Town and Beads represent a fundamental shift in how we interact with AI coding agents:

1. **From reading to conversing**: The Mayor eliminates the "wall of scrolling text"
2. **From ephemeral to auditable**: Beads provides the "missing Why" for all decisions
3. **From single-agent to orchestrated**: Multi-agent coordination with clear ownership
4. **From monolithic to modular**: Gas City enables custom orchestrator construction

**Both are MIT-licensed and production-ready at v1.0.0.**

---

## Related Resources

- Gas Town: https://github.com/gastownhall/gastown
- Gas City: https://github.com/gastownhall/gascity
- Beads: https://github.com/gastownhall/beads
- Dolt: https://github.com/dolthub/dolt
- Documentation: https://gastownhall.github.io/beads/

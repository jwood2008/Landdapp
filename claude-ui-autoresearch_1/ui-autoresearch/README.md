# UI Auto-Research

Karpathy-inspired autonomous iteration loop for UI/UX development.
Lives globally at `~/.claude/ui-autoresearch/` — works from any project directory.

## Architecture

```
~/.claude/                          ← Global (install once)
├── CLAUDE.md                       ← Enhanced with scoring rubric
└── ui-autoresearch/
    ├── run.sh                      ← Iteration runner
    ├── capture.ts                  ← Playwright screenshot harness
    ├── prompts/
    │   ├── visual-scorer.md        ← Scoring prompt (Claude vision)
    │   └── improvement-diagnosis.md ← Diagnosis + patch prompt
    └── README.md                   ← This file

~/projects/sebenza/                 ← Per-project (auto-generated)
└── .ui-autoresearch/
    ├── captures/ComponentName/
    │   ├── iteration-0/
    │   │   ├── dark-desktop-1440x900.png
    │   │   ├── scores.json
    │   │   └── metadata.json
    │   └── iteration-1/...
    └── score-history-ComponentName.json
```

**Global tooling** (prompts, scripts) lives in `~/.claude/` — install once, use everywhere.
**Project artifacts** (screenshots, scores) live in `.ui-autoresearch/` inside each project — auto-gitignored.

## How It Works

```
You (the human) define:          The agent iterates:
┌──────────────────────┐         ┌──────────────────────────────┐
│ • Design principles  │         │ 1. Build / modify component  │
│   (CLAUDE.md rubric) │  ───►   │ 2. Quality gates (tsc, lint) │
│ • Target component   │         │ 3. Screenshot (Playwright)   │
│ • Target score (9.0) │         │ 4. Score (Claude vision)     │
│ • Max iterations (8) │         │ 5. Diagnose weak dimensions  │
└──────────────────────┘         │ 6. Patch code surgically     │
                                 │ 7. Git commit winning iter   │
                                 │ 8. Repeat until ≥ target     │
                                 └──────────────────────────────┘
```

## Installation

```bash
# 1. Copy the files to ~/.claude/
cp CLAUDE.md ~/.claude/CLAUDE.md
cp -r ui-autoresearch/ ~/.claude/ui-autoresearch/

# 2. Make the runner executable
chmod +x ~/.claude/ui-autoresearch/run.sh

# 3. Ensure Playwright is installed in your projects
# (in each project that uses this)
npx playwright install chromium
```

## Usage

Run from any project root:

```bash
# Start your dev server first
npm run dev &

# Full run (all viewports, both themes)
~/.claude/ui-autoresearch/run.sh \
  --url http://localhost:3000/dashboard \
  --component DashboardCard \
  --file src/components/dashboard/card.tsx

# Quick iteration (desktop dark only — fastest)
~/.claude/ui-autoresearch/run.sh \
  --url http://localhost:3000/dashboard \
  --component DashboardCard \
  --file src/components/dashboard/card.tsx \
  --desktop-only --dark-only

# Dry run (score only, don't apply changes)
~/.claude/ui-autoresearch/run.sh \
  --url http://localhost:3000/settings \
  --component SettingsPage \
  --file src/app/settings/page.tsx \
  --dry-run

# Target a specific element
~/.claude/ui-autoresearch/run.sh \
  --url http://localhost:3000/dashboard \
  --component StatsCard \
  --file src/components/stats-card.tsx \
  --selector "[data-testid='stats-card']"

# Higher bar, more iterations
~/.claude/ui-autoresearch/run.sh \
  --url http://localhost:3000/dashboard \
  --component DashboardCard \
  --file src/components/dashboard/card.tsx \
  --target-score 9.5 --max-iters 12

# Full help
~/.claude/ui-autoresearch/run.sh --help
```

## Manual Mode (No Automation)

The rubric in `~/.claude/CLAUDE.md` works as a standalone self-check in Claude CLI. After building any UI:

```
Score the component at src/components/my-component.tsx against the
11/10 UI rubric in CLAUDE.md. For each of the 7 dimensions, give a
score (1-10) and cite specific evidence from the code. List the top
3 improvements that would increase the lowest scores. Then implement
them and re-score.
```

This alone cuts iteration cycles significantly — the structured rubric forces Claude to evaluate systematically instead of vaguely saying "looks good."

## Scoring Dimensions

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 1 | Spatial Rhythm | 1.5x | Padding, spacing, breathing room |
| 2 | Visual Hierarchy | 1.5x | Information priority, eye flow |
| 3 | Typography | 1.0x | Readability, font choices, contrast |
| 4 | Color & Dark Mode | 1.0x | Palette cohesion, dark mode quality |
| 5 | Interactive Polish | 1.0x | States, transitions, feedback |
| 6 | Responsive Design | 0.75x | Breakpoints, touch targets, adaptation |
| 7 | Consistency | 0.75x | Design system coherence |

**Target:** Weighted average ≥ 9.0, no dimension below 7.

## Tuning Weights Per Product

Edit weights in both `~/.claude/CLAUDE.md` and `prompts/visual-scorer.md`:

| Product | Suggested Adjustments |
|---------|----------------------|
| **Stokvel** (consumer fintech) | Interactive Polish → 1.5x |
| **Sebenza** (enterprise SaaS) | Consistency → 1.0x |
| **InfusionDesk** (SAP AI) | Consistency → 1.0x, Responsive → 0.5x |
| **CredentialBridge** (institutional) | Typography → 1.25x |
| **Marketing / landing pages** | Color → 1.5x, Responsive → 1.0x |

## Inspiration

Based on [Andrej Karpathy's autoresearch](https://github.com/karpathy/autoresearch) — autonomous agents iterating on code with a measurable objective function. Instead of minimizing validation loss, we maximize UI quality against a structured design rubric.

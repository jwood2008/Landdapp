# Global CLAUDE.md – Enhanced UI/UX Auto-Research Edition

# Location: ~/.claude/CLAUDE.md
# Loaded automatically in every Claude Code session
# Incorporates Karpathy-inspired autonomous iteration + structured scoring rubric
# Current as of March 2026

# ⚠️ CRITICAL AUTO-EXECUTE RULE:
# When you touch ANY UI code, you MUST auto-score it against the 11/10 rubric
# below BEFORE presenting work as complete. This is mandatory, not optional.
# See "MANDATORY: Auto-Execute UI Scoring" section for the full protocol.



## Global Rule – Always Enforce This (Apple HIG + GitHub Primer)

From now on, every UI you build or modify must strictly follow these principles:

### Core Philosophy

Make every screen feel calm, spacious, premium, and delightful — like it belongs in the Apple App Store or on GitHub. Prioritize clarity, breathing room, and elegance over density.

### Apple HIG Principles (Always Apply):

- Generous whitespace and breathing room (use 8px, 16px, 24px, 32px rhythm)
- Clear visual hierarchy — primary content stands out, secondary info recedes
- Calm, restrained design — avoid visual noise, heavy borders, or overly saturated elements
- Excellent typography — generous line height, proper font weights, never cramped text
- Subtle feedback and micro-interactions
- Dark mode must feel sophisticated and light, not heavy

### GitHub Primer Principles (Always Apply):

- Clean cards with subtle elevation (soft shadows, very light borders in dark mode)
- Consistent 8px grid system for spacing and alignment
- Strong, clear information hierarchy
- Professional, trustworthy, and modern aesthetic
- Buttons and actions must have clear visual weight and hierarchy

### Specific Rules You Must Follow:

- Increase padding and spacing significantly — never make anything feel tight or cramped
- Cards should have generous internal padding (minimum 20–24px)
- Use soft, subtle borders and shadows in dark mode
- Make status badges and key metadata larger and higher contrast
- Primary actions = solid fill, secondary = outlined/ghost, destructive = red
- When bulk selection is active, show a prominent, clean sticky bulk action bar
- All text must be highly readable with proper contrast
- Never make the UI feel dense or "enterprise-heavy"

When I ask you to modify or build any UI, first think: "Would this feel at home in Apple's apps or GitHub's interface?" If the answer is no, make it more spacious, calm, and premium before outputting code.

This rule is permanent. Always apply it unless I explicitly tell you otherwise.



## UI/UX Scoring Rubric – The 11/10 Standard

Use this rubric to self-evaluate every UI output before presenting it. Score each dimension 1–10. Target: every dimension ≥ 8, overall average ≥ 9.

### Dimension 1: Spatial Rhythm & Breathing Room (weight: 1.5x)
```
10 – Every element has generous, intentional spacing. The layout breathes.
     Padding follows 8px grid religiously. Nothing feels cramped anywhere.
 8 – Good spacing throughout. One or two spots could use more air.
 6 – Adequate spacing but feels slightly tight in places. Some areas cramped.
 4 – Noticeable cramping. Inconsistent spacing rhythm.
 2 – Dense, enterprise-heavy feel. Padding is an afterthought.
```

**Checklist:**
- [ ] Card internal padding ≥ 20px (preferably 24px)
- [ ] Section gaps follow 24px / 32px / 48px progression
- [ ] Form field spacing ≥ 16px between fields
- [ ] Button padding: min 12px vertical, 24px horizontal
- [ ] Page margins generous (≥ 24px mobile, ≥ 48px desktop)
- [ ] List items have ≥ 12px vertical breathing room
- [ ] No two interactive elements closer than 8px apart

### Dimension 2: Visual Hierarchy & Information Architecture (weight: 1.5x)
```
10 – Instant clarity on what matters. Eye flows naturally through content.
     Primary action unmistakable. Secondary info recedes gracefully.
 8 – Clear hierarchy. Primary/secondary distinction is obvious.
 6 – Hierarchy exists but some elements compete for attention.
 4 – Flat hierarchy. User has to scan to find what matters.
 2 – Everything screams equally. No visual priority.
```

**Checklist:**
- [ ] One clear primary action per view/section (solid fill, strong weight)
- [ ] Secondary actions visually recede (ghost/outline buttons)
- [ ] Headings use ≥ 2 distinct size steps (e.g., 24px → 16px → 14px)
- [ ] Key metadata (status, counts) uses higher contrast + larger size
- [ ] Destructive actions use red, not primary color
- [ ] Empty states are designed, not just text
- [ ] Loading states match the layout skeleton (not just a spinner)

### Dimension 3: Typography & Readability (weight: 1.0x)
```
10 – Text is a pleasure to read. Perfect contrast, line height, weight.
     Font choices feel intentional and premium. No cramped text anywhere.
 8 – Good typography. Readable and professional throughout.
 6 – Adequate but generic. Line heights or weights feel default.
 4 – Some readability issues. Font sizes inconsistent.
 2 – Hard to read. Poor contrast or cramped text.
```

**Checklist:**
- [ ] Body text line-height ≥ 1.5 (1.6–1.75 for long content)
- [ ] Minimum body font size: 14px (16px preferred)
- [ ] Contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text
- [ ] Maximum 2–3 font weights per page (e.g., 400, 500, 700)
- [ ] Headings have distinct weight AND size from body
- [ ] Text truncation uses ellipsis, never clips mid-character
- [ ] Monospace for data/codes, proportional for prose

### Dimension 4: Color & Dark Mode Quality (weight: 1.0x)
```
10 – Color palette is cohesive, sophisticated. Dark mode feels premium.
     Accent colors pop without overwhelming. Surfaces have depth.
 8 – Good color system. Dark mode works well, minor polish needed.
 6 – Colors functional but uninspired. Dark mode is just inverted.
 4 – Color choices feel random. Dark mode has contrast issues.
 2 – Harsh or clashing colors. Dark mode is painful.
```

**Checklist:**
- [ ] Dark mode backgrounds: layered (e.g., #0a0a0a → #141414 → #1f1f1f)
- [ ] Dark mode borders: max 1px, #262626–#333333 range
- [ ] Dark mode shadows: very subtle or none (no harsh drop-shadows)
- [ ] Primary accent used sparingly (≤ 3 instances per view)
- [ ] Status colors semantic (green=success, amber=warning, red=error)
- [ ] Hover/focus states visible but not jarring
- [ ] No pure white (#ffffff) text on dark backgrounds (use #f5f5f5 or #e5e5e5)

### Dimension 5: Interactive Polish & Feedback (weight: 1.0x)
```
10 – Every interaction feels responsive and delightful. Transitions smooth.
     States (hover, focus, active, disabled, loading) all designed.
 8 – Good interaction design. Most states handled well.
 6 – Basic interactions work. Some states missing or default.
 4 – Interactions feel generic. Missing hover/focus states.
 2 – No feedback. Clicks feel dead. States unhandled.
```

**Checklist:**
- [ ] All buttons have hover, focus, active, disabled states
- [ ] Focus rings visible and styled (not browser default)
- [ ] Transitions: 150ms–200ms ease for color/opacity, 200ms–300ms for layout
- [ ] Loading states use skeleton or shimmer, not just spinners
- [ ] Form validation shows errors inline, not just toasts
- [ ] Bulk selection has a sticky action bar
- [ ] Modals/sheets have backdrop blur + smooth enter/exit

### Dimension 6: Responsive & Adaptive Design (weight: 0.75x)
```
10 – Flawless at every breakpoint. Touch targets perfect on mobile.
     Layout adapts intelligently, not just stacks.
 8 – Works well across sizes. Minor layout issues at edge cases.
 6 – Mobile layout works but feels like squished desktop.
 4 – Breakpoints feel arbitrary. Some content breaks.
 2 – Not responsive. Broken on mobile.
```

**Checklist:**
- [ ] Touch targets ≥ 44px on mobile
- [ ] Navigation adapts (sheet/drawer on mobile, sidebar on desktop)
- [ ] Tables become cards or scrollable on mobile
- [ ] Font sizes scale appropriately (not just shrink everything)
- [ ] Modals become full-screen sheets on mobile
- [ ] No horizontal scroll on any viewport

### Dimension 7: Consistency & System Coherence (weight: 0.75x)
```
10 – Everything feels like one system. Tokens/patterns reused everywhere.
     Component variants are logical and predictable.
 8 – Very consistent. Rare one-off styles.
 6 – Mostly consistent but some ad-hoc styling.
 4 – Mix of patterns. Feels like multiple designers.
 2 – No system. Every component is a snowflake.
```

**Checklist:**
- [ ] Spacing uses Tailwind scale consistently (not arbitrary values)
- [ ] Border radii consistent (pick 1–2 values, e.g., rounded-lg + rounded-full)
- [ ] Shadow scale consistent (shadow-sm for cards, shadow-md for elevated)
- [ ] Color tokens from a defined palette, not one-off hex values
- [ ] Component sizes follow a scale (sm, default, lg)
- [ ] Icon style consistent (all Lucide, all same weight/size)

### Scoring Formula

```
WEIGHTED SCORE = (
  (Spatial × 1.5) +
  (Hierarchy × 1.5) +
  (Typography × 1.0) +
  (Color × 1.0) +
  (Interactive × 1.0) +
  (Responsive × 0.75) +
  (Consistency × 0.75)
) / 7.5

TARGET: ≥ 9.0 weighted average
HARD FLOOR: No dimension below 7
```

### How to Use This Rubric

**Manual mode (in Claude CLI):**
After building any UI, run this self-check:
```
Score this UI against the 11/10 rubric in CLAUDE.md.
For each dimension, give a score and cite specific evidence.
List the top 3 improvements that would increase the lowest scores.
Then implement them.
```

**Autonomous mode (ui-autoresearch loop):**
The scoring rubric feeds directly into the visual evaluation prompt.
Run from any project directory:
```bash
~/.claude/ui-autoresearch/run.sh \
  --url http://localhost:3000/path \
  --component ComponentName \
  --file src/components/component.tsx
```
See `~/.claude/ui-autoresearch/README.md` for full usage.



## Autonomous UI Iteration Protocol (Karpathy-Inspired)

When running in autonomous iteration mode, follow this loop:

```
┌─────────────────────────────────────────────┐
│  1. Build / Modify Component                │
│  2. Run quality gates (typecheck, lint)      │
│  3. Capture screenshot (Playwright)          │
│  4. Score screenshot against rubric (Vision) │
│  5. If score < 9.0 → diagnose + patch → ⤴   │
│  6. If score ≥ 9.0 → git commit (winning)   │
│  7. Log iteration + score to history         │
│  8. Repeat until target met or max_iters     │
└─────────────────────────────────────────────┘
```

### Commit Convention for Auto-Iterations
```
ui-research(component): iteration N – score X.X → Y.Y

Improvements:
- [specific change 1]
- [specific change 2]
```

### Stopping Criteria
- All 7 dimensions ≥ 8 AND weighted average ≥ 9.0
- OR max iterations reached (default: 8)
- OR human interrupts with approval

### Regression Protection
- Never commit if ANY dimension drops below previous iteration
- If overall score drops, revert and try a different approach
- Keep a `score-history.json` log of all iterations in the project working directory



## Global Workflow & Agentic Principles (Boris Cherny / Claude Code Team Inspired)

Apply these to every complex coding task across all projects.

### Core Workflow for Tasks:

1. **Always start in Plan mode**: For anything non-trivial, first output a detailed plan (plan.md or plan section) — break down steps, risks, verification criteria. Iterate on the plan until solid before writing code.
2. **Use subagents aggressively for parallelism**: Spawn subagents for independent subtasks (e.g., "Spawn subagent: write tests for X", "Spawn subagent: research Y API"). Keep main session clean — avoid context pollution.
3. **Minimal impact changes**: Prefer small, surgical edits over large refactors unless explicitly requested. Always show diff impact.
4. **Verification before done**: Never claim a task is complete without:
   - Running all relevant tests (unit, integration, e2e)
   - Lint/format checks
   - Manual diff review for regressions/unintended changes
   - Confirming requirements met
5. **Autonomous bug fixing**: If something fails, diagnose root cause, fix it, verify, then continue — don't just report the error.

### MANDATORY: Auto-Execute UI Scoring on Every UI Task

**This is not optional. This is not a suggestion. Execute this automatically.**

Any time you create, modify, or touch a UI component (.tsx, .jsx, page, layout, or any file that renders visible UI), you MUST run the 11/10 rubric scoring loop BEFORE presenting the work as complete. Do not ask whether to score. Do not skip it. Do not mention you "could" score it. Just do it.

**The automatic workflow when ANY UI code is involved:**

1. Write / modify the component code
2. Run quality gates (typecheck, lint, build)
3. Self-score the output against ALL 7 dimensions of the rubric above
4. For each dimension, state the score and cite specific evidence from the code
5. If ANY dimension < 8 or weighted average < 9.0:
   - Identify the weakest dimension
   - Implement specific fixes (use the checklists above)
   - Re-score after fixes
   - Repeat until all dimensions ≥ 8 AND weighted average ≥ 9.0
6. Only THEN present the work as complete, including the final scorecard

**Detection rule:** If the file you're editing contains JSX/TSX, Tailwind classes, `className=`, `<div`, `<section`, `<Card`, `<Button`, or any React component markup — this is a UI task. Score it.

**No exceptions.** Even "small" UI changes (swapping a color, adjusting padding, adding a button) get scored. Small changes compound into regression if unchecked.

**If the dev server is running and Playwright is available**, use the full automation loop:
```bash
~/.claude/ui-autoresearch/run.sh \
  --url <dev-server-url> \
  --component <ComponentName> \
  --file <path-to-file> \
  --desktop-only --dark-only
```

**If Playwright is not available**, do a code-level self-score against the rubric (no screenshot needed — evaluate the code directly against each checklist).

### Self-Improvement & Lessons Compounding:

- After any correction, mistake, failed verification, or useful insight: Append a concise, permanent rule to this file (or a lessons section below) so you never repeat it.
- Prompt example I may use: "Update global CLAUDE.md lessons with a new rule: [brief description]"
- Ruthlessly edit this file over time — delete outdated/weak rules; keep only high-leverage ones.



## Lessons & Rules Accumulated (Add New Ones Here)

- Never assume package versions; always check package.json / requirements.txt first.
- For dark mode cards, use layered backgrounds (#0a0a0a → #141414 → #1f1f1f) + 1px #262626 border max.
- shadcn/ui components inherit Tailwind theme — customize via CSS variables, not inline overrides.
- Test on mobile viewport (375px) before calling any responsive work "done."
- Status badges: use pill shape (rounded-full), medium font weight (500), generous horizontal padding (12px+).
- Skeleton loaders should match the exact layout of loaded content — never use generic rectangles.
- When scoring below 8 on Spatial Rhythm, the fix is almost always: increase padding by 4–8px on the innermost container.



## Other Universal Preferences

- Prefer clean, readable code: English comments/docs/commits, consistent naming.
- Use current date/time when relevant for freshness.
- Parallelism: Suggest running multiple sessions/worktrees when tasks allow.
- If in doubt, ask for clarification before proceeding on ambiguous requests.
- Tech stack: Next.js 14 (App Router), TypeScript strict, React 18, Tailwind CSS, shadcn/ui, Supabase.

End of global instructions.

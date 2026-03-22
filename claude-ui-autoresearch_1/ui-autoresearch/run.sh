#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# UI Auto-Research: Iteration Runner
# ═══════════════════════════════════════════════════════════════════
#
# Location: ~/.claude/ui-autoresearch/run.sh
# Runs from ANY project directory — all tool paths resolve globally.
# Captures and score history are written to the current project.
#
# Usage (from any project root):
#   ~/.claude/ui-autoresearch/run.sh \
#     --url http://localhost:3000/dashboard \
#     --component DashboardCard \
#     --file src/components/dashboard-card.tsx
#
# Prerequisites:
#   - Dev server running (next dev)
#   - Playwright installed in the project (npx playwright install chromium)
#   - Claude Code CLI available (claude)
#
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Global Paths ─────────────────────────────────────────────────
# All tooling lives at ~/.claude/ui-autoresearch/
# Captures + score history live in the current project directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="${SCRIPT_DIR}/prompts"
CAPTURE_SCRIPT="${SCRIPT_DIR}/capture.ts"
PROJECT_DIR="$(pwd)"
LOCAL_RESEARCH_DIR="${PROJECT_DIR}/.ui-autoresearch"

# ─── Defaults ─────────────────────────────────────────────────────

MAX_ITERATIONS=8
TARGET_SCORE=9.0
HARD_FLOOR=7
BRANCH_PREFIX="ui-research"
CAPTURE_WAIT_MS=1500
VIEWPORTS="all"       # all | desktop-only | mobile-only
COLOR_SCHEME="all"    # all | dark-only | light-only

# ─── Parse Arguments ──────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case $1 in
    --url)           URL="$2";            shift 2 ;;
    --component)     COMPONENT="$2";      shift 2 ;;
    --file)          COMPONENT_FILE="$2"; shift 2 ;;
    --selector)      SELECTOR="$2";       shift 2 ;;
    --max-iters)     MAX_ITERATIONS="$2"; shift 2 ;;
    --target-score)  TARGET_SCORE="$2";   shift 2 ;;
    --hard-floor)    HARD_FLOOR="$2";     shift 2 ;;
    --desktop-only)  VIEWPORTS="desktop-only"; shift ;;
    --mobile-only)   VIEWPORTS="mobile-only";  shift ;;
    --dark-only)     COLOR_SCHEME="dark-only";  shift ;;
    --no-branch)     NO_BRANCH=1;         shift ;;
    --dry-run)       DRY_RUN=1;           shift ;;
    --help|-h)
      echo "UI Auto-Research — Karpathy-inspired autonomous UI iteration"
      echo ""
      echo "Usage: ~/.claude/ui-autoresearch/run.sh [options]"
      echo ""
      echo "Required:"
      echo "  --url <url>           Dev server URL for the component"
      echo "  --component <name>    Component name (used for branch/logs)"
      echo "  --file <path>         Path to the component source file (relative to project)"
      echo ""
      echo "Options:"
      echo "  --selector <css>      CSS selector to capture (default: full page)"
      echo "  --max-iters <n>       Maximum iterations (default: 8)"
      echo "  --target-score <n>    Target weighted average (default: 9.0)"
      echo "  --hard-floor <n>      Minimum per-dimension score (default: 7)"
      echo "  --desktop-only        Only capture desktop viewport"
      echo "  --mobile-only         Only capture mobile viewport"
      echo "  --dark-only           Only capture dark mode"
      echo "  --no-branch           Don't create a git branch"
      echo "  --dry-run             Score only, don't apply changes"
      echo ""
      echo "Global tooling:  ${SCRIPT_DIR}/"
      echo "Project output:  .ui-autoresearch/ (in current directory)"
      exit 0
      ;;
    *)               echo "Unknown option: $1. Use --help for usage."; exit 1 ;;
  esac
done

# Validate required args
if [[ -z "${URL:-}" || -z "${COMPONENT:-}" || -z "${COMPONENT_FILE:-}" ]]; then
  echo "Missing required arguments. Use --help for usage."
  exit 1
fi

# Validate component file exists
if [[ ! -f "${PROJECT_DIR}/${COMPONENT_FILE}" ]]; then
  echo "✗ Component file not found: ${PROJECT_DIR}/${COMPONENT_FILE}"
  exit 1
fi

# ─── Setup Project-Local Output ──────────────────────────────────

mkdir -p "${LOCAL_RESEARCH_DIR}/captures/${COMPONENT}"

SCORES_FILE="${LOCAL_RESEARCH_DIR}/score-history-${COMPONENT}.json"

# Initialize score history if needed
if [[ ! -f "$SCORES_FILE" ]]; then
  echo '{"component":"'"$COMPONENT"'","project":"'"$PROJECT_DIR"'","iterations":[]}' > "$SCORES_FILE"
fi

# Add .ui-autoresearch to .gitignore if not already there
if [[ -f "${PROJECT_DIR}/.gitignore" ]]; then
  grep -qxF '.ui-autoresearch/' "${PROJECT_DIR}/.gitignore" 2>/dev/null || \
    echo '.ui-autoresearch/' >> "${PROJECT_DIR}/.gitignore"
fi

# Create git branch for research
if [[ -z "${NO_BRANCH:-}" ]]; then
  BRANCH="${BRANCH_PREFIX}/${COMPONENT}/$(date +%Y%m%d-%H%M)"
  git checkout -b "$BRANCH" 2>/dev/null || true
  echo "🌿 Working on branch: $BRANCH"
fi

# Build capture flags
CAPTURE_FLAGS="--url $URL --component $COMPONENT --wait-ms $CAPTURE_WAIT_MS"
CAPTURE_FLAGS="$CAPTURE_FLAGS --output-dir ${LOCAL_RESEARCH_DIR}/captures/${COMPONENT}"
[[ -n "${SELECTOR:-}" ]] && CAPTURE_FLAGS="$CAPTURE_FLAGS --selector $SELECTOR"
[[ "$VIEWPORTS" == "desktop-only" ]] && CAPTURE_FLAGS="$CAPTURE_FLAGS --desktop-only"
[[ "$VIEWPORTS" == "mobile-only" ]] && CAPTURE_FLAGS="$CAPTURE_FLAGS --mobile-only"
[[ "$COLOR_SCHEME" == "dark-only" ]] && CAPTURE_FLAGS="$CAPTURE_FLAGS --dark-only"

# ─── Utility Functions ────────────────────────────────────────────

log() {
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  $1"
  echo "═══════════════════════════════════════════════════════"
  echo ""
}

check_quality_gates() {
  log "Running quality gates..."

  echo "  → TypeScript check..."
  npx tsc --noEmit 2>&1 || { echo "  ✗ TypeScript errors found"; return 1; }
  echo "  ✓ TypeScript OK"

  echo "  → ESLint check..."
  npx eslint "$COMPONENT_FILE" --quiet 2>&1 || { echo "  ✗ Lint errors found"; return 1; }
  echo "  ✓ Lint OK"

  echo "  ✓ All quality gates passed"
  return 0
}

capture_screenshots() {
  local iteration=$1
  log "Capturing screenshots (iteration $iteration)..."

  npx tsx "${CAPTURE_SCRIPT}" \
    $CAPTURE_FLAGS \
    --iteration "$iteration" \
    2>&1
}

score_screenshots() {
  local iteration=$1
  local capture_dir="${LOCAL_RESEARCH_DIR}/captures/${COMPONENT}/iteration-${iteration}"

  log "Scoring screenshots (iteration $iteration)..."

  # Find the primary screenshot (desktop dark mode preferred)
  local primary_screenshot
  primary_screenshot=$(ls "$capture_dir"/dark-desktop-*.png 2>/dev/null | head -1)

  if [[ -z "$primary_screenshot" ]]; then
    primary_screenshot=$(ls "$capture_dir"/*.png 2>/dev/null | head -1)
  fi

  if [[ -z "$primary_screenshot" ]]; then
    echo "  ✗ No screenshots found in $capture_dir"
    return 1
  fi

  echo "  Scoring: $(basename "$primary_screenshot")"

  # Read the scoring prompt from global location
  local scorer_prompt
  scorer_prompt=$(cat "${PROMPTS_DIR}/visual-scorer.md")

  # Use Claude CLI to score the screenshot with vision
  local score_output
  score_output=$(claude -p \
    --image "$primary_screenshot" \
    "$scorer_prompt" \
    2>/dev/null)

  # Parse and save scores
  echo "$score_output" > "${capture_dir}/scores.json"

  # Extract weighted average
  local weighted_avg
  weighted_avg=$(echo "$score_output" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('weighted_average', 0))
except:
    print(0)
  ")

  echo "  → Weighted average: $weighted_avg"

  # Check hard floor
  local below_floor
  below_floor=$(echo "$score_output" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    scores = data.get('scores', {})
    below = [k for k, v in scores.items() if v.get('score', 0) < $HARD_FLOOR]
    print(','.join(below) if below else 'none')
except:
    print('error')
  ")

  if [[ "$below_floor" != "none" ]]; then
    echo "  ⚠ Dimensions below hard floor ($HARD_FLOOR): $below_floor"
  fi

  # Update score history
  python3 -c "
import json
with open('$SCORES_FILE', 'r') as f:
    history = json.load(f)
with open('${capture_dir}/scores.json', 'r') as f:
    scores = json.load(f)
history['iterations'].append({
    'iteration': $iteration,
    'weighted_average': scores.get('weighted_average', 0),
    'scores': {k: v.get('score', 0) for k, v in scores.get('scores', {}).items()},
    'screenshot': '$(basename "$primary_screenshot")'
})
with open('$SCORES_FILE', 'w') as f:
    json.dump(history, f, indent=2)
  "

  echo "$weighted_avg"
}

diagnose_and_patch() {
  local iteration=$1
  local capture_dir="${LOCAL_RESEARCH_DIR}/captures/${COMPONENT}/iteration-${iteration}"

  log "Diagnosing improvements (iteration $iteration)..."

  # Read current component code
  local component_code
  component_code=$(cat "${PROJECT_DIR}/${COMPONENT_FILE}")

  # Read current scores
  local current_scores
  current_scores=$(cat "${capture_dir}/scores.json")

  # Read score history
  local score_history
  score_history=$(cat "$SCORES_FILE")

  # Read the diagnosis prompt from global location
  local diagnosis_prompt
  diagnosis_prompt=$(cat "${PROMPTS_DIR}/improvement-diagnosis.md")

  # Build the full prompt
  local full_prompt="$diagnosis_prompt

## Current Component Code

\`\`\`tsx
$component_code
\`\`\`

## Current Scores

$current_scores

## Score History

$score_history

Generate the improvement changes now. All file paths should be relative to the project root: ${COMPONENT_FILE}"

  # Get diagnosis from Claude
  local diagnosis_output
  diagnosis_output=$(claude -p "$full_prompt" 2>/dev/null)

  echo "$diagnosis_output" > "${capture_dir}/diagnosis.json"

  if [[ -n "${DRY_RUN:-}" ]]; then
    echo "  [DRY RUN] Would apply changes from diagnosis:"
    echo "$diagnosis_output" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for c in data.get('changes', []):
        print(f\"  → {c.get('description', 'unknown change')}\")
except:
    print('  Could not parse diagnosis')
    "
    return 0
  fi

  # Apply the changes
  echo "$diagnosis_output" | python3 -c "
import sys, json, os

data = json.load(sys.stdin)
changes = data.get('changes', [])
project = '${PROJECT_DIR}'

for change in changes:
    filepath = change.get('file', '')
    search = change.get('search', '')
    replace = change.get('replace', '')
    desc = change.get('description', 'unknown')

    if not filepath or not search:
        print(f'  ⚠ Skipping invalid change: {desc}')
        continue

    # Resolve relative paths against project root
    full_path = os.path.join(project, filepath) if not os.path.isabs(filepath) else filepath

    try:
        with open(full_path, 'r') as f:
            content = f.read()

        if search not in content:
            print(f'  ⚠ Search string not found for: {desc}')
            continue

        content = content.replace(search, replace, 1)

        with open(full_path, 'w') as f:
            f.write(content)

        print(f'  ✓ Applied: {desc}')
    except Exception as e:
        print(f'  ✗ Error applying {desc}: {e}')
  "
}

check_regression() {
  local current_iteration=$1

  if [[ $current_iteration -lt 1 ]]; then
    return 0
  fi

  local prev_dir="${LOCAL_RESEARCH_DIR}/captures/${COMPONENT}/iteration-$((current_iteration - 1))"
  local curr_dir="${LOCAL_RESEARCH_DIR}/captures/${COMPONENT}/iteration-${current_iteration}"

  python3 -c "
import json, sys

prev_scores = json.load(open('${prev_dir}/scores.json'))
curr_scores = json.load(open('${curr_dir}/scores.json'))

regressions = []
for dim, prev_val in prev_scores.get('scores', {}).items():
    curr_val = curr_scores.get('scores', {}).get(dim, {})
    if curr_val.get('score', 0) < prev_val.get('score', 0):
        regressions.append(f'{dim}: {prev_val[\"score\"]} → {curr_val[\"score\"]}')

if regressions:
    print('REGRESSION')
    for r in regressions:
        print(f'  ⚠ {r}')
else:
    print('OK')
  "
}

commit_iteration() {
  local iteration=$1
  local prev_score=$2
  local curr_score=$3

  git add -A 2>/dev/null || true
  git commit -m "ui-research(${COMPONENT}): iteration ${iteration} – score ${prev_score} → ${curr_score}

Auto-iterated by ui-autoresearch loop.
See .ui-autoresearch/captures/${COMPONENT}/iteration-${iteration}/ for details." 2>/dev/null || true

  echo "  ✓ Committed iteration $iteration"
}

# ─── Main Loop ────────────────────────────────────────────────────

log "UI Auto-Research: Starting for ${COMPONENT}"
echo "  Target score: ≥ ${TARGET_SCORE}"
echo "  Hard floor:   ≥ ${HARD_FLOOR} per dimension"
echo "  Max iters:    ${MAX_ITERATIONS}"
echo "  Component:    ${COMPONENT_FILE}"
echo "  URL:          ${URL}"
echo "  Project:      ${PROJECT_DIR}"
echo "  Tooling:      ${SCRIPT_DIR}"
echo "  Output:       ${LOCAL_RESEARCH_DIR}"

PREV_SCORE="0.0"
CURRENT_SCORE="0.0"

for ((i=0; i<MAX_ITERATIONS; i++)); do
  log "ITERATION $i / $MAX_ITERATIONS"

  # Step 1: Quality gates
  if ! check_quality_gates; then
    echo "  ✗ Quality gates failed. Attempting auto-fix..."
    claude -p "Fix the TypeScript and ESLint errors in ${COMPONENT_FILE}. Make minimal changes." 2>/dev/null

    if ! check_quality_gates; then
      echo "  ✗ Still failing after auto-fix. Stopping."
      break
    fi
  fi

  # Step 2: Capture screenshots
  capture_screenshots "$i"

  # Step 3: Score
  CURRENT_SCORE=$(score_screenshots "$i")

  echo ""
  echo "  📊 Score: $PREV_SCORE → $CURRENT_SCORE (target: $TARGET_SCORE)"

  # Step 4: Check if target met
  TARGET_MET=$(python3 -c "print('yes' if float('$CURRENT_SCORE') >= float('$TARGET_SCORE') else 'no')")

  if [[ "$TARGET_MET" == "yes" ]]; then
    log "🎉 TARGET REACHED! Score: $CURRENT_SCORE ≥ $TARGET_SCORE"
    commit_iteration "$i" "$PREV_SCORE" "$CURRENT_SCORE"
    break
  fi

  # Step 5: Check for regression
  if [[ $i -gt 0 ]]; then
    REGRESSION_CHECK=$(check_regression "$i")
    if [[ "$REGRESSION_CHECK" == REGRESSION* ]]; then
      echo "$REGRESSION_CHECK"
      echo "  Reverting to previous iteration..."
      git checkout -- "$COMPONENT_FILE" 2>/dev/null || true
      echo "  Retrying with different approach..."
    fi
  fi

  # Step 6: Commit progress
  if [[ -z "${NO_BRANCH:-}" && $i -gt 0 ]]; then
    commit_iteration "$i" "$PREV_SCORE" "$CURRENT_SCORE"
  fi

  # Step 7: Diagnose and patch
  diagnose_and_patch "$i"

  PREV_SCORE="$CURRENT_SCORE"

  echo ""
  echo "  ⏳ Waiting for dev server hot reload..."
  sleep 3
done

# ─── Summary ──────────────────────────────────────────────────────

log "UI Auto-Research: Complete"
echo ""
echo "  Component:   $COMPONENT"
echo "  Iterations:  $((i + 1))"
echo "  Final score: $CURRENT_SCORE"
echo "  Target:      $TARGET_SCORE"
echo ""
echo "  Score history: $SCORES_FILE"
echo "  Captures:      ${LOCAL_RESEARCH_DIR}/captures/${COMPONENT}/"
echo ""

if [[ -z "${NO_BRANCH:-}" ]]; then
  echo "  Branch: $BRANCH"
  echo "  To merge: git checkout main && git merge $BRANCH"
fi

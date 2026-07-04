#!/usr/bin/env bash
# ultraqa-cron.sh — one bounded UltraQA chunk, for a durable (crontab) continuous run.
#
# Runs a small batch of taxonomy cells (paged by the persisted cursor), so an
# hourly crontab entry pages through the whole taxonomy and loops — the real
# "continuous QA" campaign that survives session restarts.
#
# SELF-LIMITING: stops running once ~/hima-sandbox/.ultraqa-deadline (epoch secs)
# has passed, so the campaign auto-ends (default 48h from install). The crontab
# line then no-ops until removed.
#
# KILL SWITCH:  rm ~/hima-sandbox/.ultraqa-deadline   (or: crontab -e and delete the line)
#
# Install (hourly, off-minute):  (crontab -l 2>/dev/null; echo "13 * * * * /Users/maache/hima/scripts/ultraqa-cron.sh") | crontab -
set -uo pipefail

SANDBOX="$HOME/hima-sandbox"
DEADLINE_FILE="$SANDBOX/.ultraqa-deadline"
LOG="$SANDBOX/ultraqa-cron.log"
CELLS_PER_RUN="${ULTRAQA_CELLS:-1}"   # keep cost + wall-time bounded per hourly run

mkdir -p "$SANDBOX"
now=$(date +%s)
deadline=$(cat "$DEADLINE_FILE" 2>/dev/null || echo 0)
if [ "$now" -gt "$deadline" ]; then
  echo "[$(date)] past deadline ($deadline) — skipping (remove crontab line to clean up)" >> "$LOG"
  exit 0
fi

export CLAUDE_CONFIG_DIR="$SANDBOX/claude-config"
echo "[$(date)] chunk start (max $CELLS_PER_RUN)" >> "$LOG"
node /Users/maache/hima/scripts/ultraqa.mjs --max "$CELLS_PER_RUN" --timeout 170 >> "$LOG" 2>&1
echo "[$(date)] chunk done (exit $?)" >> "$LOG"

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

# cron runs with a minimal PATH that lacks node/codex/claude/hima. Pin absolute
# locations so the campaign works headless outside any shell/cmux session.
NODE_BIN="/Users/maache/.local/share/fnm/node-versions/v22.21.0/installation/bin/node"
[ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node || echo node)"
export PATH="/Users/maache/.local/bin:/opt/homebrew/bin:$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin"

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
# CODEX-ONLY under cron: verified 2026-07-05 that a cron-spawned (detached, no
# keychain) process gets "Not logged in" for Claude, but `codex exec` authenticates
# fine headless. So the durable campaign runs codex cells; claude cells need an
# interactive session (run scripts/ultraqa.mjs --runtime claude by hand for those).
echo "[$(date)] chunk start (max $CELLS_PER_RUN, codex)" >> "$LOG"
"$NODE_BIN" /Users/maache/hima/scripts/ultraqa.mjs --max "$CELLS_PER_RUN" --runtime codex --timeout 170 >> "$LOG" 2>&1
echo "[$(date)] chunk done (exit $?)" >> "$LOG"

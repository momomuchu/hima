#!/usr/bin/env bash
# install-hima.sh — put a working `hima` on your PATH.
#
# hima is a pnpm monorepo whose CLI (`@hima/cli`) depends on sibling workspace
# packages, so it cannot be `npm i -g`'d as-is. Instead this links the built
# binary onto your PATH: Node resolves the CLI's dependencies from the repo's
# node_modules via the symlink's real path, so `hima` works from any directory
# as long as this repo stays in place (a local "dev link" install).
#
# Usage:
#   bash scripts/install-hima.sh            # links into ~/.local/bin
#   HIMA_BIN_DIR=/usr/local/bin bash scripts/install-hima.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_ENTRY="$REPO_ROOT/packages/hima-cli/dist/index.js"
BIN_DIR="${HIMA_BIN_DIR:-$HOME/.local/bin}"

echo "[install-hima] building…"
( cd "$REPO_ROOT" && pnpm build )

if [ ! -f "$CLI_ENTRY" ]; then
  echo "[install-hima] ERROR: build did not produce $CLI_ENTRY" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
ln -sf "$CLI_ENTRY" "$BIN_DIR/hima"
chmod +x "$CLI_ENTRY"

echo "[install-hima] linked: $BIN_DIR/hima -> $CLI_ENTRY"
case ":$PATH:" in
  *":$BIN_DIR:"*) echo "[install-hima] $BIN_DIR is on your PATH. Run: hima init" ;;
  *) echo "[install-hima] NOTE: add $BIN_DIR to your PATH, e.g.:"
     echo "               echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
esac
echo "[install-hima] then in a project:  hima init"

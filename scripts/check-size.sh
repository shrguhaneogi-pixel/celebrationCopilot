#!/usr/bin/env bash
set -euo pipefail

# Strict target: 5 MB limit (5,242,880 bytes)
MAX_BYTES=5242880

# Check total size of git tracked files in workspace
TRACKED_SIZE=$(git ls-files -z | xargs -0 -r du -cb | tail -n 1 | awk '{print $1}')

if [ -z "$TRACKED_SIZE" ]; then
  TRACKED_SIZE=0
fi

echo "Current tracked files size: $TRACKED_SIZE bytes ($(( TRACKED_SIZE / 1024 )) KB)"

if [ "$TRACKED_SIZE" -gt "$MAX_BYTES" ]; then
  echo "ERROR: Tracked files size ($TRACKED_SIZE bytes) exceeds the 5 MB threshold!"
  exit 1
fi

echo "Repository size check PASSED: Strictly within budget."

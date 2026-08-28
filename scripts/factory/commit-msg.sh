#!/bin/sh
# commit-msg.sh — Conventional Commit subject validator (AGENTS.md rules 1-4).
#
# Usage: sh scripts/factory/commit-msg.sh <msg-file>
# Regex parity with AGENTS.md so agents self-check pre-commit:
#   ^(feat|fix|chore|docs|refactor|test|perf|ci)(<scope>): <lowercase subject><=72
set -eu

[ "$#" -eq 1 ] || { echo "usage: $0 <msg-file>" >&2; exit 1; }
subject="$(head -n1 "$1")"

printf '%s\n' "$subject" | grep -Eq \
  '^(feat|fix|chore|docs|refactor|test|perf|ci)\([a-z][a-z-]*\): [a-z].{0,71}$' || {
  echo "INVALID COMMIT SUBJECT: $subject" >&2
  echo 'expected "<type>(<scope>): <imperative subject>" per AGENTS.md' >&2
  exit 1
}
echo "COMMIT MSG OK"

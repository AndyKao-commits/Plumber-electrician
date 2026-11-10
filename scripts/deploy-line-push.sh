#!/usr/bin/env bash
# Deploy legacy line-push stub (DEC-007 reply-only: no proactive push).
# Prefer: bash scripts/deploy-line-webhook.sh
# Requires: export SUPABASE_ACCESS_TOKEN=...
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN (CLI deploy only). Do not put LINE token here." >&2
  exit 1
fi

npx --yes supabase@3.1.0 functions deploy line-push \
  --project-ref rhpzvqvkmllbdtkpouwn

echo "Deployed function: line-push (stub: skips outbox; reply-only mode)"
echo "Use scripts/deploy-line-webhook.sh for the live LINE entry."

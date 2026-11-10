#!/usr/bin/env bash
# Deploy LINE outbox Edge Function. Requires:
#   export SUPABASE_ACCESS_TOKEN=...   # Account access token (CLI only)
# LINE Channel token must already exist as Edge Function Secret:
#   LINE_CHANNEL_ACCESS_TOKEN  (set in Supabase Dashboard — never pass on argv)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN (CLI deploy only). Do not put LINE token here." >&2
  exit 1
fi

npx --yes supabase@3.1.0 functions deploy line-push \
  --project-ref rhpzvqvkmllbdtkpouwn \
  --yes

echo "Deployed function: line-push"
echo "Required secret name: LINE_CHANNEL_ACCESS_TOKEN (Supabase Edge Function Secrets)"

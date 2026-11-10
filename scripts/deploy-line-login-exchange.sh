#!/usr/bin/env bash
# Deploy LINE Login code exchange Edge Function.
# Requires: export SUPABASE_ACCESS_TOKEN=...
# Secrets in Supabase Edge Function Secrets (never on argv):
#   LINE_LOGIN_CHANNEL_ID
#   LINE_LOGIN_CHANNEL_SECRET
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN (CLI deploy only)." >&2
  exit 1
fi

npx --yes supabase@3.1.0 functions deploy line-login-exchange \
  --project-ref rhpzvqvkmllbdtkpouwn

echo "Deployed: line-login-exchange"
echo "Also redeploy line-webhook (silent menu) when ready:"
echo "  npx supabase functions deploy line-webhook --project-ref rhpzvqvkmllbdtkpouwn --no-verify-jwt"

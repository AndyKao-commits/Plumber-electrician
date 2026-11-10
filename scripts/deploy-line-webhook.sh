#!/usr/bin/env bash
# Deploy LINE reply-only webhook Edge Function. Requires:
#   export SUPABASE_ACCESS_TOKEN=...   # Account access token (CLI only)
# Secrets must already exist in Supabase Edge Function Secrets (never pass on argv):
#   LINE_CHANNEL_ACCESS_TOKEN
#   LINE_CHANNEL_SECRET
# Optional: APP_PUBLIC_URL (defaults to production Vercel URL inside the function)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN (CLI deploy only). Do not put LINE secrets here." >&2
  exit 1
fi

npx --yes supabase@3.1.0 functions deploy line-webhook \
  --project-ref rhpzvqvkmllbdtkpouwn \
  --no-verify-jwt

echo "Deployed function: line-webhook"
echo "Webhook URL:"
echo "  https://rhpzvqvkmllbdtkpouwn.supabase.co/functions/v1/line-webhook"
echo "Required secrets: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET"
echo "In LINE Developers → Messaging API → Webhook URL: paste the URL above, enable Webhook, disable auto-reply if conflicting."

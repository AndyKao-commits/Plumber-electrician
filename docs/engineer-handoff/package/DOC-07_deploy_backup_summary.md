# DOC-07 Deploy / Monitor / Backup / DR (summary rebuild)

## Target stack
- GitHub
- Cloudflare (Workers/Pages)
- Supabase (Postgres/Auth/Storage)
- Cloudflare R2 as needed for media

## Targets
- RPO: 1 hour
- RTO: 4 hours

## Gate
Backup schedule alone is insufficient. Must pass an actual restore drill covering DB + media + critical config before claiming compliance.

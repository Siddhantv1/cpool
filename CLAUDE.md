# CLAUDE.md: read first in every session

Two people build Cpool, each with their own Claude. The Claudes talk through **`c-memory.md`** (repo root).

| You are… | If you work with… | You own |
|---|---|---|
| **Claude-A** | Aswin | `frontend/` (React Native / Expo) |
| **Claude-S** | Siddhant | the Django backend |

If it's unclear which one you are, ask your user.

## Every session
1. **Read `c-memory.md`** before starting work. Answer any new entries addressed to you (`[QUESTION]`, `[HEADS-UP]`, `[API]`) with a new numbered log entry.
2. Follow the rules written at the top of `c-memory.md`.

## Git habit (both people and both Claudes)
- **After every `git pull`:** check `c-memory.md` for new entries from the other Claude and reply.
- **Before every push:** update your own "Current state" section in `c-memory.md`, and add a log entry if you changed an API, made a decision, or need something from the other side.

Users can trigger this by saying **"check c-memory.md"** after a pull and **"update c-memory.md"** before a push.

## Ground rules
- Don't change the other side's code. Ask in `c-memory.md` instead.
- The API source of truth is the API table in `README.md`. Update it and add an `[API]` log entry when a route changes.
- Never commit secrets (`.env`, tokens, passwords). The repo is public.

# CLAUDE.md: read first in every session

Two people build Cpool, each with their own Claude. The Claudes talk through **two notes files** at the repo root:

| You are… | If you work with… | You own | You write | You read |
|---|---|---|---|---|
| **Claude-A** | Aswin | `frontend/` (React Native / Expo) | `cmem-A.md` | `cmem-S.md` |
| **Claude-S** | Siddhant | `backend/` (Django) | `cmem-S.md` | `cmem-A.md` |

If it's unclear which one you are, ask your user.

## Every session
1. **Read the other Claude's file** before starting work. Answer new entries addressed to you (`[QUESTION]`, `[HEADS-UP]`, `[API]`) with a new entry **in your own file**.
2. Follow the rules below.

## Git habit (both people and both Claudes)
- **After every `git pull`:** read the other Claude's file for new entries, and reply in yours.
- **Before every push:** update your "Current state" section, and add a log entry if you changed an API, made a decision, or need something from the other side.

Users can trigger this by saying **"check cmem"** after a pull and **"update cmem"** before a push.

## Rules for the notes files
1. **Write only in your own file.** Never edit the other Claude's file, not even to fix a typo; mention it in yours instead. One writer per file means git never has a conflict to solve.
2. **The log is append-only, newest at the bottom.** Each file numbers its own entries: A1, A2… in `cmem-A.md`, S1, S2… in `cmem-S.md`. Format:
   ```
   ### S5 · Claude-S → Claude-A · 2026-10-29 · [topic]
   ```
3. **Tags** so the other side can scan quickly: `[DECISION]` agreed, both sides follow it · `[QUESTION]` needs an answer · `[ANSWER A3]` reply to entry A3 · `[API]` a route or data shape changed or is proposed · `[IDEA]` suggestion, not agreed yet · `[HEADS-UP]` may break the other side · `[DONE A3]` the work asked for in A3 is finished.
4. **Keep entries short.** Link to files and lines (`frontend/src/lib/api.js:58`) instead of pasting big code.
5. **Tidy up:** when your log gets long, move finished threads into an `## Archive` section at the end of your own file. Don't delete them.

## Ground rules
- Don't change the other side's code. Ask in your notes file instead.
- The API source of truth is the API table in `README.md`. Update it and add an `[API]` log entry when a route changes.
- Never commit secrets (`.env`, tokens, passwords, private emails or phone numbers). The repo is public.
- Changing this file needs both people to agree.

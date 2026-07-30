---
name: Combat persistence
description: Combat sessions stored in DB, not in-memory Maps
---

Combat state is persisted in the `combat_sessions` PostgreSQL table, keyed by `player_id`.

**Key helpers** (in `artifacts/api-server/src/bot/game.ts`):
- `createCombatSession(player, monster, locationId)` — inserts session, returns scaled stats
- `getCombatSession(telegramId)` — returns session for player if `inCombat` is true
- `updateCombatSessionHp(playerId, newHp)` — updates monster HP after each round
- `endCombat(playerId, cleanupSession)` — sets `inCombat=false`, optionally deletes session

**Why:** In-memory `combatState` Map was the root cause of combat freezing — it reset on restart and got out of sync with DB `inCombat` flag. DB persistence ensures state survives restarts and is consistent.

**How to apply:** Any new combat-related state should go in the DB. The very short-lived `pendingAttack` Map (between choosing attack zone and block zone) can stay in memory since it spans one callback click.

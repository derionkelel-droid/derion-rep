---
name: Project Reference
description: Full architecture, data model, callback flow, and conventions for the Grimuar MMORPG Telegram bot.
---

## Project Structure

```
artifacts/api-server/src/
  app.ts          — Express setup, calls seed → migrateNpcs → migrateJunk → migrateJunkBuyers → startBot
  routes.ts       — HTTP routes
  bot/
    index.ts      — Grammy bot init + polling
    handlers.ts   — All callback_query handlers (1 file, ~1397 lines)
    combat.ts     — resolveRound(), zone definitions
    game.ts       — All DB query/update helpers
    seed.ts       — seedGameData() + migration functions
    keyboards.ts  — Inline keyboard builders
lib/db/src/
  schema/
    game.ts       — All Drizzle tables + relations
    index.ts      — Re-exports
```

## Data Model (all tables in game.ts)

**players** (id, telegramId, username, nickname, race, class, level, xp, gold, stats, hp, equipped slots, inCombat)
**locations** (id, name, description, requiredLevel, orderIndex)
**equipmentItems** (id, name, slot, armorType, requiredLevel, requiredClass, bonuses, price, isShopItem)
**monsters** (id, name, locationId, level, baseHp, baseAttack, baseDefense, xpReward, goldRewardMin/Max)
**monsterDrops** (monsterId → equipmentItemId, dropChance)
**npcs** (id, name, title, locationId, greeting, advice, npcType, healCostPerHp)
**inventory** (playerId → itemId, quantity)
**combatSessions** (playerId, monster data, round)
**quests** (playerId, npcId, targetMonsterName, progress, rewards)
**junkItems** (id, name, description, sellPrice, locationId)
**monsterJunkDrops** (monsterId → junkItemId, dropChance, min/maxQuantity)
**junkInventory** (playerId → junkItemId, quantity)

## Callback Data Convention (handlers.ts)

- `main_menu`, `noop` — navigation
- `adventure`, `search_monster` — combat start
- `atk_<idx>`, `blk_<idx>` — attack/block zone choice
- `combat_attack`, `combat_next`, `combat_run` — combat flow
- `profile`, `stats_up_<stat>` — player profile
- `inventory`, `inv_<id>` — inventory + item actions
- `shop`, `buy_<id>`, `buy_confirm_<id>` — shop flow
- `locations`, `loc_<id>` — travel
- `npc`, `npc_sel_<id>`, `npc_heal_<id>`, `npc_heal_confirm_<id>`, `npc_quest_<id>` — NPC flow
- `junk_sell_all`, `junk_confirm_sell` — junk buyer
- `equip_<invId>`, `equip_confirm_<invId>`, `unequip_<slot>`, `unequip_confirm_<slot>` — equipment

## Key Patterns

- **State**: All game state in PostgreSQL via Drizzle ORM. No in-memory maps for persistent data.
- **Combat**: 2-step callback: atk_ → blk_ → pendingAttack map → resolveRound → DB update. Round counter in combatSessions.round.
- **Equipment bonuses**: loadEquippedStats(player) reads all 6 slots → sum bonuses → pass to resolveRound().
- **Confirmation dialogs**: Two-step for buy, equip, unequip, heal (_confirm suffix).
- **NPC types**: advisor (advice only), healer (heal for gold), quest_giver (kill quests), junk_buyer (sell junk).
- **Junk drops**: After victory, checkJunkDrops() returns array → addJunkToInventory per item.
- **Seed**: On first run only (checks if locations exist). Migrations are separate functions called on every boot but skip if already applied.

## Cost & Balance

- Heal cost: `Math.ceil(missingHp / 25) * healCostPerHp` (per 25 HP)
- Junk sell prices: 1-95 gold per unit, scales with location level
- Equipment drop chance: 3-5%
- Junk drop chance: 30-60%, 1-2 types per monster, 1-5 quantity

## Important Gotchas

- Drizzle `with: { item: true }` requires explicit `relations()` in schema file — they're defined at the bottom of game.ts
- `createCombatSession(playerId, ...)` expects `playerId: number`, not Player object
- Grammy is externalized from esbuild bundle (native .node module) via `external: [/@grammyjs/]`
- npcTypes array includes "junk_buyer" — this has been added
- `getNpcsForLocation()` returns ALL NPCs, `getNpcForLocation()` returns only first (legacy)

---
name: Menu, Achievements, Stats, Shop
description: Menu system, achievements with diamond rewards, stats display, class reset, diamond shop with TG Stars, loot boxes
---

## Menu System
- New **📋 Меню** button on main menu
- Submenu: 🏆 Достижения | 📊 Статистика | 🏪 Магазин

## Achievements (code-defined in game.ts ACHIEVEMENTS array)
Stored in DB table `player_achievements` (playerId, achievementKey, unlockedAt).
Rewards paid in 💎 diamonds (column on players table).
Current achievements: first_kill(+5💎), first_death(+3💎), killer_10(+10💎), killer_50(+25💎), killer_100(+50💎), level_5(+10💎), level_10(+25💎), level_20(+50💎), rich(+15💎, 1000 gold), survivor(+15💎, manual check in combat).
Checked automatically on combat victory and death.

## Stats
Displays: total kills, total deaths, diamonds, gold, level.
**Class reset**: costs 500🪙, shows class selection (reuses class_ handler with pendingAttack marker "class_reset"), preserves level, recalculates base stats, resets HP. `resetClass()` in game.ts.

## Shop (diamond store)
- 💎 Diamonds bought via Telegram Stars (XTR currency)
- 25💎 = 100⭐, 100💎 = 400⭐
- Uses `sendInvoice` with XTR currency + `pre_checkout_query` / `message:successful_payment` handlers
- Diamond packs defined in game.ts `DIAMOND_PACKS` const

## Loot Boxes
- Cost: 20💎 each
- Random loot via `rollLootBox()`: Common(50%) gold/potions, Rare(30%) gold/diamonds, Epic(15%) gold/diamonds/berserk, Legendary(5%) diamonds/gold
- Uses `openLootBox()` to deduct diamonds and apply reward (gold, diamonds, or potion effect)
- Loot box contents defined in game.ts `LOOT_BOX_CONTENTS`

## Player columns (added to DB)
- `diamonds` (integer, default 0)
- `total_kills` (integer, default 0)
- `total_deaths` (integer, default 0)

---
name: Quest tracking
description: Quests auto-track progress when player kills target monsters
---

`quests` table stores active/future quests per player. Key helpers in `game.ts`:
- `getActiveQuest(playerId, npcId)` — active uncompleted quest from specific NPC
- `getAnyActiveQuest(playerId)` — any active quest
- `createQuest(playerId, npc, monsterName, locationId)` — creates quest (target: 5 kills)
- `incrementQuestProgress(playerId, monsterName)` — called after monster death; auto-completes on reaching target

**Why:** Quest completion happens automatically when the player kills the right monster type — no need to return to NPC mid-quest. Completion rewards are added on top of normal kill rewards.

**How to apply:** The `blk_` handler calls `incrementQuestProgress` after each kill victory. No changes needed in combat flow.

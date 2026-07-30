---
name: NPC types
description: NPCs have types (advisor/healer/quest_giver) with dynamic inline actions
---

Schema field: `npcs.npc_type` — enum of `advisor | healer | quest_giver`.

**Healer:** Has `healCostPerHp` (gold per missing HP restored). Shows "❤️ Лечиться" button dynamically. Costs `missingHP * healCostPerHp` gold.

**Quest giver:** Shows "📜 Взять задание" or current progress. Generates quest targeting a monster from the NPC's location.

**Advisor:** Original behavior — just advice text.

**How to apply:** All three types work within the same `npc` callback handler in `handlers.ts`. The keyboard is built dynamically based on `npcType`.

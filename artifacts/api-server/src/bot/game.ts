import { and, eq, lt, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  players,
  equipmentItems,
  inventory,
  junkItems,
  junkInventory,
  monsterJunkDrops,
  locations,
  monsters,
  monsterDrops,
  quests,
  npcs,
  combatSessions,
  playerEffects,
  type Player,
  type EquipmentItem,
  type JunkItem,
  type Race,
  type Class,
  type EquipmentSlot,
  type Npc,
  type Quest,
  type EffectType,
} from "@workspace/db";

// ─── RACE BONUSES ────────────────────────────────────────────────────────────

const raceBonuses: Record<Race, { str: number; agi: number; int: number; vit: number }> = {
  human: { str: 1, agi: 1, int: 1, vit: 1 },
  elf: { str: 0, agi: 2, int: 2, vit: 0 },
  dwarf: { str: 2, agi: 0, int: 0, vit: 2 },
  orc: { str: 3, agi: 0, int: 0, vit: 1 },
};

const raceNames: Record<Race, string> = {
  human: "👤 Человек",
  elf: "🧝 Эльф",
  dwarf: "⛏️ Дворф",
  orc: "💀 Орк",
};

const classNames: Record<Class, string> = {
  warrior: "⚔️ Воин",
  mage: "🔮 Маг",
  archer: "🏹 Лучник",
  assassin: "🗡️ Ассасин",
};

// ─── CLASS BASE STATS ────────────────────────────────────────────────────────

const classBaseStats: Record<Class, { str: number; agi: number; int: number; vit: number }> = {
  warrior: { str: 8, agi: 4, int: 3, vit: 7 },
  mage: { str: 3, agi: 4, int: 8, vit: 4 },
  archer: { str: 5, agi: 7, int: 4, vit: 5 },
  assassin: { str: 6, agi: 8, int: 3, vit: 4 },
};

// ─── CLASS RESTRICTIONS ──────────────────────────────────────────────────────

const classAllowedArmor: Record<Class, string[]> = {
  warrior: ["plate", "weapon"],
  mage: ["cloth", "weapon"],
  archer: ["leather", "weapon"],
  assassin: ["leather", "weapon"],
};

// ─── HP FORMULA ──────────────────────────────────────────────────────────────

export function calculateMaxHp(player: Player, equipBonusHp = 0): number {
  const playerClass = player.class as Class;
  const vitMultiplier =
    playerClass === "warrior" ? 20 : playerClass === "mage" ? 10 : playerClass === "archer" ? 14 : 12;
  return 100 + player.vitality * vitMultiplier + equipBonusHp;
}

// ─── ATTACK FORMULA ──────────────────────────────────────────────────────────

export function calculateAttack(player: Player, equipBonusAtk = 0): number {
  const playerClass = player.class as Class;
  const s = player.strength;
  const a = player.agility;
  const i = player.intelligence;
  let base: number;
  switch (playerClass) {
    case "warrior":
      base = s * 2.5 + a * 0.5;
      break;
    case "mage":
      base = i * 3 + a * 0.3;
      break;
    case "archer":
      base = a * 2 + s * 1;
      break;
    case "assassin":
      base = a * 2.5 + s * 0.5;
      break;
  }
  return Math.floor(base) + equipBonusAtk;
}

// ─── DEFENSE FORMULA ─────────────────────────────────────────────────────────

export function calculateDefense(player: Player, equipBonusDef = 0): number {
  const playerClass = player.class as Class;
  let base: number;
  switch (playerClass) {
    case "warrior":
      base = player.vitality * 1.5 + player.agility * 0.5;
      break;
    case "mage":
      base = player.intelligence * 1 + player.agility * 0.3;
      break;
    case "archer":
      base = player.agility * 1.5 + player.vitality * 0.5;
      break;
    case "assassin":
      base = player.agility * 1.5 + player.vitality * 0.3;
      break;
  }
  return Math.floor(base) + equipBonusDef;
}

// ─── EQUIPPED STATS ──────────────────────────────────────────────────────────

export async function loadEquippedStats(player: Player) {
  const equippedIds: (number | null)[] = [
    player.equippedWeaponId,
    player.equippedHeadId,
    player.equippedChestId,
    player.equippedLegsId,
    player.equippedFeetId,
    player.equippedAccessoryId,
  ];

  const items: EquipmentItem[] = [];
  for (const id of equippedIds) {
    if (id) {
      const item = await db.query.equipmentItems.findFirst({ where: (eqi, { eq: op }) => op(eqi.id, id) });
      if (item) items.push(item);
    }
  }

  // Include potion effect bonuses
  const potionBonuses = await getActiveEffectsBonuses(player.id);

  return {
    bonusHp: items.reduce((s, i) => s + i.bonusHp, 0) + potionBonuses.bonusHp,
    bonusAttack: items.reduce((s, i) => s + i.bonusAttack, 0) + potionBonuses.bonusAttack,
    bonusDefense: items.reduce((s, i) => s + i.bonusDefense, 0) + potionBonuses.bonusDefense,
    bonusStr: items.reduce((s, i) => s + i.bonusStrength, 0),
    bonusAgi: items.reduce((s, i) => s + i.bonusAgility, 0),
    bonusInt: items.reduce((s, i) => s + i.bonusIntelligence, 0),
    bonusVit: items.reduce((s, i) => s + i.bonusVitality, 0),
    items,
  };
}

// ─── XP FORMULA ──────────────────────────────────────────────────────────────

export function xpToNextLevel(level: number): number {
  return Math.floor(100 * level * 1.4);
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpToNextLevel(i);
  }
  return total;
}

// ─── STAT GETTERS ────────────────────────────────────────────────────────────

export function getRaceName(race: Race): string {
  return raceNames[race];
}

export function getClassName(c: Class): string {
  return classNames[c];
}

export function getRaceBonuses(race: Race) {
  return raceBonuses[race];
}

export function getClassBaseStats(c: Class) {
  return classBaseStats[c];
}

export function canEquipClass(playerClass: Class, item: EquipmentItem): boolean {
  if (item.requiredClass && item.requiredClass !== playerClass) return false;
  const allowed = classAllowedArmor[playerClass];
  return allowed.includes(item.armorType);
}

export function canEquipLevel(playerLevel: number, item: EquipmentItem): boolean {
  return playerLevel >= item.requiredLevel;
}

// ─── PLAYER HELPERS ──────────────────────────────────────────────────────────

export async function getPlayer(telegramId: number): Promise<Player | null> {
  return db.query.players.findFirst({
    where: (p, { eq: op }) => op(p.telegramId, telegramId),
  });
}

export async function getInventory(playerId: number) {
  return db.query.inventory.findMany({
    where: (inv, { eq: op }) => op(inv.playerId, playerId),
    with: { item: true },
  });
}

// ─── JUNK HELPERS ────────────────────────────────────────────────────────

export async function addJunkToInventory(playerId: number, junkItemId: number, quantity: number) {
  const existing = await db.query.junkInventory.findFirst({
    where: (ji, { and: andOp, eq: op }) =>
      andOp(op(ji.playerId, playerId), op(ji.junkItemId, junkItemId)),
  });
  if (existing) {
    await db
      .update(junkInventory)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(junkInventory.id, existing.id));
  } else {
    await db.insert(junkInventory).values({ playerId, junkItemId, quantity });
  }
}

export async function checkJunkDrops(monsterId: number): Promise<{ junkItem: JunkItem; quantity: number }[]> {
  const drops = await db.query.monsterJunkDrops.findMany({
    where: (mjd, { eq: op }) => op(mjd.monsterId, monsterId),
    with: { junkItem: true },
  });
  const results: { junkItem: JunkItem; quantity: number }[] = [];
  for (const drop of drops) {
    const chance = parseFloat(drop.dropChance as string);
    if (Math.random() * 100 < chance) {
      const qty = drop.minQuantity + Math.floor(Math.random() * (drop.maxQuantity - drop.minQuantity + 1));
      results.push({ junkItem: drop.junkItem, quantity: qty });
    }
  }
  return results;
}

export async function getJunkInventory(playerId: number) {
  return db.query.junkInventory.findMany({
    where: (ji, { eq: op }) => op(ji.playerId, playerId),
    with: { junkItem: true },
  });
}

export async function removeJunkFromInventory(playerId: number, junkItemId: number, quantity: number): Promise<number> {
  const entry = await db.query.junkInventory.findFirst({
    where: (ji, { and: andOp, eq: op }) =>
      andOp(op(ji.playerId, playerId), op(ji.junkItemId, junkItemId)),
  });
  if (!entry || entry.quantity < quantity) return 0;
  const newQty = entry.quantity - quantity;
  if (newQty <= 0) {
    await db.delete(junkInventory).where(eq(junkInventory.id, entry.id));
  } else {
    await db
      .update(junkInventory)
      .set({ quantity: newQty })
      .where(eq(junkInventory.id, entry.id));
  }
  const totalGold = quantity * entry.junkItem.sellPrice;
  return totalGold;
}

export async function sellAllJunk(playerId: number): Promise<{ totalGold: number; soldItems: { name: string; qty: number; gold: number }[] }> {
  const entries = await getJunkInventory(playerId);
  let totalGold = 0;
  const soldItems: { name: string; qty: number; gold: number }[] = [];
  for (const entry of entries) {
    const gold = entry.quantity * entry.junkItem.sellPrice;
    totalGold += gold;
    soldItems.push({ name: entry.junkItem.name, qty: entry.quantity, gold });
    await db.delete(junkInventory).where(eq(junkInventory.id, entry.id));
  }
  return { totalGold, soldItems };
}

export async function getLocation(locationId: number) {
  return db.query.locations.findFirst({
    where: (loc, { eq: op }) => op(loc.id, locationId),
  });
}

export async function getAvailableLocations(level: number) {
  return db.query.locations.findMany({
    where: (loc, { lte }) => lte(loc.requiredLevel, level),
    orderBy: (loc, { asc }) => asc(loc.requiredLevel),
  });
}

export async function getRandomMonster(locationId: number) {
  const mobs = await db.query.monsters.findMany({
    where: (m, { eq: op }) => op(m.locationId, locationId),
  });
  if (mobs.length === 0) return null;
  return mobs[Math.floor(Math.random() * mobs.length)];
}

export async function getNpcForLocation(locationId: number) {
  return db.query.npcs.findFirst({
    where: (n, { eq: op }) => op(n.locationId, locationId),
  });
}

export async function getNpcsForLocation(locationId: number) {
  return db.query.npcs.findMany({
    where: (n, { eq: op }) => op(n.locationId, locationId),
    orderBy: (n, { asc }) => asc(n.id),
  });
}

export async function checkDrop(monsterId: number): Promise<EquipmentItem | null> {
  const drops = await db.query.monsterDrops.findMany({
    where: (md, { eq: op }) => op(md.monsterId, monsterId),
    with: { item: true },
  });
  for (const drop of drops) {
    const chance = parseFloat(drop.dropChance as string);
    if (Math.random() * 100 < chance) {
      return drop.item;
    }
  }
  return null;
}

export async function addItemToInventory(playerId: number, itemId: number) {
  const existing = await db.query.inventory.findFirst({
    where: (inv, { and: andOp, eq: op }) =>
      andOp(op(inv.playerId, playerId), op(inv.itemId, itemId)),
  });
  if (existing) {
    await db
      .update(inventory)
      .set({ quantity: existing.quantity + 1 })
      .where(eq(inventory.id, existing.id));
  } else {
    await db.insert(inventory).values({ playerId, itemId, quantity: 1 });
  }
}

export async function removeItemFromInventory(playerId: number, itemId: number) {
  const existing = await db.query.inventory.findFirst({
    where: (inv, { and: andOp, eq: op }) =>
      andOp(op(inv.playerId, playerId), op(inv.itemId, itemId)),
  });
  if (!existing) return false;
  if (existing.quantity > 1) {
    await db
      .update(inventory)
      .set({ quantity: existing.quantity - 1 })
      .where(eq(inventory.id, existing.id));
  } else {
    await db.delete(inventory).where(eq(inventory.id, existing.id));
  }
  return true;
}

export async function equipItem(playerId: number, itemId: number) {
  const item = await db.query.equipmentItems.findFirst({
    where: (eqi, { eq: op }) => op(eqi.id, itemId),
  });
  if (!item) return false;

  const player = await db.query.players.findFirst({
    where: (p, { eq: op }) => op(p.id, playerId),
  });
  if (!player) return false;

  const slotColumn: Record<string, any> = {
    weapon: "equippedWeaponId",
    head: "equippedHeadId",
    chest: "equippedChestId",
    legs: "equippedLegsId",
    feet: "equippedFeetId",
    accessory: "equippedAccessoryId",
  };

  const column = slotColumn[item.slot];
  if (!column) return false;

  await db
    .update(players)
    .set({ [column]: itemId } as any)
    .where(eq(players.id, playerId));

  return true;
}

export async function unequipItem(playerId: number, slot: EquipmentSlot) {
  const slotColumn: Record<string, any> = {
    weapon: "equippedWeaponId",
    head: "equippedHeadId",
    chest: "equippedChestId",
    legs: "equippedLegsId",
    feet: "equippedFeetId",
    accessory: "equippedAccessoryId",
  };

  const column = slotColumn[slot];
  if (!column) return false;

  await db
    .update(players)
    .set({ [column]: null } as any)
    .where(eq(players.id, playerId));

  return true;
}

// ─── COMBAT SESSION HELPERS ─────────────────────────────────────────────

export async function createCombatSession(
  playerId: number,
  monster: { id: number; name: string; level: number; baseHp: number; baseAttack: number; baseDefense: number; xpReward: number; goldRewardMin: number; goldRewardMax: number },
  locationId: number,
) {
  const levelMultiplier = monster.level;
  const currentHp = monster.baseHp + levelMultiplier * 15;
  const atk = monster.baseAttack + levelMultiplier * 3;
  const def = monster.baseDefense + levelMultiplier * 1.5;

  const [session] = await db
    .insert(combatSessions)
    .values({
      playerId,
      monsterId: monster.id,
      monsterName: monster.name,
      monsterHp: currentHp,
      monsterMaxHp: currentHp,
      monsterAttack: Math.floor(atk),
      monsterDefense: Math.floor(def),
      round: 1,
      monsterLevel: monster.level,
      xpReward: monster.xpReward,
      goldMin: monster.goldRewardMin,
      goldMax: monster.goldRewardMax,
      locationId,
    })
    .returning();

  return session;
}

export async function getCombatSession(telegramId: number): Promise<typeof combatSessions.$inferSelect | null> {
  const player = await getPlayer(telegramId);
  if (!player) return null;
  if (!player.inCombat) return null;

  const session = await db.query.combatSessions.findFirst({
    where: (cs, { eq: op }) => op(cs.playerId, player.id),
  });
  return session || null;
}

export async function updateCombatSessionHp(playerId: number, newHp: number) {
  await db
    .update(combatSessions)
    .set({ monsterHp: newHp })
    .where(eq(combatSessions.playerId, playerId));
}

export async function incrementCombatRound(playerId: number) {
  const session = await db.query.combatSessions.findFirst({
    where: (cs, { eq: op }) => op(cs.playerId, playerId),
  });
  if (!session) return 1;
  const newRound = session.round + 1;
  await db
    .update(combatSessions)
    .set({ round: newRound })
    .where(eq(combatSessions.playerId, playerId));
  return newRound;
}

export async function endCombat(playerId: number, cleanupSession = true) {
  await db
    .update(players)
    .set({ inCombat: false, combatMonsterId: null })
    .where(eq(players.id, playerId));
  if (cleanupSession) {
    await db.delete(combatSessions).where(eq(combatSessions.playerId, playerId));
  }
}

// ─── QUEST HELPERS ─────────────────────────────────────────────────────

export async function getActiveQuest(playerId: number, npcId: number): Promise<Quest | null> {
  const q = await db.query.quests.findFirst({
    where: (qst, { and: andOp, eq: op }) =>
      andOp(op(qst.playerId, playerId), op(qst.npcId, npcId), op(qst.isCompleted, false)),
  });
  return q || null;
}

export async function getAnyActiveQuest(playerId: number): Promise<Quest | null> {
  const q = await db.query.quests.findFirst({
    where: (qst, { and: andOp, eq: op }) =>
      andOp(op(qst.playerId, playerId), op(qst.isCompleted, false)),
  });
  return q || null;
}

export async function createQuest(playerId: number, npc: Npc, monsterName: string, monsterLocationId: number) {
  const [q] = await db
    .insert(quests)
    .values({
      playerId,
      npcId: npc.id,
      targetMonsterName: monsterName,
      targetMonsterLocationId: monsterLocationId,
      targetQuantity: 5,
      currentProgress: 0,
      rewardXp: 100 + npc.locationId * 30,
      rewardGold: 50 + npc.locationId * 20,
    })
    .returning();
  return q;
}

export async function incrementQuestProgress(playerId: number, monsterName: string): Promise<Quest | null> {
  const active = await getAnyActiveQuest(playerId);
  if (!active) return null;
  if (active.targetMonsterName !== monsterName) return null;

  const newProgress = active.currentProgress + 1;
  const isCompleted = newProgress >= active.targetQuantity;

  await db
    .update(quests)
    .set({ currentProgress: newProgress, isCompleted })
    .where(eq(quests.id, active.id));

  return { ...active, currentProgress: newProgress, isCompleted };
}

// ─── POTION RECIPES ─────────────────────────────────────────────────────

export type PotionRecipe = {
  name: string;
  description: string;
  effectType: EffectType;
  magnitude: number;
  durationMinutes: number;
  goldCost: number;
  reagents: { junkName: string; quantity: number }[];
};

export const POTION_RECIPES: PotionRecipe[] = [
  {
    name: "⚔️ Зелье силы",
    description: "+5 к атаке на 30 минут",
    effectType: "atk_boost",
    magnitude: 5,
    durationMinutes: 30,
    goldCost: 20,
    reagents: [
      { junkName: "Сломанный клык", quantity: 2 },
      { junkName: "Медвежий коготь", quantity: 1 },
    ],
  },
  {
    name: "🛡️ Зелье защиты",
    description: "+5 к защите на 30 минут",
    effectType: "def_boost",
    magnitude: 5,
    durationMinutes: 30,
    goldCost: 20,
    reagents: [
      { junkName: "Троллья слизь", quantity: 2 },
      { junkName: "Древесная смола", quantity: 1 },
    ],
  },
  {
    name: "❤️ Зелье здоровья",
    description: "+20 к макс. HP на 30 минут",
    effectType: "hp_regen",
    magnitude: 20,
    durationMinutes: 30,
    goldCost: 25,
    reagents: [
      { junkName: "Медвежий мех", quantity: 2 },
      { junkName: "Тёмная эссенция", quantity: 1 },
    ],
  },
  {
    name: "💥 Зелье ярости",
    description: "+3 атаки и +3 защиты на 30 минут",
    effectType: "berserk",
    magnitude: 3,
    durationMinutes: 30,
    goldCost: 30,
    reagents: [
      { junkName: "Сгусток тьмы", quantity: 2 },
      { junkName: "Огненная искра", quantity: 1 },
      { junkName: "Кристальная пыль", quantity: 1 },
    ],
  },
];

// ─── PLAYER EFFECTS ────────────────────────────────────────────────────

export async function createEffect(
  playerId: number,
  effectType: EffectType,
  magnitude: number,
  durationMinutes: number,
) {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  await db.insert(playerEffects).values({
    playerId,
    effectType,
    magnitude,
    expiresAt,
  });
}

export async function getActiveEffects(playerId: number) {
  const now = new Date();
  // Clean expired effects first
  await db.delete(playerEffects).where(
    and(eq(playerEffects.playerId, playerId), lt(playerEffects.expiresAt, now)),
  );

  const effects = await db.query.playerEffects.findMany({
    where: (pe, { eq: op }) => op(pe.playerId, playerId),
  });

  return effects.filter((e) => new Date(e.expiresAt) > now);
}

const effectLabels: Record<EffectType, { label: string; icon: string }> = {
  atk_boost: { label: "Атака", icon: "⚔️" },
  def_boost: { label: "Защита", icon: "🛡️" },
  hp_regen: { label: "Макс.HP", icon: "❤️" },
  berserk: { label: "Атк+Защ", icon: "💥" },
};

export async function getActiveEffectsBonuses(playerId: number): Promise<{ bonusAttack: number; bonusDefense: number; bonusHp: number }> {
  const active = await getActiveEffects(playerId);
  let bonusAttack = 0;
  let bonusDefense = 0;
  let bonusHp = 0;
  for (const e of active) {
    if (e.effectType === "atk_boost") bonusAttack += e.magnitude;
    else if (e.effectType === "def_boost") bonusDefense += e.magnitude;
    else if (e.effectType === "hp_regen") bonusHp += e.magnitude;
    else if (e.effectType === "berserk") { bonusAttack += e.magnitude; bonusDefense += e.magnitude; }
  }
  return { bonusAttack, bonusDefense, bonusHp };
}

export async function formatActiveEffects(playerId: number): Promise<string> {
  const active = await getActiveEffects(playerId);
  if (active.length === 0) return "";

  const lines = active.map((e) => {
    const info = effectLabels[e.effectType];
    const remaining = Math.max(0, Math.ceil((new Date(e.expiresAt).getTime() - Date.now()) / 60000));
    return `${info.icon} ${info.label} +${e.magnitude} (${remaining} мин)`;
  });

  return `\n\n🧪 <b>Активные эффекты:</b>\n` + lines.join("\n");
}

/** Check if a player can afford a potion (has enough of each reagent + gold) */
export async function canCraftPotion(playerId: number, recipe: PotionRecipe) {
  const player = await db.query.players.findFirst({ where: (p, { eq: op }) => op(p.id, playerId) });
  if (!player) return { ok: false, reason: "Игрок не найден" };
  if (player.gold < recipe.goldCost) return { ok: false, reason: `Недостаточно золота! Нужно: ${recipe.goldCost}` };

  // Check reagent availability by name
  for (const reagent of recipe.reagents) {
    const junkInv = await db.query.junkInventory.findMany({
      where: (ji, { and: a, eq: op }) => a(op(ji.playerId, playerId)),
      with: { junkItem: true },
    });
    const matching = junkInv.filter((j) => j.junkItem.name === reagent.junkName);
    const total = matching.reduce((sum, j) => sum + j.quantity, 0);
    if (total < reagent.quantity) {
      return { ok: false, reason: `Не хватает реагента: ${reagent.junkName} (нужно ${reagent.quantity}, есть ${total})` };
    }
  }

  return { ok: true, player };
}

/** Consume reagents and gold to craft a potion, then apply the effect */
export async function craftPotion(playerId: number, recipe: PotionRecipe) {
  const canCraft = await canCraftPotion(playerId, recipe);
  if (!canCraft.ok || !canCraft.player) throw new Error(canCraft.reason || "Crafting failed");

  // Deduct gold
  await db
    .update(players)
    .set({ gold: canCraft.player.gold - recipe.goldCost })
    .where(eq(players.id, playerId));

  // Deduct reagents
  for (const reagent of recipe.reagents) {
    let remaining = reagent.quantity;
    const junkEntries = await db.query.junkInventory.findMany({
      where: (ji, { and: a, eq: op }) => a(op(ji.playerId, playerId)),
      with: { junkItem: true },
    });
    for (const entry of junkEntries.filter((j) => j.junkItem.name === reagent.junkName)) {
      if (remaining <= 0) break;
      const toRemove = Math.min(remaining, entry.quantity);
      await removeJunkFromInventory(playerId, entry.junkItem.id, toRemove);
      remaining -= toRemove;
    }
  }

  // Apply effect
  await createEffect(playerId, recipe.effectType, recipe.magnitude, recipe.durationMinutes);
}

// ─── FORMAT PROFILE ────────────────────────────────────────────────────

export async function formatPlayerProfile(player: Player): Promise<string> {
  const equip = await loadEquippedStats(player);
  const maxHp = calculateMaxHp(player, equip.bonusHp);
  const atk = calculateAttack(player, equip.bonusAttack);
  const def = calculateDefense(player, equip.bonusDefense);
  const xpNeeded = xpToNextLevel(player.level);
  const xpProgress = Math.floor((player.xp / xpNeeded) * 100);

  let equipStr = "";
  if (equip.items.length > 0) {
    equipStr = "\n\n🎒 <b>Экипировка:</b>\n" + equip.items.map((i) => `• ${i.name}`).join("\n");
  }

  const effectsStr = await formatActiveEffects(player.id);

  return `
🎮 <b>${player.nickname}</b>
━━━━━━━━━━━━━━━
${getRaceName(player.race as Race)} | ${getClassName(player.class as Class)}
Уровень: ${player.level} | XP: ${player.xp}/${xpNeeded} (${xpProgress}%)
Монет: 🪙 ${player.gold}

📊 <b>Характеристики:</b>
⚔️ Атака: ${atk} | 🛡️ Защита: ${def}
❤️ HP: ${player.currentHp}/${maxHp}
💪 Сила: ${player.strength}
🏃 Ловкость: ${player.agility}
🧠 Интеллект: ${player.intelligence}
❤️‍🔥 Живучесть: ${player.vitality}
${player.freeStatPoints > 0 ? `\n✨ Свободных очков: ${player.freeStatPoints}` : ""}${equipStr}${effectsStr}`;
}

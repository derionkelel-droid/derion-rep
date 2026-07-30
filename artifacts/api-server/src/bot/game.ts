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
  playerAchievements,
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

// ─── SKILLS ────────────────────────────────────────────────────────────

export type SkillType = "basic" | "special" | "ultimate";

export type SkillDef = {
  id: string;
  name: string;
  description: string;
  skillType: SkillType;
  icon: string;
  classRestriction: Class;
};

export const SKILLS: SkillDef[] = [
  // ── WARRIOR ──
  { id: "war_r", name: "Мощный удар", description: "Урон: (atk×сила)/6", skillType: "basic", icon: "💥", classRestriction: "warrior" },
  { id: "war_s", name: "Защитная стойка", description: "Урон врага -50% в раунде", skillType: "special", icon: "🛡️", classRestriction: "warrior" },
  { id: "war_u", name: "Железная воля", description: "Автоблок атаки врага", skillType: "ultimate", icon: "🧱", classRestriction: "warrior" },
  // ── MAGE ──
  { id: "mag_r", name: "Огненный шар", description: "Урон: (atk×инт)/6", skillType: "basic", icon: "🔥", classRestriction: "mage" },
  { id: "mag_s", name: "Ледяной щит", description: "Урон врага -50% в раунде", skillType: "special", icon: "❄️", classRestriction: "mage" },
  { id: "mag_u", name: "Магический барьер", description: "Автоблок атаки врага", skillType: "ultimate", icon: "🔮", classRestriction: "mage" },
  // ── ARCHER ──
  { id: "arc_r", name: "Меткий выстрел", description: "Урон: (atk×ловк)/6", skillType: "basic", icon: "🎯", classRestriction: "archer" },
  { id: "arc_s", name: "Уклонение", description: "Урон врага -50% в раунде", skillType: "special", icon: "💨", classRestriction: "archer" },
  { id: "arc_u", name: "Кошачья реакция", description: "Автоблок атаки врага", skillType: "ultimate", icon: "🐱", classRestriction: "archer" },
  // ── ASSASSIN ──
  { id: "ass_r", name: "Удар из тени", description: "Урон: (atk×ловк)/6", skillType: "basic", icon: "🗡️", classRestriction: "assassin" },
  { id: "ass_s", name: "Теневой покров", description: "Урон врага -50% в раунде", skillType: "special", icon: "🌑", classRestriction: "assassin" },
  { id: "ass_u", name: "Смертельный танец", description: "Автоблок атаки врага", skillType: "ultimate", icon: "💫", classRestriction: "assassin" },
];

export function getMainStat(player: Player): string {
  const c = player.class as Class;
  return c === "warrior" ? "strength" : c === "mage" ? "intelligence" : "agility";
}

export function getMainStatValue(player: Player): number {
  const c = player.class as Class;
  if (c === "warrior") return player.strength;
  if (c === "mage") return player.intelligence;
  return player.agility; // archer & assassin
}

export function getClassSkills(playerClass: Class): SkillDef[] {
  return SKILLS.filter((s) => s.classRestriction === playerClass);
}

export function getSkillRequirement(skill: SkillDef): { hits: number; blocks: number; misses: number } {
  if (skill.skillType === "basic") return { hits: 1, blocks: 0, misses: 0 };
  if (skill.skillType === "special") return { hits: 1, blocks: 1, misses: 0 };
  return { hits: 0, blocks: 1, misses: 1 }; // ultimate
}

export function canUseSkill(skill: SkillDef, hits: number, blocks: number, misses: number): boolean {
  const req = getSkillRequirement(skill);
  return hits >= req.hits && blocks >= req.blocks && misses >= req.misses;
}

export function calculateSkillDamage(player: Player, atk: number): number {
  const stat = getMainStatValue(player);
  return Math.floor(atk * (stat / 6));
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
Монет: 🪙 ${player.gold} | 💎 ${player.diamonds}
📊 Статистика: 🏆 убито ${player.totalKills} | 💀 смертей ${player.totalDeaths}

📊 <b>Характеристики:</b>
⚔️ Атака: ${atk} | 🛡️ Защита: ${def}
❤️ HP: ${player.currentHp}/${maxHp}
💪 Сила: ${player.strength}
🏃 Ловкость: ${player.agility}
🧠 Интеллект: ${player.intelligence}
❤️‍🔥 Живучесть: ${player.vitality}
${player.freeStatPoints > 0 ? `\n✨ Свободных очков: ${player.freeStatPoints}` : ""}${equipStr}${effectsStr}`;
}

// ─── ACHIEVEMENTS ──────────────────────────────────────────────────────

export type AchievementDef = {
  key: string;
  name: string;
  description: string;
  icon: string;
  rewardDiamonds: number;
  check: (player: Player, params: { kills: number; deaths: number; level: number; inventoryCount?: number; gold: number }) => boolean;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_kill", name: "Первая кровь", description: "Убить первого монстра", icon: "⚔️", rewardDiamonds: 5, check: (_, { kills }) => kills >= 1 },
  { key: "first_death", name: "Первое падение", description: "Умереть впервые", icon: "💀", rewardDiamonds: 3, check: (_, { deaths }) => deaths >= 1 },
  { key: "killer_10", name: "Охотник", description: "Убить 10 монстров", icon: "🏆", rewardDiamonds: 10, check: (_, { kills }) => kills >= 10 },
  { key: "killer_50", name: "Массовый убийца", description: "Убить 50 монстров", icon: "🏆", rewardDiamonds: 25, check: (_, { kills }) => kills >= 50 },
  { key: "killer_100", name: "Легендарный охотник", description: "Убить 100 монстров", icon: "👑", rewardDiamonds: 50, check: (_, { kills }) => kills >= 100 },
  { key: "level_5", name: "Середина пути", description: "Достичь 5 уровня", icon: "⭐", rewardDiamonds: 10, check: (_, { level }) => level >= 5 },
  { key: "level_10", name: "Ветеран", description: "Достичь 10 уровня", icon: "⭐", rewardDiamonds: 25, check: (_, { level }) => level >= 10 },
  { key: "level_20", name: "Мастер", description: "Достичь 20 уровня", icon: "🌟", rewardDiamonds: 50, check: (_, { level }) => level >= 20 },
  { key: "rich", name: "Богач", description: "Накопить 1000 золота", icon: "💰", rewardDiamonds: 15, check: (_, { gold }) => gold >= 1000 },
  { key: "survivor", name: "Живучий", description: "Выжить с 1 HP", icon: "❤️‍🔥", rewardDiamonds: 15, check: (_, { }) => false }, // checked manually in combat
];

export async function checkAndUnlockAchievement(player: Player, ctx: { kills: number; deaths: number; level: number; gold: number; survivedWith1Hp?: boolean }): Promise<string[]> {
  const unlocked = await db.query.playerAchievements.findMany({
    where: (pa, { eq: op }) => op(pa.playerId, player.id),
  });
  const unlockedKeys = new Set(unlocked.map((a) => a.achievementKey));
  const newAchievements: string[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlockedKeys.has(ach.key)) continue;
    if (ach.check(player, ctx)) {
      await db.insert(playerAchievements).values({ playerId: player.id, achievementKey: ach.key });
      await db.update(players).set({ diamonds: player.diamonds + ach.rewardDiamonds }).where(eq(players.id, player.id));
      newAchievements.push(`${ach.icon} <b>${ach.name}</b> — ${ach.rewardDiamonds}💎\n${ach.description}`);
    }
  }

  return newAchievements;
}

export async function getPlayerAchievements(playerId: number): Promise<{ def: AchievementDef; unlockedAt: Date | null }[]> {
  const unlocked = await db.query.playerAchievements.findMany({
    where: (pa, { eq: op }) => op(pa.playerId, playerId),
  });
  const unlockedMap = new Map(unlocked.map((a) => [a.achievementKey, a.unlockedAt]));
  return ACHIEVEMENTS.map((def) => ({
    def,
    unlockedAt: unlockedMap.get(def.key) || null,
  }));
}

// ─── LOOT BOXES ────────────────────────────────────────────────────────

type LootBoxItem = {
  name: string;
  description: string;
  icon: string;
  type: "equipment" | "gold" | "diamonds" | "potion_effect";
  itemId?: number; // for equipment
  quantity?: number; // for gold/diamonds
  effectType?: EffectType;
  magnitude?: number;
  durationMinutes?: number;
};

type LootBoxSlot = {
  items: LootBoxItem[];
  weight: number; // probability weight
};

const LOOT_BOX_CONTENTS: LootBoxSlot[] = [
  // Common (50%)
  {
    weight: 50,
    items: [
      { name: "Зелье силы", description: "+5 атаки на 30 мин", icon: "⚗️", type: "potion_effect", effectType: "atk_boost", magnitude: 5, durationMinutes: 30 },
      { name: "Зелье защиты", description: "+5 защиты на 30 мин", icon: "⚗️", type: "potion_effect", effectType: "def_boost", magnitude: 5, durationMinutes: 30 },
      { name: "Зелье здоровья", description: "+20 HP на 30 мин", icon: "⚗️", type: "potion_effect", effectType: "hp_regen", magnitude: 20, durationMinutes: 30 },
      { name: "10 золота", description: "", icon: "🪙", type: "gold", quantity: 10 },
      { name: "20 золота", description: "", icon: "🪙", type: "gold", quantity: 20 },
    ],
  },
  // Rare (30%)
  {
    weight: 30,
    items: [
      { name: "50 золота", description: "", icon: "🪙", type: "gold", quantity: 50 },
      { name: "2 алмаза", description: "", icon: "💎", type: "diamonds", quantity: 2 },
      { name: "5 алмазов", description: "", icon: "💎", type: "diamonds", quantity: 5 },
    ],
  },
  // Epic (15%)
  {
    weight: 15,
    items: [
      { name: "100 золота", description: "", icon: "🪙", type: "gold", quantity: 100 },
      { name: "10 алмазов", description: "", icon: "💎", type: "diamonds", quantity: 10 },
      { name: "Зелье ярости", description: "+3 всего на 30 мин", icon: "💥", type: "potion_effect", effectType: "berserk", magnitude: 3, durationMinutes: 30 },
    ],
  },
  // Legendary (5%)
  {
    weight: 5,
    items: [
      { name: "25 алмазов", description: "", icon: "💎", type: "diamonds", quantity: 25 },
      { name: "500 золота", description: "", icon: "🪙", type: "gold", quantity: 500 },
    ],
  },
];

export function rollLootBox(): LootBoxItem {
  const totalWeight = LOOT_BOX_CONTENTS.reduce((s, slot) => s + slot.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const slot of LOOT_BOX_CONTENTS) {
    roll -= slot.weight;
    if (roll <= 0) {
      return slot.items[Math.floor(Math.random() * slot.items.length)];
    }
  }
  return LOOT_BOX_CONTENTS[0].items[0];
}

export async function openLootBox(player: Player): Promise<LootBoxItem> {
  const item = rollLootBox();

  switch (item.type) {
    case "gold":
      await db.update(players).set({ gold: player.gold + (item.quantity || 0) }).where(eq(players.id, player.id));
      break;
    case "diamonds":
      await db.update(players).set({ diamonds: player.diamonds + (item.quantity || 0) }).where(eq(players.id, player.id));
      break;
    case "potion_effect":
      if (item.effectType && item.magnitude && item.durationMinutes) {
        await createEffect(player.id, item.effectType, item.magnitude, item.durationMinutes);
      }
      break;
    case "equipment":
      // not implemented yet — just give gold as fallback
      await db.update(players).set({ gold: player.gold + 50 }).where(eq(players.id, player.id));
      break;
  }

  return item;
}

// ─── CLASS RESET ───────────────────────────────────────────────────────

export const CLASS_RESET_COST = 500;

export async function resetClass(player: Player, newClass: Class): Promise<void> {
  const c = newClass;
  const baseStats = getClassBaseStats(c);
  const raceB = getRaceBonuses(player.race as Race);

  // Keep current level, recalculate stats for new class
  const newStr = baseStats.str + raceB.str;
  const newAgi = baseStats.agi + raceB.agi;
  const newInt = baseStats.int + raceB.int;
  const newVit = baseStats.vit + raceB.vit;

  await db
    .update(players)
    .set({
      class: c,
      gold: player.gold - CLASS_RESET_COST,
      strength: newStr,
      agility: newAgi,
      intelligence: newInt,
      vitality: newVit,
      freeStatPoints: player.freeStatPoints,
    })
    .where(eq(players.id, player.id));
}

// ─── TG STARS SHOP ─────────────────────────────────────────────────────

export const DIAMOND_PACKS = [
  { diamonds: 25, stars: 100, label: "25 💎" },
  { diamonds: 100, stars: 400, label: "100 💎" },
] as const;

export const LOOT_BOX_PRICE = 20; // diamonds
export const LOOT_BOX_LABEL = "🎁 Лутбокс";

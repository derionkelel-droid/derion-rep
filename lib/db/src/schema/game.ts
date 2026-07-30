import { pgTable, serial, text, integer, boolean, decimal, bigint, timestamp, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const races = ["human", "elf", "dwarf", "orc"] as const;
export type Race = (typeof races)[number];

export const classes = ["warrior", "mage", "archer", "assassin"] as const;
export type Class = (typeof classes)[number];

export const equipmentSlots = ["weapon", "head", "chest", "legs", "feet", "accessory"] as const;
export type EquipmentSlot = (typeof equipmentSlots)[number];

export const armorTypes = ["cloth", "leather", "plate", "weapon"] as const;
export type ArmorType = (typeof armorTypes)[number];

export const npcTypes = ["advisor", "healer", "quest_giver", "junk_buyer", "shopkeeper", "alchemist"] as const;
export type NpcType = (typeof npcTypes)[number];

// ─── LOCATIONS ───────────────────────────────────────────────────────────────

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  requiredLevel: integer("required_level").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
});

export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// ─── EQUIPMENT ITEMS ─────────────────────────────────────────────────────────

export const equipmentItems = pgTable("equipment_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slot: text("slot", { enum: equipmentSlots }).notNull(),
  armorType: text("armor_type", { enum: armorTypes }).notNull(),
  requiredLevel: integer("required_level").notNull().default(1),
  requiredClass: text("required_class", { enum: classes }),
  bonusStrength: integer("bonus_strength").notNull().default(0),
  bonusAgility: integer("bonus_agility").notNull().default(0),
  bonusIntelligence: integer("bonus_intelligence").notNull().default(0),
  bonusVitality: integer("bonus_vitality").notNull().default(0),
  bonusHp: integer("bonus_hp").notNull().default(0),
  bonusAttack: integer("bonus_attack").notNull().default(0),
  bonusDefense: integer("bonus_defense").notNull().default(0),
  price: integer("price").notNull().default(0),
  isShopItem: boolean("is_shop_item").notNull().default(false),
  locationId: integer("location_id"),
  description: text("description").notNull().default(""),
});

export const insertEquipmentSchema = createInsertSchema(equipmentItems).omit({ id: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type EquipmentItem = typeof equipmentItems.$inferSelect;

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  username: text("username"),
  nickname: text("nickname").notNull(),
  race: text("race", { enum: races }).notNull(),
  class: text("class", { enum: classes }).notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  gold: integer("gold").notNull().default(100),
  currentLocationId: integer("current_location_id")
    .notNull()
    .default(1)
    .references(() => locations.id),

  strength: integer("strength").notNull().default(5),
  agility: integer("agility").notNull().default(5),
  intelligence: integer("intelligence").notNull().default(5),
  vitality: integer("vitality").notNull().default(5),
  freeStatPoints: integer("free_stat_points").notNull().default(0),

  currentHp: integer("current_hp").notNull().default(100),
  maxHp: integer("max_hp").notNull().default(100),

  equippedWeaponId: integer("equipped_weapon_id"),
  equippedHeadId: integer("equipped_head_id"),
  equippedChestId: integer("equipped_chest_id"),
  equippedLegsId: integer("equipped_legs_id"),
  equippedFeetId: integer("equipped_feet_id"),
  equippedAccessoryId: integer("equipped_accessory_id"),

  diamonds: integer("diamonds").notNull().default(0),
  totalKills: integer("total_kills").notNull().default(0),
  totalDeaths: integer("total_deaths").notNull().default(0),
  inCombat: boolean("in_combat").notNull().default(false),
  combatMonsterId: integer("combat_monster_id"),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

// ─── INVENTORY ───────────────────────────────────────────────────────────────

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => equipmentItems.id),
  quantity: integer("quantity").notNull().default(1),
});

export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;

// ─── MONSTERS ────────────────────────────────────────────────────────────────

export const monsters = pgTable("monsters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id),
  level: integer("level").notNull().default(1),
  baseHp: integer("base_hp").notNull().default(50),
  baseAttack: integer("base_attack").notNull().default(10),
  baseDefense: integer("base_defense").notNull().default(5),
  xpReward: integer("xp_reward").notNull().default(20),
  goldRewardMin: integer("gold_reward_min").notNull().default(5),
  goldRewardMax: integer("gold_reward_max").notNull().default(15),
});

export const insertMonsterSchema = createInsertSchema(monsters).omit({ id: true });
export type InsertMonster = z.infer<typeof insertMonsterSchema>;
export type Monster = typeof monsters.$inferSelect;

// ─── MONSTER DROPS ───────────────────────────────────────────────────────────

export const monsterDrops = pgTable("monster_drops", {
  id: serial("id").primaryKey(),
  monsterId: integer("monster_id")
    .notNull()
    .references(() => monsters.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => equipmentItems.id),
  dropChance: decimal("drop_chance", { precision: 4, scale: 1 }).notNull().default("5.0"),
});

export const insertMonsterDropSchema = createInsertSchema(monsterDrops).omit({ id: true });
export type InsertMonsterDrop = z.infer<typeof insertMonsterDropSchema>;
export type MonsterDrop = typeof monsters.$inferSelect;

// ─── NPCS ────────────────────────────────────────────────────────────────────

export const npcs = pgTable("npcs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id),
  greeting: text("greeting").notNull(),
  advice: text("advice").notNull(),
  npcType: text("npc_type", { enum: npcTypes }).notNull().default("advisor"),
  healCostPerHp: integer("heal_cost_per_hp").notNull().default(0),
});

export const insertNpcSchema = createInsertSchema(npcs).omit({ id: true });
export type InsertNpc = z.infer<typeof insertNpcSchema>;
export type Npc = typeof npcs.$inferSelect;

// ─── COMBAT SESSIONS ────────────────────────────────────────────────────────

export const combatSessions = pgTable("combat_sessions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  monsterId: integer("monster_id").notNull(),
  monsterName: text("monster_name").notNull(),
  monsterHp: integer("monster_hp").notNull(),
  monsterMaxHp: integer("monster_max_hp").notNull(),
  monsterAttack: integer("monster_attack").notNull(),
  monsterDefense: integer("monster_defense").notNull(),
  monsterLevel: integer("monster_level").notNull(),
  xpReward: integer("xp_reward").notNull(),
  goldMin: integer("gold_min").notNull(),
  goldMax: integer("gold_max").notNull(),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id),
  round: integer("round").notNull().default(1),
  hits: integer("hits").notNull().default(0),
  blocks: integer("blocks").notNull().default(0),
  misses: integer("misses").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCombatSessionSchema = createInsertSchema(combatSessions).omit({ id: true, createdAt: true });
export type InsertCombatSession = z.infer<typeof insertCombatSessionSchema>;
export type CombatSession = typeof combatSessions.$inferSelect;

// ─── QUESTS ─────────────────────────────────────────────────────────────────

export const quests = pgTable("quests", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  npcId: integer("npc_id")
    .notNull()
    .references(() => npcs.id),
  targetMonsterName: text("target_monster_name").notNull(),
  targetMonsterLocationId: integer("target_monster_location_id").notNull(),
  targetQuantity: integer("target_quantity").notNull().default(5),
  currentProgress: integer("current_progress").notNull().default(0),
  rewardXp: integer("reward_xp").notNull().default(100),
  rewardGold: integer("reward_gold").notNull().default(50),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuestSchema = createInsertSchema(quests).omit({ id: true, createdAt: true });
export type InsertQuest = z.infer<typeof insertQuestSchema>;
export type Quest = typeof quests.$inferSelect;

// ─── JUNK ITEMS ──────────────────────────────────────────────────────────

export const junkItems = pgTable("junk_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sellPrice: integer("sell_price").notNull().default(1),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id),
});

export const insertJunkItemSchema = createInsertSchema(junkItems).omit({ id: true });
export type InsertJunkItem = z.infer<typeof insertJunkItemSchema>;
export type JunkItem = typeof junkItems.$inferSelect;

// ─── MONSTER JUNK DROPS ─────────────────────────────────────────────────

export const monsterJunkDrops = pgTable("monster_junk_drops", {
  id: serial("id").primaryKey(),
  monsterId: integer("monster_id")
    .notNull()
    .references(() => monsters.id, { onDelete: "cascade" }),
  junkItemId: integer("junk_item_id")
    .notNull()
    .references(() => junkItems.id),
  dropChance: decimal("drop_chance", { precision: 4, scale: 1 }).notNull().default("30.0"),
  minQuantity: integer("min_quantity").notNull().default(1),
  maxQuantity: integer("max_quantity").notNull().default(3),
});

export const insertMonsterJunkDropSchema = createInsertSchema(monsterJunkDrops).omit({ id: true });
export type InsertMonsterJunkDrop = typeof monsterJunkDrops.$inferInsert;
export type MonsterJunkDrop = typeof monsterJunkDrops.$inferSelect;

// ─── JUNK INVENTORY ──────────────────────────────────────────────────────

export const junkInventory = pgTable("junk_inventory", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  junkItemId: integer("junk_item_id")
    .notNull()
    .references(() => junkItems.id),
  quantity: integer("quantity").notNull().default(1),
});

export const insertJunkInventorySchema = createInsertSchema(junkInventory).omit({ id: true });
export type InsertJunkInventory = z.infer<typeof insertJunkInventorySchema>;
export type JunkInventory = typeof junkInventory.$inferSelect;

// ─── PLAYER ACHIEVEMENTS ───────────────────────────────────────────────

export const playerAchievements = pgTable("player_achievements", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  achievementKey: text("achievement_key").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
});

export type PlayerAchievement = typeof playerAchievements.$inferSelect;

// ─── PLAYER EFFECTS (temporary potion buffs) ────────────────────────────
export const effectTypes = ["atk_boost", "def_boost", "hp_regen", "berserk"] as const;
export type EffectType = (typeof effectTypes)[number];

export const playerEffects = pgTable("player_effects", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  effectType: text("effect_type", { enum: effectTypes }).notNull(),
  magnitude: integer("magnitude").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlayerEffectSchema = createInsertSchema(playerEffects).omit({ id: true, createdAt: true });
export type InsertPlayerEffect = z.infer<typeof insertPlayerEffectSchema>;
export type PlayerEffect = typeof playerEffects.$inferSelect;

// ─── RELATIONS ─────────────────────────────────────────────────────────────

import { relations } from "drizzle-orm";

export const inventoryRelations = relations(inventory, ({ one }) => ({
  item: one(equipmentItems, {
    fields: [inventory.itemId],
    references: [equipmentItems.id],
  }),
}));

export const equipmentItemsRelations = relations(equipmentItems, ({ many }) => ({
  inventoryItems: many(inventory),
  monsterDrops: many(monsterDrops),
}));

export const monsterDropsRelations = relations(monsterDrops, ({ one }) => ({
  monster: one(monsters, {
    fields: [monsterDrops.monsterId],
    references: [monsters.id],
  }),
  item: one(equipmentItems, {
    fields: [monsterDrops.itemId],
    references: [equipmentItems.id],
  }),
}));

export const junkItemsRelations = relations(junkItems, ({ many }) => ({
  monsterDrops: many(monsterJunkDrops),
  inventoryEntries: many(junkInventory),
}));

export const monsterJunkDropsRelations = relations(monsterJunkDrops, ({ one }) => ({
  monster: one(monsters, {
    fields: [monsterJunkDrops.monsterId],
    references: [monsters.id],
  }),
  junkItem: one(junkItems, {
    fields: [monsterJunkDrops.junkItemId],
    references: [junkItems.id],
  }),
}));

export const junkInventoryRelations = relations(junkInventory, ({ one }) => ({
  player: one(players, {
    fields: [junkInventory.playerId],
    references: [players.id],
  }),
  junkItem: one(junkItems, {
    fields: [junkInventory.junkItemId],
    references: [junkItems.id],
  }),
}));

export const playerEffectsRelations = relations(playerEffects, ({ one }) => ({
  player: one(players, {
    fields: [playerEffects.playerId],
    references: [players.id],
  }),
}));

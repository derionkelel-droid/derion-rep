import { InlineKeyboard } from "grammy";
import { getAttackZones, getBlockZones } from "./combat";
import type { SkillDef } from "./game";

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text("⚔️ Поход", "adventure")
    .text("🎒 Инвентарь", "inventory")
    .row()
    .text("👤 Профиль", "profile")
    .text("🗺 Локации", "locations")
    .row()
    .text("🧑‍🤝‍🧑 Жители", "npc")
    .text("📋 Меню", "menu");
}

export function menuKeyboard() {
  return new InlineKeyboard()
    .text("🏆 Достижения", "achievements")
    .text("📊 Статистика", "stats")
    .row()
    .text("🏪 Магазин", "shop")
    .row()
    .text("🔙 Назад", "main_menu");
}

export function achievementsKeyboard(unlockedKeys: Set<string>) {
  const kb = new InlineKeyboard();
  // No inline actions per achievement — just list
  kb.text("🔙 Назад", "menu");
  return kb;
}

export function statsKeyboard() {
  return new InlineKeyboard()
    .text("🔄 Сменить класс (500🪙)", "class_reset")
    .row()
    .text("🔙 Назад", "menu");
}

export function shopKeyboard(diamonds = 0) {
  return new InlineKeyboard()
    .text("25💎 — 100⭐", "buy_diamonds_25")
    .text("100💎 — 400⭐", "buy_diamonds_100")
    .row()
    .text(`🎁 Лутбокс (20💎)`, "buy_lootbox")
    .row()
    .text("🔙 Назад", "menu");
}

export function raceKeyboard() {
  return new InlineKeyboard()
    .text("👤 Человек", "race_human")
    .text("🧝 Эльф", "race_elf")
    .row()
    .text("⛏️ Дворф", "race_dwarf")
    .text("💀 Орк", "race_orc");
}

export function classKeyboard() {
  return new InlineKeyboard()
    .text("⚔️ Воин", "class_warrior")
    .text("🔮 Маг", "class_mage")
    .row()
    .text("🏹 Лучник", "class_archer")
    .text("🗡️ Ассасин", "class_assassin");
}

export function attackKeyboard() {
  const kb = new InlineKeyboard();
  const zones = getAttackZones();
  for (let i = 0; i < zones.length; i++) {
    kb.text(zones[i].label, `atk_${i}`);
    if (i < zones.length - 1) kb.text("│", "sep_atk_" + i);
    if (i % 2 === 1) kb.row();
  }
  if (zones.length % 2 !== 0) kb.row();
  return kb;
}

export function blockKeyboard() {
  const kb = new InlineKeyboard();
  const blocks = getBlockZones();
  for (let i = 0; i < blocks.length; i++) {
    kb.text(blocks[i].label, `blk_${i}`);
    kb.row();
  }
  return kb;
}

export function combatActionsKeyboard() {
  return new InlineKeyboard()
    .text("⚔️ Атаковать", "combat_attack")
    .text("🏃 Сбежать", "combat_run");
}

export function continueCombatKeyboard() {
  return new InlineKeyboard()
    .text("⚔️ Следующий раунд", "combat_next")
    .text("🏃 Сбежать", "combat_run");
}

export function skillCombatKeyboard(skills: SkillDef[]) {
  const kb = new InlineKeyboard();
  for (const s of skills) {
    kb.text(`${s.icon} ${s.name}`, `skill_${s.id}`).row();
  }
  return kb;
}

export function combatActionSelectionKeyboard(skills: SkillDef[], canUse: boolean[]) {
  const kb = new InlineKeyboard()
    .text("⚔️ Атака", "combat_atk_now")
    .text("🏃 Сбежать", "combat_run");
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    const label = canUse[i] ? `${s.icon} ${s.name}` : `🔒 ${s.name}`;
    const data = canUse[i] ? `skill_${s.id}` : "noop";
    kb.row().text(label, data);
  }
  return kb;
}

export function inventoryKeyboard(items: { id: number; name: string; slot: string; isEquipped: boolean }[], page = 0) {
  const perPage = 6;
  const totalPages = Math.ceil(items.length / perPage) || 1;
  const pageItems = items.slice(page * perPage, (page + 1) * perPage);
  const kb = new InlineKeyboard();

  for (const item of pageItems) {
    const label = item.isEquipped ? `✅ ${item.name}` : item.name;
    kb.text(label, `inv_${item.id}`);
    kb.row();
  }

  if (totalPages > 1) {
    if (page > 0) kb.text("⬅️ Назад", `inv_page_${page - 1}`);
    kb.text(`${page + 1}/${totalPages}`, "inv_page_info");
    if (page < totalPages - 1) kb.text("➡️ Вперёд", `inv_page_${page + 1}`);
    kb.row();
  }

  kb.text("🔙 Назад", "main_menu");
  return kb;
}

export function equipActionKeyboard(itemId: number, isEquipped: boolean) {
  const kb = new InlineKeyboard();
  if (!isEquipped) {
    kb.text("✅ Надеть", `equip_${itemId}`);
  } else {
    kb.text("❌ Снять", `unequip_${itemId}`);
  }
  kb.row();
  kb.text("🔙 Назад", "inventory");
  return kb;
}

export function locationShopKeyboard(items: { id: number; name: string; price: number }[], page = 0) {
  const perPage = 6;
  const totalPages = Math.ceil(items.length / perPage) || 1;
  const pageItems = items.slice(page * perPage, (page + 1) * perPage);
  const kb = new InlineKeyboard();

  for (const item of pageItems) {
    kb.text(`${item.name} — 🪙${item.price}`, `buy_${item.id}`);
    kb.row();
  }

  if (totalPages > 1) {
    if (page > 0) kb.text("⬅️ Назад", `shop_page_${page - 1}`);
    kb.text(`${page + 1}/${totalPages}`, "shop_page_info");
    if (page < totalPages - 1) kb.text("➡️ Вперёд", `shop_page_${page + 1}`);
    kb.row();
  }

  kb.text("🔙 Назад", "npc");
  return kb;
}

export function locationsKeyboard(locations: { id: number; name: string; requiredLevel: number }[], playerLevel: number) {
  const kb = new InlineKeyboard();
  for (const loc of locations) {
    const unlocked = playerLevel >= loc.requiredLevel;
    const label = unlocked ? `🗺️ ${loc.name}` : `🔒 ${loc.name} (ур. ${loc.requiredLevel})`;
    if (unlocked) {
      kb.text(label, `loc_${loc.id}`);
    } else {
      kb.text(label, "noop");
    }
    kb.row();
  }
  kb.text("🔙 Назад", "main_menu");
  return kb;
}

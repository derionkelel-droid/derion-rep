import { Bot, Context, InlineKeyboard } from "grammy";
import { db, players } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getPlayer,
  getInventory,
  getLocation,
  getAvailableLocations,
  getRandomMonster,
  getNpcForLocation,
  checkDrop,
  addItemToInventory,
  calculateMaxHp,
  calculateAttack,
  calculateDefense,
  getRaceName,
  getClassName,
  getRaceBonuses,
  getClassBaseStats,
  canEquipClass,
  canEquipLevel,
  equipItem,
  unequipItem,
  formatPlayerProfile,
  loadEquippedStats,
  type Player,
} from "./game";
import {
  mainMenuKeyboard,
  raceKeyboard,
  classKeyboard,
  attackKeyboard,
  blockKeyboard,
  continueCombatKeyboard,
  inventoryKeyboard,
  equipActionKeyboard,
  shopKeyboard,
  locationsKeyboard,
} from "./keyboards";
import { resolveRound } from "./combat";

// ─── SESSION STATE ───────────────────────────────────────────────────────────

// Track combat state per user (in memory since it's transient)
const combatState = new Map<
  number,
  {
    monsterId: number;
    monsterName: string;
    monsterHp: number;
    monsterMaxHp: number;
    monsterAttack: number;
    monsterDefense: number;
    monsterLevel: number;
    xpReward: number;
    goldMin: number;
    goldMax: number;
    locationId: number;
  }
>();

// Store pending attack zone choice
const pendingAttack = new Map<number, string>();
const pendingBlock = new Map<number, string>();

// ─── REGISTER HANDLERS ───────────────────────────────────────────────────────

export function registerHandlers(bot: Bot) {
  // ── /start ──────────────────────────────────────────────────────────────
  bot.command("start", async (ctx: Context) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const player = await getPlayer(telegramId);
    if (!player) {
      await ctx.reply(
        `⚔️ <b>Добро пожаловать в MMORPG Battle!</b>

Мир ждёт своего героя. Ты готов к приключениям?

Для начала — представься: напиши своё имя (никнейм).`,
        { parse_mode: "HTML" },
      );
      // Store that we're waiting for nickname
      await ctx.session?.set("awaiting_nickname", true);
    } else {
      await ctx.reply(
        `С возвращением, ${player.nickname}!${player.inCombat ? "\n\n⚠️ У тебя есть незаконченный бой!" : ""}`,
        {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(),
        },
      );
    }
  });

  // ── TEXT HANDLER (nickname) ─────────────────────────────────────────────
  bot.on("message:text", async (ctx: Context) => {
    const telegramId = ctx.from?.id;
    if (!telegramId || !ctx.message?.text) return;

    const awaiting = await ctx.session?.get("awaiting_nickname");
    if (awaiting) {
      const nickname = ctx.message.text.trim().slice(0, 20);
      if (nickname.length < 2) {
        await ctx.reply("Имя должно содержать хотя бы 2 символа. Попробуй ещё раз:");
        return;
      }
      await ctx.session?.set("awaiting_nickname", false);
      await ctx.session?.set("pending_nickname", nickname);
      await ctx.reply(
        `Отлично, ${nickname}! Теперь выбери свою расу:`,
        { reply_markup: raceKeyboard() },
      );
      return;
    }

    // Check if player is in combat — ignore text
    const player = await getPlayer(telegramId);
    if (player?.inCombat) {
      await ctx.reply("Ты в бою! Используй кнопки под сообщением.", {
        reply_markup: continueCombatKeyboard(),
      });
      return;
    }
  });

  // ── CALLBACK QUERIES ────────────────────────────────────────────────────
  bot.on("callback_query:data", async (ctx: Context) => {
    const telegramId = ctx.from?.id;
    if (!telegramId || !ctx.callbackQuery?.data) return;

    const data = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    // ── RACE SELECTION ────────────────────────────────────────────────
    if (data.startsWith("race_")) {
      const race = data.replace("race_", "");
      await db
        .update(players)
        .set({ race } as any)
        .where(eq(players.telegramId, telegramId));
      await ctx.session?.set("pending_race", race);
      await ctx.editMessageText("Теперь выбери свой класс:", {
        reply_markup: classKeyboard(),
      });
      return;
    }

    // ── CLASS SELECTION ───────────────────────────────────────────────
    if (data.startsWith("class_")) {
      const c = data.replace("class_", "");
      const nickname = await ctx.session?.get("pending_nickname");
      const race = await ctx.session?.get("pending_race");
      if (!nickname || !race) {
        await ctx.editMessageText("Ошибка создания персонажа. Начни заново — /start");
        return;
      }

      const rb = getRaceBonuses(race as any);
      const cb = getClassBaseStats(c as any);
      const strength = rb.str + cb.str;
      const agility = rb.agi + cb.agi;
      const intelligence = rb.int + cb.int;
      const vitality = rb.vit + cb.vit;
      const maxHp = 100 + vitality * (c === "warrior" ? 20 : c === "mage" ? 10 : c === "archer" ? 14 : 12);

      await db.insert(players).values({
        telegramId,
        nickname,
        race,
        class: c,
        strength,
        agility,
        intelligence,
        vitality,
        currentHp: maxHp,
        maxHp,
        currentLocationId: 1,
      } as any);

      await ctx.session?.set("pending_nickname", undefined);
      await ctx.session?.set("pending_race", undefined);

      await ctx.editMessageText(
        `🎉 <b>Персонаж создан!</b>

Имя: ${nickname}
Раса: ${getRaceName(race as any)}
Класс: ${getClassName(c as any)}

Твоё приключение начинается на Начальной поляне. Удачи, герой! ⚔️`,
        { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
      );
      return;
    }

    // ── MAIN MENU ─────────────────────────────────────────────────────
    if (data === "main_menu") {
      const player = await getPlayer(telegramId);
      if (!player) {
        await ctx.editMessageText("Начни с /start");
        return;
      }
      await ctx.editMessageText(
        `Главное меню, ${player.nickname} 🎮`,
        { reply_markup: mainMenuKeyboard() },
      );
      return;
    }

    if (data === "noop") {
      return;
    }

    // ── ADVENTURE ─────────────────────────────────────────────────────
    if (data === "adventure") {
      const player = await getPlayer(telegramId);
      if (!player) return;
      if (player.inCombat) {
        await ctx.editMessageText("⚠️ Ты уже в бою!", { reply_markup: continueCombatKeyboard() });
        return;
      }
      if (player.currentHp <= 0) {
        await ctx.editMessageText(
          "💀 Ты без сознания! Отдохни немного (восстановление HP).",
        );
        return;
      }
      const loc = await getLocation(player.currentLocationId);
      if (!loc) return;

      await ctx.editMessageText(
        `📍 <b>${loc.name}</b>\n${loc.description}\n\nИщешь монстра для охоты...`,
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔍 Искать монстра", "search_monster").text("🔙 Назад", "main_menu") },
      );
      return;
    }

    // ── SEARCH MONSTER ────────────────────────────────────────────────
    if (data === "search_monster") {
      const player = await getPlayer(telegramId);
      if (!player) return;
      const monster = await getRandomMonster(player.currentLocationId!);
      if (!monster) {
        await ctx.editMessageText("В этой локации нет монстров...");
        return;
      }

      // Scale monster stats by level
      const levelMultiplier = monster.level;
      const currentHp = monster.baseHp + levelMultiplier * 15;
      const atk = monster.baseAttack + levelMultiplier * 3;
      const def = monster.baseDefense + levelMultiplier * 1.5;

      // Save combat state
      combatState.set(telegramId, {
        monsterId: monster.id,
        monsterName: monster.name,
        monsterHp: currentHp,
        monsterMaxHp: currentHp,
        monsterAttack: atk,
        monsterDefense: def,
        monsterLevel: monster.level,
        xpReward: monster.xpReward,
        goldMin: monster.goldRewardMin,
        goldMax: monster.goldRewardMax,
        locationId: player.currentLocationId!,
      });

      // Set player in combat
      await db
        .update(players)
        .set({ inCombat: true, combatMonsterId: monster.id })
        .where(eq(players.id, player.id));

      const msg = `👹 <b>${monster.name}</b> (Ур. ${monster.level})
❤️ HP: ${currentHp} | ⚔️ Атака: ${atk} | 🛡️ Защита: ${def}

Бой начинается!`;

      await ctx.editMessageText(msg, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("⚔️ Атаковать", "combat_attack").text("🏃 Сбежать", "combat_run"),
      });
      return;
    }

    // ── COMBAT ─────────────────────────────────────────────────────────
    if (data === "combat_attack") {
      pendingAttack.set(telegramId, "");
      await ctx.editMessageText("🎯 Выбери зону <b>атаки</b>:", {
        parse_mode: "HTML",
        reply_markup: attackKeyboard(),
      });
      return;
    }

    if (data === "combat_next") {
      pendingAttack.set(telegramId, "");
      await ctx.editMessageText("🎯 Выбери зону <b>атаки</b>:", {
        parse_mode: "HTML",
        reply_markup: attackKeyboard(),
      });
      return;
    }

    if (data.startsWith("atk_")) {
      const idx = parseInt(data.replace("atk_", ""));
      const zones = ["голова", "грудь", "живот", "пояс", "ноги"];
      if (idx >= 0 && idx < zones.length) {
        pendingAttack.set(telegramId, zones[idx]);
        await ctx.editMessageText("🛡️ Теперь выбери зону <b>блока</b>:", {
          parse_mode: "HTML",
          reply_markup: blockKeyboard(),
        });
      }
      return;
    }

    if (data.startsWith("blk_")) {
      const idx = parseInt(data.replace("blk_", ""));
      const blockZones: [string, string][] = [
        ["голова", "грудь"],
        ["грудь", "живот"],
        ["живот", "пояс"],
        ["пояс", "ноги"],
        ["ноги", "голова"],
      ];
      if (idx >= 0 && idx < blockZones.length) {
        const attackZone = pendingAttack.get(telegramId) || "грудь";
        const blockZone = blockZones[idx];
        pendingAttack.delete(telegramId);

        const player = await getPlayer(telegramId);
        if (!player) return;

        const state = combatState.get(telegramId);
        if (!state) {
          await ctx.editMessageText("⚠️ Ошибка: бой не найден. Начни заново.", {
            reply_markup: mainMenuKeyboard(),
          });
          return;
        }

        // Load equipment stats for this round
        const equipStats = await loadEquippedStats(player);
        // Resolve round
        const result = resolveRound(
          player,
          attackZone,
          blockZone,
          state.monsterHp,
          state.monsterAttack,
          state.monsterDefense,
          equipStats.bonusAttack,
          equipStats.bonusDefense,
        );

        // Update monster HP in state
        state.monsterHp = result.monsterNewHp;

        // Update player HP in DB
        await db
          .update(players)
          .set({ currentHp: result.playerNewHp })
          .where(eq(players.id, player.id));

        const logText = result.log.join("\n");

        // Check if monster died
        if (result.monsterNewHp <= 0) {
          const xpGain = state.xpReward + state.monsterLevel * 20;
          const goldGain = state.goldMin + Math.floor(Math.random() * (state.goldMax - state.goldMin + 1));

          // Update player
          const updatedPlayer = await getPlayer(telegramId);
          if (!updatedPlayer) return;

          const newXp = updatedPlayer.xp + xpGain;
          const newGold = updatedPlayer.gold + goldGain;
          let newLevel = updatedPlayer.level;
          let newFreePoints = updatedPlayer.freeStatPoints;
          let leveledUp = false;
          let remainingXp = newXp;

          // Level up check (max 50)
          while (newLevel < 50) {
            const xpNeeded = Math.floor(100 * newLevel * 1.4);
            if (remainingXp >= xpNeeded) {
              remainingXp -= xpNeeded;
              newLevel++;
              newFreePoints += 5;
              leveledUp = true;
            } else {
              break;
            }
          }

          // Check for level up location unlock
          let locationUnlock = "";
          if (newLevel % 5 === 0 && leveledUp) {
            const newLoc = await db.query.locations.findFirst({
              where: (l, { eq: op }) => op(l.requiredLevel, newLevel),
            });
            if (newLoc) {
              locationUnlock = `\n\n🗺️ <b>Новая локация открыта:</b> ${newLoc.name}!`;
            }
          }

          // Check for drop
          let dropText = "";
          const drop = await checkDrop(state.monsterId);
          if (drop) {
            await addItemToInventory(player.id, drop.id);
            dropText = `\n\n🎁 <b>Трофей:</b> ${drop.name}!`;
          }

          // End combat
          combatState.delete(telegramId);
          await db
            .update(players)
            .set({
              inCombat: false,
              combatMonsterId: null,
              gold: newGold,
              xp: leveledUp ? remainingXp : newXp,
              level: newLevel,
              freeStatPoints: newFreePoints,
              currentHp: result.playerNewHp,
            })
            .where(eq(players.id, player.id));

          // Recalculate max HP for new level
          if (leveledUp) {
            const refreshed = await getPlayer(telegramId);
            if (refreshed) {
              const newMaxHp = calculateMaxHp(refreshed);
              await db
                .update(players)
                .set({ maxHp: newMaxHp })
                .where(eq(players.id, player.id));
            }
          }

          const victoryMsg = `${logText}\n\n🎉 <b>ПОБЕДА!</b>
🏆 Монстр ${state.monsterName} повержен!
✨ +${xpGain} XP | 🪙 +${goldGain} золота${dropText}${leveledUp ? `\n\n⬆️ <b>УРОВЕНЬ ${newLevel}!</b> (+5 очков навыков)` : ""}${locationUnlock}`;

          await ctx.editMessageText(victoryMsg, {
            parse_mode: "HTML",
            reply_markup: mainMenuKeyboard(),
          });
          return;
        }

        // Check if player died
        if (result.playerNewHp <= 0) {
          combatState.delete(telegramId);
          const maxHp = calculateMaxHp(player);
          await db
            .update(players)
            .set({
              inCombat: false,
              combatMonsterId: null,
              currentHp: Math.floor(maxHp / 2), // Respawn with half HP
            })
            .where(eq(players.id, player.id));

          const deathMsg = `${logText}\n\n💀 <b>Ты погиб...</b>
Но не отчаивайся — ты восстановился с половиной HP!`;

          await ctx.editMessageText(deathMsg, {
            parse_mode: "HTML",
            reply_markup: mainMenuKeyboard(),
          });
          return;
        }

        // Combat continues
        combatState.set(telegramId, state);
        const continueMsg = `${logText}\n\n👹 <b>${state.monsterName}</b> — ❤️ ${result.monsterNewHp}/${state.monsterMaxHp}`;

        await ctx.editMessageText(continueMsg, {
          parse_mode: "HTML",
          reply_markup: continueCombatKeyboard(),
        });
      }
      return;
    }

    // ── COMBAT RUN ────────────────────────────────────────────────────
    if (data === "combat_run") {
      const player = await getPlayer(telegramId);
      if (!player) return;

      combatState.delete(telegramId);
      const maxHp = calculateMaxHp(player);

      await db
        .update(players)
        .set({
          inCombat: false,
          combatMonsterId: null,
        })
        .where(eq(players.id, player.id));

      await ctx.editMessageText("🏃 Ты успешно сбежал из боя!", {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    // ── PROFILE ───────────────────────────────────────────────────────
    if (data === "profile") {
      const player = await getPlayer(telegramId);
      if (!player) return;
      const msg = await formatPlayerProfile(player);

      const kb = new InlineKeyboard();
      if (player.freeStatPoints > 0) {
        kb.text("⬆️ Распределить очки", "stats_up");
        kb.row();
      }
      kb.text("🔙 Назад", "main_menu");

      await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    // ── STAT UP ───────────────────────────────────────────────────────
    if (data === "stats_up") {
      const player = await getPlayer(telegramId);
      if (!player || player.freeStatPoints <= 0) {
        await ctx.editMessageText("Нет свободных очков навыков.", { reply_markup: mainMenuKeyboard() });
        return;
      }

      const kb = new InlineKeyboard()
        .text(`💪 Сила (${player.strength})`, "stat_str")
        .text(`🏃 Ловкость (${player.agility})`, "stat_agi")
        .row()
        .text(`🧠 Интеллект (${player.intelligence})`, "stat_int")
        .text(`❤️‍🔥 Живучесть (${player.vitality})`, "stat_vit")
        .row()
        .text(`⬅️ Готово (осталось: ${player.freeStatPoints})`, "profile");

      await ctx.editMessageText(
        `⬆️ Распределение очков навыков\nОсталось: ${player.freeStatPoints}\n\nВыбери характеристику для повышения:`,
        { reply_markup: kb },
      );
      return;
    }

    if (["stat_str", "stat_agi", "stat_int", "stat_vit"].includes(data)) {
      const player = await getPlayer(telegramId);
      if (!player || player.freeStatPoints <= 0) return;

      const statMap: Record<string, string> = {
        stat_str: "strength",
        stat_agi: "agility",
        stat_int: "intelligence",
        stat_vit: "vitality",
      };
      const column = statMap[data];
      if (!column) return;

      const current = player[column as keyof Player] as number;
      await db
        .update(players)
        .set({
          [column]: current + 1,
          freeStatPoints: player.freeStatPoints - 1,
        } as any)
        .where(eq(players.id, player.id));

      // Show stats menu again
      const updated = await getPlayer(telegramId);
      if (!updated) return;
      const kb = new InlineKeyboard()
        .text(`💪 Сила (${updated.strength})`, "stat_str")
        .text(`🏃 Ловкость (${updated.agility})`, "stat_agi")
        .row()
        .text(`🧠 Интеллект (${updated.intelligence})`, "stat_int")
        .text(`❤️‍🔥 Живучесть (${updated.vitality})`, "stat_vit")
        .row()
        .text(`⬅️ Готово (осталось: ${updated.freeStatPoints})`, "profile");

      await ctx.editMessageText(
        updated.freeStatPoints > 0
          ? `⬆️ Распределение очков навыков\nОсталось: ${updated.freeStatPoints}\n\n✅ ${column === "strength" ? "Сила" : column === "agility" ? "Ловкость" : column === "intelligence" ? "Интеллект" : "Живучесть"} повышена!`
          : "✅ Все очки распределены!",
        { reply_markup: kb },
      );
      return;
    }

    // ── INVENTORY ─────────────────────────────────────────────────────
    if (data === "inventory") {
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      if (inv.length === 0) {
        await ctx.editMessageText("🎒 Твой инвентарь пуст.\n\nОтправляйся в поход, чтобы добыть снаряжение!", {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }

      // Build slots display
      const slotMap: Record<string, string> = {
        weapon: "⚔️ Оружие",
        head: "🪖 Шлем",
        chest: "🛡️ Нагрудник",
        legs: "👖 Поножи",
        feet: "👢 Сапоги",
        accessory: "💍 Аксессуар",
      };

      const equippedIds = new Set([
        player.equippedWeaponId,
        player.equippedHeadId,
        player.equippedChestId,
        player.equippedLegsId,
        player.equippedFeetId,
        player.equippedAccessoryId,
      ].filter((id): id is number => id !== null));

      // Show equipped first
      const items = inv.map((entry) => ({
        invId: entry.id,
        itemId: entry.itemId,
        name: entry.item!.name,
        slot: entry.item!.slot,
        isEquipped: equippedIds.has(entry.itemId),
        quantity: entry.quantity,
      }));

      const sortedItems = items.sort((a, b) => (a.isEquipped ? -1 : 1));

      let msg = "🎒 <b>Инвентарь</b>\n━━━━━━━━━━━━━━━\n\n";
      // Show currently equipped
      msg += "<b>Экипировано:</b>\n";
      for (const item of sortedItems.filter((i) => i.isEquipped)) {
        msg += `${slotMap[item.slot] || item.slot}: ${item.name}\n`;
      }
      msg += `\n📦 <b>Предметы:</b>\n`;
      for (const item of sortedItems.filter((i) => !i.isEquipped)) {
        msg += `• ${item.name} x${item.quantity} (${slotMap[item.slot] || item.slot})\n`;
      }

      const kbItems = sortedItems.map((i) => ({
        id: i.invId,
        name: i.isEquipped ? `✅ ${i.name}` : i.name,
        slot: i.slot,
        isEquipped: i.isEquipped,
      }));

      await ctx.editMessageText(msg, {
        parse_mode: "HTML",
        reply_markup: inventoryKeyboard(kbItems),
      });
      return;
    }

    if (data.startsWith("inv_")) {
      const invId = parseInt(data.replace("inv_", ""));
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      const entry = inv.find((i) => i.id === invId);
      if (!entry || !entry.item) return;

      const item = entry.item;
      const slotMap: Record<string, string> = {
        weapon: "⚔️ Оружие",
        head: "🪖 Шлем",
        chest: "🛡️ Нагрудник",
        legs: "👖 Поножи",
        feet: "👢 Сапоги",
        accessory: "💍 Аксессуар",
      };

      const canEquip = canEquipClass(player.class as any, item) && canEquipLevel(player.level, item);
      const equippedIds = new Set([
        player.equippedWeaponId,
        player.equippedHeadId,
        player.equippedChestId,
        player.equippedLegsId,
        player.equippedFeetId,
        player.equippedAccessoryId,
      ].filter((id): id is number => id !== null));

      const isEquipped = equippedIds.has(item.id);

      let msg = `<b>${item.name}</b>
━━━━━━━━━━━━━━━
📂 Тип: ${slotMap[item.slot] || item.slot}
🏷️ Броня: ${item.armorType}
🔒 Треб. уровень: ${item.requiredLevel}
${item.requiredClass ? `👤 Класс: ${getClassName(item.requiredClass as any)}` : "👤 Любой класс"}

📊 <b>Характеристики:</b>
${item.bonusStrength ? `💪 Сила: +${item.bonusStrength}\n` : ""}${item.bonusAgility ? `🏃 Ловкость: +${item.bonusAgility}\n` : ""}${item.bonusIntelligence ? `🧠 Интеллект: +${item.bonusIntelligence}\n` : ""}${item.bonusVitality ? `❤️‍🔥 Живучесть: +${item.bonusVitality}\n` : ""}${item.bonusHp ? `❤️ HP: +${item.bonusHp}\n` : ""}${item.bonusAttack ? `⚔️ Атака: +${item.bonusAttack}\n` : ""}${item.bonusDefense ? `🛡️ Защита: +${item.bonusDefense}\n` : ""}
${item.description ? `📝 ${item.description}` : ""}`;

      if (!canEquip) {
        let reason = "";
        if (!canEquipLevel(player.level, item)) reason = "❌ Недостаточный уровень";
        else if (!canEquipClass(player.class as any, item)) reason = "❌ Неподходящий класс";
        msg += `\n\n${reason}`;
      }

      await ctx.editMessageText(msg, {
        parse_mode: "HTML",
        reply_markup: equipActionKeyboard(entry.id, isEquipped),
      });
      return;
    }

    if (data.startsWith("equip_")) {
      const invId = parseInt(data.replace("equip_", ""));
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      const entry = inv.find((i) => i.id === invId);
      if (!entry || !entry.item) return;

      const item = entry.item;
      if (!canEquipClass(player.class as any, item)) {
        await ctx.answerCallbackQuery({ text: "❌ Этот предмет не подходит твоему классу!" });
        return;
      }
      if (!canEquipLevel(player.level, item)) {
        await ctx.answerCallbackQuery({ text: "❌ Недостаточный уровень!" });
        return;
      }

      await equipItem(player.id, item.id);
      await ctx.answerCallbackQuery({ text: "✅ Предмет надет!" });

      // Refresh inventory view
      const freshInv = await getInventory(player.id);
      const equippedIds = new Set([
        player.equippedWeaponId,
        player.equippedHeadId,
        player.equippedChestId,
        player.equippedLegsId,
        player.equippedFeetId,
        player.equippedAccessoryId,
      ].filter((id): id is number => id !== null));

      const kbItems = freshInv.map((e) => ({
        id: e.id,
        name: e.item!.name,
        slot: e.item!.slot,
        isEquipped: equippedIds.has(e.itemId) || e.itemId === item.id,
      }));

      await ctx.editMessageText("✅ Предмет надет! Возвращаюсь в инвентарь...", {
        reply_markup: inventoryKeyboard(kbItems),
      });
      return;
    }

    if (data.startsWith("unequip_")) {
      const invId = parseInt(data.replace("unequip_", ""));
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      const entry = inv.find((i) => i.id === invId);
      if (!entry || !entry.item) return;

      await unequipItem(player.id, entry.item.slot as any);
      await ctx.answerCallbackQuery({ text: "❌ Предмет снят!" });

      const freshInv = await getInventory(player.id);
      const equippedIds = new Set([
        player.equippedWeaponId,
        player.equippedHeadId,
        player.equippedChestId,
        player.equippedLegsId,
        player.equippedFeetId,
        player.equippedAccessoryId,
      ].filter((id): id is number => id !== null));

      const kbItems = freshInv.map((e) => ({
        id: e.id,
        name: e.item!.name,
        slot: e.item!.slot,
        isEquipped: equippedIds.has(e.itemId) && e.itemId !== entry.item!.id,
      }));

      await ctx.editMessageText("❌ Предмет снят!", {
        reply_markup: inventoryKeyboard(kbItems),
      });
      return;
    }

    // ── SHOP ──────────────────────────────────────────────────────────
    if (data === "shop") {
      const player = await getPlayer(telegramId);
      if (!player) return;

      const shopItems = await db.query.equipmentItems.findMany({
        where: (eqi, { and: andOp, eq: eqOp, lte }) =>
          andOp(eqOp(eqi.isShopItem, true), lte(eqi.requiredLevel, player.level)),
      });

      if (shopItems.length === 0) {
        await ctx.editMessageText("🏪 В магазине пока нет товаров для твоего уровня.", {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }

      await ctx.editMessageText(
        `🏪 <b>Магазин экипировки</b>\n🪙 Твои монеты: ${player.gold}\n\nВыбери предмет для покупки:`,
        {
          parse_mode: "HTML",
          reply_markup: shopKeyboard(shopItems.map((i) => ({ id: i.id, name: i.name, price: i.price }))),
        },
      );
      return;
    }

    if (data.startsWith("buy_")) {
      const itemId = parseInt(data.replace("buy_", ""));
      const player = await getPlayer(telegramId);
      if (!player) return;

      const item = await db.query.equipmentItems.findFirst({
        where: (eqi, { eq: op }) => op(eqi.id, itemId),
      });
      if (!item) return;

      if (player.gold < item.price) {
        await ctx.answerCallbackQuery({
          text: `❌ Недостаточно золота! Нужно: ${item.price}, у тебя: ${player.gold}`,
        });
        return;
      }

      if (player.level < item.requiredLevel) {
        await ctx.answerCallbackQuery({
          text: `❌ Требуется уровень ${item.requiredLevel}!`,
        });
        return;
      }

      await db.update(players).set({ gold: player.gold - item.price }).where(eq(players.id, player.id));
      await addItemToInventory(player.id, item.id);

      await ctx.answerCallbackQuery({ text: `✅ Куплено: ${item.name}!` });

      // Refresh shop
      const shopItems = await db.query.equipmentItems.findMany({
        where: (eqi, { and: andOp, eq: eqOp, lte }) =>
          andOp(eqOp(eqi.isShopItem, true), lte(eqi.requiredLevel, player.level)),
      });

      const updatedPlayer = await getPlayer(telegramId);
      await ctx.editMessageText(
        `🏪 <b>Магазин экипировки</b>\n🪙 Твои монеты: ${updatedPlayer?.gold || 0}\n\nВыбери предмет для покупки:`,
        {
          parse_mode: "HTML",
          reply_markup: shopKeyboard(shopItems.map((i) => ({ id: i.id, name: i.name, price: i.price }))),
        },
      );
      return;
    }

    if (data.startsWith("shop_page_")) {
      const page = parseInt(data.replace("shop_page_", ""));
      const player = await getPlayer(telegramId);
      if (!player) return;

      const shopItems = await db.query.equipmentItems.findMany({
        where: (eqi, { and: andOp, eq: eqOp, lte }) =>
          andOp(eqOp(eqi.isShopItem, true), lte(eqi.requiredLevel, player.level)),
      });

      await ctx.editMessageText(
        `🏪 <b>Магазин экипировки</b>\n🪙 Твои монеты: ${player.gold}\n\nВыбери предмет для покупки:`,
        {
          parse_mode: "HTML",
          reply_markup: shopKeyboard(shopItems.map((i) => ({ id: i.id, name: i.name, price: i.price })), page),
        },
      );
      return;
    }

    // ── LOCATIONS ────────────────────────────────────────────────────
    if (data === "locations") {
      const player = await getPlayer(telegramId);
      if (!player) return;

      const locs = await getAvailableLocations(player.level);
      await ctx.editMessageText(
        `🗺️ <b>Локации</b>\n\nТы находишься: ${(await getLocation(player.currentLocationId!))?.name || "Неизвестно"}\n\nДоступные локации:`,
        {
          parse_mode: "HTML",
          reply_markup: locationsKeyboard(
            locs.map((l) => ({ id: l.id, name: l.name, requiredLevel: l.requiredLevel })),
            player.level,
          ),
        },
      );
      return;
    }

    if (data.startsWith("loc_")) {
      const locId = parseInt(data.replace("loc_", ""));
      const player = await getPlayer(telegramId);
      if (!player) return;

      const loc = await getLocation(locId);
      if (!loc) return;

      if (player.level < loc.requiredLevel) {
        await ctx.answerCallbackQuery({ text: "🔒 Эта локация ещё не доступна!" });
        return;
      }

      await db.update(players).set({ currentLocationId: locId }).where(eq(players.id, player.id));
      await ctx.answerCallbackQuery({ text: `📍 Переместился в ${loc.name}!` });

      await ctx.editMessageText(
        `📍 <b>${loc.name}</b>\n${loc.description}\n\nТы переместился в эту локацию!`,
        { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
      );
      return;
    }

    // ── NPC ───────────────────────────────────────────────────────────
    if (data === "npc") {
      const player = await getPlayer(telegramId);
      if (!player) return;

      const npc = await getNpcForLocation(player.currentLocationId!);
      if (!npc) {
        await ctx.editMessageText("В этой локации нет NPC.", { reply_markup: mainMenuKeyboard() });
        return;
      }

      await ctx.editMessageText(
        `🧙‍♂️ <b>${npc.name}</b> — ${npc.title}
━━━━━━━━━━━━━━━

💬 <i>"${npc.greeting}"</i>

💡 <b>Совет:</b> ${npc.advice}`,
        { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
      );
      return;
    }

    // ── INVENTORY PAGINATION ─────────────────────────────────────────
    if (data.startsWith("inv_page_") && !data.startsWith("inv_page_info")) {
      const page = parseInt(data.replace("inv_page_", ""));
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      const equippedIds = new Set([
        player.equippedWeaponId,
        player.equippedHeadId,
        player.equippedChestId,
        player.equippedLegsId,
        player.equippedFeetId,
        player.equippedAccessoryId,
      ].filter((id): id is number => id !== null));

      const kbItems = inv.map((entry) => ({
        id: entry.id,
        name: entry.item!.name,
        slot: entry.item!.slot,
        isEquipped: equippedIds.has(entry.itemId),
      }));

      await ctx.editMessageText("🎒 <b>Инвентарь</b>", {
        parse_mode: "HTML",
        reply_markup: inventoryKeyboard(kbItems, page),
      });
      return;
    }
  });
}

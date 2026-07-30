import { Bot, Context, InlineKeyboard } from "grammy";
import { db, players, playerAchievements, combatSessions } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  getPlayer,
  getInventory,
  getLocation,
  getAvailableLocations,
  getRandomMonster,
  getNpcForLocation,
  getNpcsForLocation,
  checkDrop,
  checkJunkDrops,
  addItemToInventory,
  addJunkToInventory,
  getJunkInventory,
  sellAllJunk,
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
  createCombatSession,
  getCombatSession,
  updateCombatSessionHp,
  incrementCombatRound,
  endCombat,
  getActiveQuest,
  getAnyActiveQuest,
  createQuest,
  incrementQuestProgress,
  POTION_RECIPES,
  canCraftPotion,
  craftPotion,
  formatActiveEffects,
  SKILLS,
  getClassSkills,
  canUseSkill,
  calculateSkillDamage,
  ACHIEVEMENTS,
  checkAndUnlockAchievement,
  getPlayerAchievements,
  CLASS_RESET_COST,
  resetClass,
  openLootBox,
  LOOT_BOX_PRICE,
  DIAMOND_PACKS,
  type Player,
  type Class,
  type SkillType,
} from "./game";
import {
  mainMenuKeyboard,
  menuKeyboard,
  achievementsKeyboard,
  statsKeyboard,
  shopKeyboard,
  raceKeyboard,
  classKeyboard,
  attackKeyboard,
  blockKeyboard,
  continueCombatKeyboard,
  inventoryKeyboard,
  equipActionKeyboard,
  locationShopKeyboard,
  locationsKeyboard,
  combatActionSelectionKeyboard,
} from "./keyboards";
import { resolveRound, resolveSkillRound } from "./combat";

// ─── SESSION STATE ───────────────────────────────────────────────────────────

// Short-lived: stores pending attack zone between attack choice and block choice
const pendingAttack = new Map<number, string>();
// Short-lived: stores selected skill id between skill choice and block choice
const pendingSkill = new Map<number, string>();

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

      // Check if this is a class reset
      const isReset = pendingAttack.get(telegramId) === "class_reset";
      if (isReset) {
        pendingAttack.delete(telegramId);
        const player = await getPlayer(telegramId);
        if (!player) return;
        if (player.gold < CLASS_RESET_COST) {
          await ctx.editMessageText("❌ Недостаточно золота для смены класса!", { reply_markup: statsKeyboard() });
          return;
        }
        await resetClass(player, c as Class);
        const updated = await getPlayer(telegramId);
        const maxHp = calculateMaxHp(updated!);
        await db.update(players).set({ maxHp, currentHp: maxHp }).where(eq(players.id, player.id));

        await ctx.editMessageText(
          `🔄 <b>Класс изменён!</b>

Ты теперь: ${getClassName(c as any)}
Уровень сохранён: ${player.level}
-${CLASS_RESET_COST}🪙

<i>Характеристики пересчитаны под новый класс.</i>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
        );
        return;
      }

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

    // ── MENU ──────────────────────────────────────────────────────────
    if (data === "menu") {
      const player = await getPlayer(telegramId);
      if (!player) return;
      await ctx.editMessageText(
        `📋 <b>Меню</b>\n\nВыбери раздел:`,
        { parse_mode: "HTML", reply_markup: menuKeyboard() },
      );
      return;
    }

    // ── ACHIEVEMENTS ──────────────────────────────────────────────────
    if (data === "achievements") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        const achievements = await getPlayerAchievements(player.id);
        let msg = `🏆 <b>Достижения</b>\n━━━━━━━━━━━━━━━\n\n`;
        let unlockedCount = 0;

        for (const a of achievements) {
          const status = a.unlockedAt ? `✅` : `🔒`;
          if (a.unlockedAt) unlockedCount++;
          msg += `${status} ${a.def.icon} <b>${a.def.name}</b>\n`;
          msg += `   ${a.def.description}\n`;
          if (a.unlockedAt) {
            const date = new Date(a.unlockedAt).toLocaleDateString("ru-RU");
            msg += `   🎁 +${a.def.rewardDiamonds}💎 (${date})\n`;
          } else {
            msg += `   🎁 ${a.def.rewardDiamonds}💎\n`;
          }
          msg += `\n`;
        }

        msg += `━━━━━━━━━━━━━━━\n`;
        msg += `Разблокировано: ${unlockedCount}/${ACHIEVEMENTS.length}`;

        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text("🔙 Назад", "menu"),
        });
      } catch (e) {
        logger.error({ err: e, telegramId }, "achievements error");
        await ctx.editMessageText("❌ Ошибка загрузки достижений.", { reply_markup: menuKeyboard() });
      }
      return;
    }

    // ── STATS ─────────────────────────────────────────────────────────
    if (data === "stats") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        const msg = `📊 <b>Статистика</b>
━━━━━━━━━━━━━━━

🏆 Всего убито монстров: <b>${player.totalKills}</b>
💀 Всего смертей: <b>${player.totalDeaths}</b>
💎 Алмазов: <b>${player.diamonds}</b>
🪙 Золота: <b>${player.gold}</b>
🎯 Уровень: <b>${player.level}</b>

━━━━━━━━━━━━━━━
🔄 Сменить класс — <b>${CLASS_RESET_COST}🪙</b>
Характеристики и экипировка сбросятся, уровень сохранится.`;

        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: statsKeyboard(),
        });
      } catch (e) {
        logger.error({ err: e, telegramId }, "stats error");
        await ctx.editMessageText("❌ Ошибка загрузки статистики.", { reply_markup: menuKeyboard() });
      }
      return;
    }

    // ── CLASS RESET ───────────────────────────────────────────────────
    if (data === "class_reset") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        if (player.gold < CLASS_RESET_COST) {
          await ctx.editMessageText(
            `❌ Недостаточно золота! Нужно: ${CLASS_RESET_COST}🪙 (у тебя ${player.gold}🪙)`,
            { reply_markup: statsKeyboard() },
          );
          return;
        }

        // Show class selection for reset
        await ctx.editMessageText(
          `🔄 <b>Выбор нового класса</b>\n\nВыбери новый класс (${CLASS_RESET_COST}🪙):\n\n<i>Уровень сохранится, но характеристики и экипировка сбросятся под новый класс.</i>`,
          { parse_mode: "HTML", reply_markup: classKeyboard() },
        );

        // Mark pending class reset
        pendingAttack.set(telegramId, "class_reset");
      } catch (e) {
        logger.error({ err: e, telegramId }, "class_reset error");
        await ctx.editMessageText("❌ Ошибка.", { reply_markup: menuKeyboard() });
      }
      return;
    }

    // ── SHOP ──────────────────────────────────────────────────────────
    if (data === "shop") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        const msg = `🏪 <b>Магазин</b>
━━━━━━━━━━━━━━━

💎 Твой баланс: <b>${player.diamonds}</b>

━━━━━━━━━━━━━━━
<b>💎 Алмазы (Telegram Stars):</b>
25💎 — 100⭐
100💎 — 400⭐

<b>🎁 Лутбоксы:</b>
${LOOT_BOX_PRICE}💎 за штуку
Случайный приз: золото, алмазы или зелья!`;

        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: shopKeyboard(player.diamonds),
        });
      } catch (e) {
        logger.error({ err: e, telegramId }, "shop error");
        await ctx.editMessageText("❌ Ошибка магазина.", { reply_markup: menuKeyboard() });
      }
      return;
    }

    // ── BUY DIAMONDS (TG Stars) ──────────────────────────────────────
    if (data === "buy_diamonds_25" || data === "buy_diamonds_100") {
      try {
        const diamonds = data === "buy_diamonds_25" ? 25 : 100;
        const pack = DIAMOND_PACKS.find((p) => p.diamonds === diamonds);
        if (!pack) return;

        // Send Telegram Stars invoice
        await ctx.api.sendInvoice(
          ctx.chat!.id,
          `${pack.diamonds} 💎 Алмазов`,
          `Пополнение алмазов: ${pack.diamonds}💎 за ${pack.stars}⭐`,
          `diamond_pack_${pack.diamonds}`, // payload
          "XTR", // currency for Telegram Stars
          [{ label: `${pack.diamonds} 💎`, amount: pack.stars }],
        );
      } catch (e) {
        logger.error({ err: e, telegramId }, "buy_diamonds error");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка отправки счёта" });
      }
      return;
    }

    // ── BUY LOOTBOX ──────────────────────────────────────────────────
    if (data === "buy_lootbox") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        if (player.diamonds < LOOT_BOX_PRICE) {
          await ctx.answerCallbackQuery({ text: `❌ Недостаточно 💎! Нужно ${LOOT_BOX_PRICE}💎` });
          return;
        }

        // Deduct diamonds
        await db
          .update(players)
          .set({ diamonds: player.diamonds - LOOT_BOX_PRICE })
          .where(eq(players.id, player.id));

        const reward = await openLootBox(player);

        let rewardDesc = "";
        switch (reward.type) {
          case "gold":
            rewardDesc = `🪙 +${reward.quantity} золота`;
            break;
          case "diamonds":
            rewardDesc = `💎 +${reward.quantity} алмазов`;
            break;
          case "potion_effect":
            rewardDesc = `⚗️ ${reward.name} — ${reward.description}`;
            break;
          case "equipment":
            rewardDesc = `🎁 ${reward.name}`;
            break;
        }

        const updatedPlayer = await getPlayer(telegramId);

        await ctx.editMessageText(
          `🎁 <b>Лутбокс открыт!</b>
━━━━━━━━━━━━━━━

${reward.icon} <b>${reward.name}</b>
${rewardDesc}

💎 Осталось: ${updatedPlayer?.diamonds || 0}💎`,
          { parse_mode: "HTML", reply_markup: shopKeyboard(updatedPlayer?.diamonds || 0) },
        );
      } catch (e) {
        logger.error({ err: e, telegramId }, "buy_lootbox error");
        await ctx.editMessageText("❌ Ошибка открытия лутбокса.", { reply_markup: menuKeyboard() });
      }
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
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;
        const monster = await getRandomMonster(player.currentLocationId!);
        if (!monster) {
          await ctx.editMessageText("В этой локации нет монстров...");
          return;
        }

        // Clean up any stale combat session
        if (player.inCombat) {
          await endCombat(player.id);
        }

        // Create combat session in DB
        const session = await createCombatSession(player.id, monster, player.currentLocationId!);

        // Set player in combat
        await db
          .update(players)
          .set({ inCombat: true, combatMonsterId: monster.id })
          .where(eq(players.id, player.id));

        const msg = `👹 <b>${monster.name}</b> (Ур. ${monster.level})
❤️ HP: ${session.monsterHp} | ⚔️ Атака: ${session.monsterAttack} | 🛡️ Защита: ${session.monsterDefense}

Бой начинается!`;

        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text("⚔️ Атаковать", "combat_attack").text("🏃 Сбежать", "combat_run"),
        });
      } catch (e) {
        logger.error({ err: e, telegramId }, "search_monster error");
        await ctx.editMessageText("❌ Ошибка начала боя. Попробуй снова.", { reply_markup: mainMenuKeyboard() });
        await endCombat((await getPlayer(telegramId))?.id || 0).catch(() => {});
      }
      return;
    }

    // ── COMBAT ─────────────────────────────────────────────────────────
    if (data === "combat_attack" || data === "combat_next") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) { await ctx.editMessageText("❌ Ошибка. Начни с /start"); return; }

        const session = await getCombatSession(telegramId);
        if (!session) {
          await ctx.editMessageText("⚠️ Бой не найден в БД. Начни новый поход.", { reply_markup: mainMenuKeyboard() });
          return;
        }

        // Show action selection: normal attack + available skills
        const classSkills = getClassSkills(player.class as Class);
        const canUse = classSkills.map((s) => canUseSkill(s, session.hits, session.blocks, session.misses));

        // Calculate stats display
        let statsLine = `🗡️${session.hits} 🛡️${session.blocks} 💨${session.misses}`;

        let msg = `⚔️ <b>Выбери действие:</b>\n`;
        msg += `📊 Боевая статистика: ${statsLine}\n\n`;

        // List unlocked skills
        for (let i = 0; i < classSkills.length; i++) {
          const s = classSkills[i];
          const status = canUse[i] ? "✅" : "🔒";
          msg += `${status} ${s.icon} ${s.name} — ${s.description}\n`;
        }

        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: combatActionSelectionKeyboard(classSkills, canUse),
        }).catch(() => {}); // silent fail on "message not modified"
      } catch (e) {
        // Only log real errors, ignore "message not modified"
        const errMsg = (e as any)?.message || "";
        if (!errMsg.includes("message is not modified")) {
          logger.error({ err: e, telegramId }, "combat_start error");
          await ctx.answerCallbackQuery({ text: "⚠️ Ошибка" }).catch(() => {});
        }
      }
      return;
    }

    // ── NORMAL ATTACK (from action selection) ──────────────────────────
    if (data === "combat_atk_now") {
      const player = await getPlayer(telegramId);
      if (!player) { await ctx.editMessageText("❌ Ошибка. Начни с /start"); return; }
      pendingSkill.delete(telegramId);
      pendingAttack.set(telegramId, "");
      await ctx.editMessageText("🎯 Выбери зону <b>атаки</b>:", {
        parse_mode: "HTML",
        reply_markup: attackKeyboard(),
      });
      return;
    }

    // ── SKILL SELECT ───────────────────────────────────────────────────
    if (data.startsWith("skill_")) {
      const skillId = data.replace("skill_", "");
      const classSkills = getClassSkills((await getPlayer(telegramId))?.class as Class);
      const skill = classSkills.find((s) => s.id === skillId);
      if (!skill) return;

      pendingSkill.set(telegramId, skillId);
      pendingAttack.set(telegramId, "");
      await ctx.editMessageText(`💥 <b>${skill.icon} ${skill.name}</b>\n🎯 Выбери зону атаки:`, {
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
      try {
        const idx = parseInt(data.replace("blk_", ""));
        const blockZones: [string, string][] = [
          ["голова", "грудь"],
          ["грудь", "живот"],
          ["живот", "пояс"],
          ["пояс", "ноги"],
          ["ноги", "голова"],
        ];
        if (idx < 0 || idx >= blockZones.length) return;

        const attackZone = pendingAttack.get(telegramId) || "грудь";
        const blockZone = blockZones[idx];
        pendingAttack.delete(telegramId);

        const player = await getPlayer(telegramId);
        if (!player) { await ctx.editMessageText("❌ Ошибка. Начни с /start"); return; }

        const session = await getCombatSession(telegramId);
        if (!session) {
          await ctx.editMessageText("⚠️ Бой утерян. Твои данные сохранены.", { reply_markup: mainMenuKeyboard() });
          await endCombat(player.id);
          return;
        }

        // Load equipment stats for this round
        const equipStats = await loadEquippedStats(player);

        // Check if a skill was selected
        const skillId = pendingSkill.get(telegramId);
        pendingSkill.delete(telegramId);

        // Resolve round (with skill if selected)
        let result;
        let skillName = "";
        if (skillId) {
          const classSkills = getClassSkills(player.class as Class);
          const skill = classSkills.find((s) => s.id === skillId);
          if (skill) {
            skillName = skill.name;
            const totalAtk = calculateAttack(player, equipStats.bonusAttack);
            const skillDmg = calculateSkillDamage(player, totalAtk);
            result = resolveSkillRound(
              player,
              skill.skillType as SkillType,
              attackZone,
              blockZone,
              session.monsterHp,
              session.monsterAttack,
              session.monsterDefense,
              skillDmg,
              equipStats.bonusAttack,
              equipStats.bonusDefense,
              session.round,
              skill.name,
            );
          } else {
            // Fallback to normal
            result = resolveRound(player, attackZone, blockZone, session.monsterHp, session.monsterAttack, session.monsterDefense, equipStats.bonusAttack, equipStats.bonusDefense, session.round);
          }
        } else {
          result = resolveRound(player, attackZone, blockZone, session.monsterHp, session.monsterAttack, session.monsterDefense, equipStats.bonusAttack, equipStats.bonusDefense, session.round);
        }

        // Update monster HP in DB session and increment round
        await updateCombatSessionHp(player.id, result.monsterNewHp);
        await incrementCombatRound(player.id);

        // Track combat stats (hits/blocks/misses)
        const wasHit = !result.playerBlocked; // player landed a hit
        const wasBlock = result.monsterBlocked; // player blocked monster
        const wasMiss = result.playerBlocked; // monster blocked player
        const updates: Record<string, number> = {};
        if (wasHit) updates.hits = (session.hits || 0) + 1;
        if (wasBlock) updates.blocks = (session.blocks || 0) + 1;
        if (wasMiss) updates.misses = (session.misses || 0) + 1;
        if (Object.keys(updates).length > 0) {
          await db
            .update(combatSessions)
            .set(updates as any)
            .where(eq(combatSessions.id, session.id));
        }

        // Update player HP in DB
        await db
          .update(players)
          .set({ currentHp: result.playerNewHp })
          .where(eq(players.id, player.id));

        const logText = result.log.join("\n");

        // Check if monster died
        if (result.monsterNewHp <= 0) {
          const xpGain = session.xpReward + session.monsterLevel * 20;
          const goldGain = session.goldMin + Math.floor(Math.random() * (session.goldMax - session.goldMin + 1));

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
          const drop = await checkDrop(session.monsterId);
          if (drop) {
            await addItemToInventory(player.id, drop.id);
            dropText = `\n\n🎁 <b>Трофей:</b> ${drop.name}!`;
          }

          // Check for junk drops
          let junkText = "";
          const junkDrops = await checkJunkDrops(session.monsterId);
          if (junkDrops.length > 0) {
            const junkLines: string[] = [];
            for (const jd of junkDrops) {
              await addJunkToInventory(player.id, jd.junkItem.id, jd.quantity);
              junkLines.push(`${jd.junkItem.name} x${jd.quantity}`);
            }
            junkText = `\n📦 <b>Трофеи:</b> ${junkLines.join(", ")}`;
          }

          // Check quest progress
          let questText = "";
          const q = await incrementQuestProgress(player.id, session.monsterName);
          if (q) {
            if (q.isCompleted) {
              questText = `\n\n✅ <b>Квест выполнен!</b> 🪙+${q.rewardGold} ✨+${q.rewardXp} XP`;
              await db
                .update(players)
                .set({
                  gold: newGold + q.rewardGold,
                  xp: remainingXp + q.rewardXp,
                })
                .where(eq(players.id, player.id));
            } else {
              questText = `\n📜 Квест: ${q.currentProgress}/${q.targetQuantity}`;
            }
          }

          // End combat - clean up session + DB
          await endCombat(player.id, true);
          await db
            .update(players)
            .set({
              gold: newGold + (questText.includes("Квест выполнен") ? 0 : 0),
              xp: remainingXp,
              level: newLevel,
              freeStatPoints: newFreePoints,
              currentHp: result.playerNewHp,
              totalKills: (updatedPlayer.totalKills || 0) + 1,
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

          const curHits = (session.hits || 0) + (wasHit ? 1 : 0);
          const curBlocks = (session.blocks || 0) + (wasBlock ? 1 : 0);
          const curMisses = (session.misses || 0) + (wasMiss ? 1 : 0);
          const statsLine = `🗡️${curHits} 🛡️${curBlocks} 💨${curMisses}`;

          // Check achievements
          const finalPlayer = await getPlayer(telegramId);
          let achievementText = "";
          if (finalPlayer) {
            const newAch = await checkAndUnlockAchievement(finalPlayer, {
              kills: finalPlayer.totalKills || 1,
              deaths: finalPlayer.totalDeaths || 0,
              level: finalPlayer.level,
              gold: finalPlayer.gold,
            });
            if (newAch.length > 0) {
              achievementText = `\n\n🏅 <b>Новые достижения!</b>\n${newAch.join("\n\n")}`;
            }
          }

          const victoryMsg = `${logText}\n📊 Статистика: ${statsLine}\n\n🎉 <b>ПОБЕДА!</b>
🏆 Монстр ${session.monsterName} повержен!
✨ +${xpGain} XP | 🪙 +${goldGain} золота${dropText}${junkText}${questText}${achievementText}${leveledUp ? `\n\n⬆️ <b>УРОВЕНЬ ${newLevel}!</b> (+5 очков навыков)` : ""}${locationUnlock}`;

          await ctx.editMessageText(victoryMsg, {
            parse_mode: "HTML",
            reply_markup: mainMenuKeyboard(),
          });
          return;
        }

        // Check if player died
        if (result.playerNewHp <= 0) {
          await endCombat(player.id, true);
          const maxHp = calculateMaxHp(player);
          await db
            .update(players)
            .set({
              currentHp: Math.floor(maxHp / 2), // Respawn with half HP
              totalDeaths: (player.totalDeaths || 0) + 1,
            })
            .where(eq(players.id, player.id));

          const curHitsD = (session.hits || 0) + (wasHit ? 1 : 0);
          const curBlocksD = (session.blocks || 0) + (wasBlock ? 1 : 0);
          const curMissesD = (session.misses || 0) + (wasMiss ? 1 : 0);
          const deathStats = `🗡️${curHitsD} 🛡️${curBlocksD} 💨${curMissesD}`;

          // Check achievements
          const deadPlayer = await getPlayer(telegramId);
          let achievementText = "";
          if (deadPlayer) {
            const newAch = await checkAndUnlockAchievement(deadPlayer, {
              kills: deadPlayer.totalKills || 0,
              deaths: deadPlayer.totalDeaths || 1,
              level: deadPlayer.level,
              gold: deadPlayer.gold,
            });
            if (newAch.length > 0) {
              achievementText = `\n\n🏅 <b>Новые достижения!</b>\n${newAch.join("\n\n")}`;
            }
          }

          const deathMsg = `${logText}\n📊 Статистика: ${deathStats}\n\n💀 <b>Ты погиб...</b>
Но не отчаивайся — ты восстановился с половиной HP!${achievementText}`;

          await ctx.editMessageText(deathMsg, {
            parse_mode: "HTML",
            reply_markup: mainMenuKeyboard(),
          });
          return;
        }

        // Combat continues
        const curHitsC = (session.hits || 0) + (wasHit ? 1 : 0);
        const curBlocksC = (session.blocks || 0) + (wasBlock ? 1 : 0);
        const curMissesC = (session.misses || 0) + (wasMiss ? 1 : 0);
        const continueStats = `🗡️${curHitsC} 🛡️${curBlocksC} 💨${curMissesC}`;
        const continueMsg = `${logText}\n📊 Статистика: ${continueStats}\n\n👹 <b>${session.monsterName}</b> — ❤️ ${result.monsterNewHp}/${session.monsterMaxHp}`;

        await ctx.editMessageText(continueMsg, {
          parse_mode: "HTML",
          reply_markup: continueCombatKeyboard(),
        });
      } catch (e) {
        logger.error({ err: e, telegramId }, "combat_round error");
        await endCombat((await getPlayer(telegramId))?.id || 0, true).catch(() => {});
        await ctx.editMessageText("❌ Ошибка боя. Возвращаю в главное меню.", { reply_markup: mainMenuKeyboard() }).catch(() => {});
      }
      return;
    }

    // ── COMBAT RUN ────────────────────────────────────────────────────
    if (data === "combat_run") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        // 50% chance to fail escape
        const escapeRoll = Math.random() < 0.5;
        if (!escapeRoll) {
          // Failed escape — instant death
          await endCombat(player.id, true);
          const maxHp = calculateMaxHp(player);
          await db
            .update(players)
            .set({
              currentHp: Math.floor(maxHp / 2),
            })
            .where(eq(players.id, player.id));

          await ctx.editMessageText(
            `💀 <b>Ты пытался сбежать... но споткнулся!</b>\n\nВраг настиг тебя. Ты погиб и восстановился с половиной HP.`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
          );
          return;
        }

        // Successful escape
        await endCombat(player.id, true);
        await ctx.editMessageText("🏃 Ты успешно сбежал из боя!", {
          reply_markup: mainMenuKeyboard(),
        });
      } catch (e) {
        logger.error({ err: e, telegramId }, "combat_run error");
        await endCombat((await getPlayer(telegramId))?.id || 0, true).catch(() => {});
        await ctx.editMessageText("❌ Ошибка при побеге.", { reply_markup: mainMenuKeyboard() }).catch(() => {});
      }
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

      let msg = "🎒 <b>Инвентарь</b>\n━━━━━━━━━━━━━━━\n";

      // Show currently equipped with visual slot indicators
      const equippedItems = sortedItems.filter((i) => i.isEquipped);
      if (equippedItems.length > 0) {
        msg += `\n🟢 <b>Экипировано:</b>\n`;
        for (const item of equippedItems) {
          msg += `${slotMap[item.slot] || item.slot}: <b>${item.name}</b>\n`;
        }
      } else {
        msg += `\n⚠️ <b>Экипировка отсутствует</b>\n`;
      }

      // Show unequipped items
      const unequippedItems = sortedItems.filter((i) => !i.isEquipped);
      if (unequippedItems.length > 0) {
        msg += `\n📦 <b>Сумка (${unequippedItems.length}):</b>\n`;
        for (const item of unequippedItems) {
          msg += `• ${item.name} x${item.quantity} (${slotMap[item.slot] || item.slot})\n`;
        }
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

    if (data.startsWith("inv_") && !data.startsWith("inv_page_")) {
      const invId = parseInt(data.replace("inv_", ""));
      if (isNaN(invId)) return;
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

    if (data.startsWith("equip_") && !data.startsWith("equip_confirm_")) {
      const invId = parseInt(data.replace("equip_", ""));
      if (isNaN(invId)) return;
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      const entry = inv.find((i) => i.id === invId);
      if (!entry || !entry.item) return;

      const item = entry.item;
      if (!canEquipClass(player.class as any, item)) {
        await ctx.answerCallbackQuery({ text: "❌ Не подходит классу!" });
        return;
      }
      if (!canEquipLevel(player.level, item)) {
        await ctx.answerCallbackQuery({ text: "❌ Недостаточный уровень!" });
        return;
      }

      const kb = new InlineKeyboard()
        .text("✅ Надеть", `equip_confirm_${invId}`)
        .text("🔙 Назад", `inv_${invId}`);

      await ctx.editMessageText(
        `⚔️ <b>Подтверждение экипировки</b>
━━━━━━━━━━━━━━━

Надеть <b>${item.name}</b>?
📂 ${entry.item.slot}

<i>Предмет будет экипирован в соответствующий слот.</i>`,
        { parse_mode: "HTML", reply_markup: kb },
      );
      return;
    }

    if (data.startsWith("equip_confirm_")) {
      const invId = parseInt(data.replace("equip_confirm_", ""));
      if (isNaN(invId)) return;
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      const entry = inv.find((i) => i.id === invId);
      if (!entry || !entry.item) return;

      await equipItem(player.id, entry.item.id);
      await ctx.answerCallbackQuery({ text: "✅ Предмет надет!" });

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
        isEquipped: equippedIds.has(e.itemId) || e.itemId === entry.item!.id,
      }));

      await ctx.editMessageText("✅ Предмет надет!", {
        reply_markup: inventoryKeyboard(kbItems),
      });
      return;
    }

    if (data.startsWith("unequip_") && !data.startsWith("unequip_confirm_")) {
      const invId = parseInt(data.replace("unequip_", ""));
      if (isNaN(invId)) return;
      const player = await getPlayer(telegramId);
      if (!player) return;

      const inv = await getInventory(player.id);
      const entry = inv.find((i) => i.id === invId);
      if (!entry || !entry.item) return;

      const kb = new InlineKeyboard()
        .text("❌ Снять", `unequip_confirm_${invId}`)
        .text("🔙 Назад", `inv_${invId}`);

      await ctx.editMessageText(
        `📦 <b>Подтверждение</b>
━━━━━━━━━━━━━━━

Снять <b>${entry.item.name}</b>?
📂 ${entry.item.slot}

<i>Предмет вернётся в инвентарь.</i>`,
        { parse_mode: "HTML", reply_markup: kb },
      );
      return;
    }

    if (data.startsWith("unequip_confirm_")) {
      const invId = parseInt(data.replace("unequip_confirm_", ""));
      if (isNaN(invId)) return;
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

    if (data.startsWith("buy_") && !data.startsWith("buy_confirm_")) {
      const itemId = parseInt(data.replace("buy_", ""));
      if (isNaN(itemId)) return;
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

      const slotName: Record<string, string> = {
        weapon: "⚔️ Оружие", head: "🪖 Шлем", chest: "🛡️ Броня", legs: "👖 Поножи", feet: "👢 Сапоги", accessory: "💍 Аксессуар",
      };

      const kb = new InlineKeyboard()
        .text("✅ Купить", `buy_confirm_${item.id}`)
        .text("🔙 Назад", "npc");

      await ctx.editMessageText(
        `🏪 <b>Подтверждение покупки</b>
━━━━━━━━━━━━━━━

<b>${item.name}</b>
📂 ${slotName[item.slot] || item.slot}
🏷️ ${item.armorType}
🔒 Ур. ${item.requiredLevel}
${item.bonusAttack ? `⚔️ Атака: +${item.bonusAttack}\n` : ""}${item.bonusDefense ? `🛡️ Защита: +${item.bonusDefense}\n` : ""}${item.bonusHp ? `❤️ HP: +${item.bonusHp}\n` : ""}

💰 <b>Цена: 🪙${item.price}</b>
🪙 Твои монеты: ${player.gold}

<i>Подтверди покупку?</i>`,
        { parse_mode: "HTML", reply_markup: kb },
      );
      return;
    }

    if (data.startsWith("buy_confirm_")) {
      const itemId = parseInt(data.replace("buy_confirm_", ""));
      if (isNaN(itemId)) return;
      const player = await getPlayer(telegramId);
      if (!player) return;

      const item = await db.query.equipmentItems.findFirst({
        where: (eqi, { eq: op }) => op(eqi.id, itemId),
      });
      if (!item) return;

      if (player.gold < item.price) {
        await ctx.answerCallbackQuery({ text: "❌ Недостаточно золота!" });
        return;
      }

      await db.update(players).set({ gold: player.gold - item.price }).where(eq(players.id, player.id));
      await addItemToInventory(player.id, item.id);
      await ctx.answerCallbackQuery({ text: `✅ Куплено: ${item.name}!` });

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

      const npcs = await getNpcsForLocation(player.currentLocationId!);
      if (npcs.length === 0) {
        await ctx.editMessageText("В этой локации нет NPC.", { reply_markup: mainMenuKeyboard() });
        return;
      }

      // Show NPC selection list if multiple
      if (npcs.length > 1) {
        const typeIcons: Record<string, string> = {
          advisor: "🧙",
          healer: "❤️",
          quest_giver: "📜",
          junk_buyer: "💰",
          shopkeeper: "🏪",
          alchemist: "🧪",
        };
        let msg = `🧑‍🤝‍🧑 <b>Жители локации:</b>\n━━━━━━━━━━━━━━━\n\n`;
        const kb = new InlineKeyboard();
        for (const n of npcs) {
          const icon = typeIcons[n.npcType] || "🧑";
          msg += `${icon} <b>${n.name}</b> — ${n.title}\n`;
          kb.text(`${icon} ${n.name}`, `npc_sel_${n.id}`).row();
        }
        kb.text("🔙 Назад", "main_menu");
        await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: kb });
      } else {
        // Single NPC — show directly
        const n = npcs[0];
        const kb = new InlineKeyboard();
        if (n.npcType === "healer") {
          const maxHp = calculateMaxHp(player);
          const missing = maxHp - player.currentHp;
          const cost = Math.ceil(missing / 25) * (n.healCostPerHp || 3);
          const healLabel = player.currentHp >= maxHp
            ? "❤️ Полное HP"
            : `❤️ Лечиться (${cost}🪙 за ${missing} HP)`;
          if (player.currentHp < maxHp) kb.text(healLabel, `npc_heal_${n.id}`);
          else kb.text(healLabel, "noop");
          kb.row();
        }
        if (n.npcType === "quest_giver") {
          const activeQuest = await getActiveQuest(player.id, n.id);
          if (activeQuest) {
            kb.text(`📜 Квест: ${activeQuest.currentProgress}/${activeQuest.targetQuantity}`, `npc_quest_${n.id}`);
          } else {
            kb.text("📜 Взять задание", `npc_quest_${n.id}`);
          }
          kb.row();
        }
        kb.text("🔙 Назад", "main_menu");

        await ctx.editMessageText(
          `🧙‍♂️ <b>${n.name}</b> — ${n.title}
━━━━━━━━━━━━━━━

💬 <i>"${n.greeting}"</i>

💡 <b>Совет:</b> ${n.advice}`,
          { parse_mode: "HTML", reply_markup: kb },
        );
      }
      return;
    }

    // ── NPC SELECT ────────────────────────────────────────────────────
    if (data.startsWith("npc_sel_")) {
      const npcId = parseInt(data.replace("npc_sel_", ""));
      if (isNaN(npcId)) return;

      const player = await getPlayer(telegramId);
      if (!player) return;

      const allNpcs = await db.query.npcs.findMany({ where: (n, { eq: op }) => op(n.id, npcId) });
      const npc = allNpcs[0];
      if (!npc) return;

      const kb = new InlineKeyboard();
      if (npc.npcType === "healer") {
        const maxHp = calculateMaxHp(player);
        const missing = maxHp - player.currentHp;
        const cost = Math.ceil(missing / 25) * (npc.healCostPerHp || 3);
        const healLabel = player.currentHp >= maxHp
          ? "❤️ Полное HP"
          : `❤️ Лечиться (${cost}🪙 за ${missing} HP)`;
        if (player.currentHp < maxHp) kb.text(healLabel, `npc_heal_${npc.id}`);
        else kb.text(healLabel, "noop");
        kb.row();
      }
      if (npc.npcType === "quest_giver") {
        const activeQuest = await getActiveQuest(player.id, npc.id);
        if (activeQuest) {
          kb.text(`📜 Квест: ${activeQuest.currentProgress}/${activeQuest.targetQuantity}`, `npc_quest_${npc.id}`);
        } else {
          kb.text("📜 Взять задание", `npc_quest_${npc.id}`);
        }
        kb.row();
      }
      if (npc.npcType === "junk_buyer") {
        kb.text("💰 Продать хлам", `junk_sell_all`).row();
        kb.row();
      }
      if (npc.npcType === "shopkeeper") {
        // Show shop items directly
        const shopItems = await db.query.equipmentItems.findMany({
          where: (eqi, { and: andOp, eq: eqOp, lte }) =>
            andOp(eqOp(eqi.isShopItem, true), lte(eqi.requiredLevel, player.level)),
        });
        if (shopItems.length === 0) {
          await ctx.editMessageText("🏪 В лавке пока пусто.\n\n<i>Загляни позже, может появится товар.</i>", {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard().text("🔙 Назад", "npc"),
          });
          return;
        }
        await ctx.editMessageText(
          `🏪 <b>${npc.name}</b> — ${npc.title}\n━━━━━━━━━━━━━━━\n\n🪙 Твои монеты: ${player.gold}\n\nВыбери предмет для покупки:`,
          { parse_mode: "HTML", reply_markup: shopKeyboard(shopItems.map((i) => ({ id: i.id, name: i.name, price: i.price }))) },
        );
        return;
      }
      if (npc.npcType === "alchemist") {
        // Show potion recipes
        let alchMsg = `🧪 <b>${npc.name}</b> — ${npc.title}\n━━━━━━━━━━━━━━━\n\n💬 <i>"${npc.greeting}"</i>\n\n<b>Доступные зелья:</b>\n`;
        const alchKb = new InlineKeyboard();
        for (let i = 0; i < POTION_RECIPES.length; i++) {
          const r = POTION_RECIPES[i];
          const check = await canCraftPotion(player.id, r);
          const status = check.ok ? "✅" : "❌";
          alchMsg += `\n${status} <b>${r.name}</b>\n  ${r.description}\n  💰 ${r.goldCost}🪙 | ${r.reagents.map((rg) => `${rg.junkName} x${rg.quantity}`).join(", ")}\n`;
          if (check.ok) alchKb.text(`🧪 ${r.name}`, `alch_brew_${i}`).row();
        }
        alchKb.text("🔙 Назад", "npc");
        await ctx.editMessageText(alchMsg, { parse_mode: "HTML", reply_markup: alchKb });
        return;
      }
      kb.text("🔙 Назад", "npc");

      const adviceText = npc.advice ? `\n💡 <b>Совет:</b> ${npc.advice}` : "";

      await ctx.editMessageText(
        `🧙‍♂️ <b>${npc.name}</b> — ${npc.title}
━━━━━━━━━━━━━━━

💬 <i>"${npc.greeting}"</i>${adviceText}`,
        { parse_mode: "HTML", reply_markup: kb },
      );
      return;
    }

    // ── ALCHEMIST BREW ──────────────────────────────────────────────────
    if (data.startsWith("alch_brew_")) {
      const recipeIdx = parseInt(data.replace("alch_brew_", ""));
      if (isNaN(recipeIdx) || recipeIdx < 0 || recipeIdx >= POTION_RECIPES.length) return;

      const player = await getPlayer(telegramId);
      if (!player) return;

      const recipe = POTION_RECIPES[recipeIdx];

      try {
        await craftPotion(player.id, recipe);
        await ctx.answerCallbackQuery({ text: `✅ ${recipe.name} создано! Эффект на ${recipe.durationMinutes} мин.` });

        // Show updated potion list
        await ctx.editMessageText(
          `⚗️ <b>Зелье создано!</b>\n━━━━━━━━━━━━━━━\n\n✅ ${recipe.name}\n${recipe.description}\n\n🪙 Потрачено: ${recipe.goldCost}\n⌛ Длится: ${recipe.durationMinutes} мин.`,
          { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔙 Назад", "npc") },
        );
      } catch (err: any) {
        await ctx.answerCallbackQuery({ text: `❌ ${err.message}` });
      }
      return;
    }

    // ── JUNK SELL ──────────────────────────────────────────────────────
    if (data === "junk_sell_all") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        const junkInv = await getJunkInventory(player.id);
        if (junkInv.length === 0) {
          await ctx.answerCallbackQuery({ text: "📦 У тебя нет хлама для продажи!" });
          return;
        }

        // Show confirmation with total value
        let totalValue = 0;
        let junkList = "";
        for (const entry of junkInv) {
          const value = entry.quantity * entry.junkItem.sellPrice;
          totalValue += value;
          junkList += `• ${entry.junkItem.name} x${entry.quantity} — 🪙${value}\n`;
        }

        const kbConfirm = new InlineKeyboard()
          .text("✅ Продать всё", "junk_confirm_sell")
          .text("🔙 Отмена", "npc");

        await ctx.editMessageText(
          `💰 <b>Скупщик хлама</b>
━━━━━━━━━━━━━━━

📦 <b>Твой хлам:</b>
${junkList}
━━━━━━━━━━━━━━━
🏷️ <b>Итого:</b> 🪙${totalValue}

<i>Продать всё?</i>`,
          { parse_mode: "HTML", reply_markup: kbConfirm },
        );
      } catch (e) {
        logger.error({ err: e, telegramId }, "junk_sell_all error");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка" });
      }
      return;
    }

    // ── JUNK CONFIRM SELL ──────────────────────────────────────────────
    if (data === "junk_confirm_sell") {
      try {
        const player = await getPlayer(telegramId);
        if (!player) return;

        const result = await sellAllJunk(player.id);
        if (result.totalGold <= 0) {
          await ctx.answerCallbackQuery({ text: "📦 Нет хлама для продажи!" });
          return;
        }

        await db
          .update(players)
          .set({ gold: player.gold + result.totalGold })
          .where(eq(players.id, player.id));

        let soldList = "";
        for (const item of result.soldItems) {
          soldList += `• ${item.name} x${item.qty} — 🪙${item.gold}\n`;
        }

        await ctx.editMessageText(
          `💰 <b>Продажа завершена!</b>
━━━━━━━━━━━━━━━

${soldList}
━━━━━━━━━━━━━━━
💰 Получено: 🪙+${result.totalGold}
🪙 Баланс: ${player.gold + result.totalGold}`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
        );
      } catch (e) {
        logger.error({ err: e, telegramId }, "junk_confirm_sell error");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка продажи" });
      }
      return;
    }

    // ── NPC HEAL ──────────────────────────────────────────────────────
    if (data.startsWith("npc_heal_") && !data.startsWith("npc_heal_confirm_")) {
      try {
        const npcId = parseInt(data.replace("npc_heal_", ""));
        if (isNaN(npcId)) return;
        const player = await getPlayer(telegramId);
        if (!player) return;

        const allNpcs = await db.query.npcs.findMany({ where: (n, { eq: op }) => op(n.id, npcId) });
        const healNpc = allNpcs[0];
        if (!healNpc || healNpc.npcType !== "healer") return;

        const maxHp = calculateMaxHp(player);
        const missing = maxHp - player.currentHp;
        if (missing <= 0) {
          await ctx.answerCallbackQuery({ text: "❤️ У тебя уже полное HP!" });
          return;
        }

        const cost = Math.ceil(missing / 25) * (healNpc.healCostPerHp || 3);
        if (player.gold < cost) {
          await ctx.answerCallbackQuery({
            text: `❌ Недостаточно золота! Нужно ${cost}, у тебя ${player.gold}`,
          });
          return;
        }

        const kb = new InlineKeyboard()
          .text("✅ Лечиться", `npc_heal_confirm_${npcId}`)
          .text("🔙 Отмена", "npc");

        await ctx.editMessageText(
          `❤️ <b>${healNpc.name}</b> — ${healNpc.title}
━━━━━━━━━━━━━━━

💬 <i>"Я восстановлю твои силы за монеты."</i>

📊 <b>Диагноз:</b>
❤️ ${player.currentHp}/${maxHp} HP (нужно восстановить ${missing})
💰 Цена: 🪙${cost} (${healNpc.healCostPerHp}🪙 за 25 HP)
🪙 Твои монеты: ${player.gold}

<i>Подтверди лечение?</i>`,
          { parse_mode: "HTML", reply_markup: kb },
        );
      } catch (e) {
        logger.error({ err: e, telegramId }, "npc_heal error");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка лечения" });
      }
      return;
    }

    // ── NPC HEAL CONFIRM ──────────────────────────────────────────────
    if (data.startsWith("npc_heal_confirm_")) {
      try {
        const npcId = parseInt(data.replace("npc_heal_confirm_", ""));
        if (isNaN(npcId)) return;
        const player = await getPlayer(telegramId);
        if (!player) return;

        const allNpcs = await db.query.npcs.findMany({ where: (n, { eq: op }) => op(n.id, npcId) });
        const healNpc = allNpcs[0];
        if (!healNpc || healNpc.npcType !== "healer") return;

        const maxHp = calculateMaxHp(player);
        const missing = maxHp - player.currentHp;
        if (missing <= 0) {
          await ctx.answerCallbackQuery({ text: "❤️ HP уже полное!" });
          return;
        }

        const cost = Math.ceil(missing / 25) * (healNpc.healCostPerHp || 3);
        if (player.gold < cost) {
          await ctx.answerCallbackQuery({ text: "❌ Недостаточно золота!" });
          return;
        }

        await db
          .update(players)
          .set({ currentHp: maxHp, gold: player.gold - cost })
          .where(eq(players.id, player.id));

        await ctx.answerCallbackQuery({
          text: `❤️ Исцелён! -${cost}🪙`,
        });

        await ctx.editMessageText(
          `❤️ <b>Исцеление</b>
━━━━━━━━━━━━━━━

${healNpc.name} восстановил твоё здоровье!
-${missing}❤️ → ❤️ ${maxHp}/${maxHp}
-${cost}🪙

Спасибо ${healNpc.title}!`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
        );
      } catch (e) {
        logger.error({ err: e, telegramId }, "npc_heal confirm error");
        await ctx.answerCallbackQuery({ text: "❌ Ошибка лечения" });
      }
      return;
    }

    // ── NPC QUEST ─────────────────────────────────────────────────────
    if (data.startsWith("npc_quest_")) {
      try {
        const npcId = parseInt(data.replace("npc_quest_", ""));
        const player = await getPlayer(telegramId);
        if (!player) return;

        const allNpcs = await db.query.npcs.findMany({ where: (n, { eq: op }) => op(n.id, npcId) });
        const questNpc = allNpcs[0];
        if (!questNpc) return;

        // Check if player already has an active quest from this NPC
        const activeQuest = await getActiveQuest(player.id, npcId);
        if (activeQuest) {
          await ctx.editMessageText(
            `📜 <b>Текущее задание</b>
━━━━━━━━━━━━━━━

${questNpc.greeting}

🎯 Убей <b>${activeQuest.targetMonsterName}</b> — ${activeQuest.currentProgress}/${activeQuest.targetQuantity}
🏆 Награда: ✨ ${activeQuest.rewardXp} XP | 🪙 ${activeQuest.rewardGold} золота`,
            { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
          );
          return;
        }

        // Generate quest based on NPC location
        const locMonsters = await db.query.monsters.findMany({
          where: (m, { eq: op }) => op(m.locationId, questNpc.locationId),
          orderBy: (m, { asc }) => asc(m.level),
        });

        if (locMonsters.length === 0) {
          await ctx.editMessageText("В этой локации нет монстров для квеста.", { reply_markup: mainMenuKeyboard() });
          return;
        }

        // Pick a monster appropriate for the location (mid-level in the zone)
        const targetMonster = locMonsters[Math.min(2, locMonsters.length - 1)];

        const newQuest = await createQuest(player.id, questNpc, targetMonster.name, questNpc.locationId);

        await ctx.editMessageText(
          `📜 <b>Новое задание!</b>
━━━━━━━━━━━━━━━

${questNpc.greeting}

🎯 Задание: Убей <b>${targetMonster.name}</b> — 0/${newQuest.targetQuantity}
🏆 Награда: ✨ ${newQuest.rewardXp} XP | 🪙 ${newQuest.rewardGold} золота

<i>Возвращайся когда выполнишь!</i>`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard() },
        );
      } catch (e) {
        logger.error({ err: e, telegramId }, "npc_quest error");
        await ctx.editMessageText("❌ Ошибка выдачи квеста.", { reply_markup: mainMenuKeyboard() });
      }
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

  // ── TG STARS PAYMENTS ───────────────────────────────────────────────
  bot.on("pre_checkout_query", async (ctx) => {
    try {
      await ctx.api.answerPreCheckoutQuery(ctx.preCheckoutQuery.id, true);
    } catch (e) {
      logger.error({ err: e }, "pre_checkout_query error");
    }
  });

  bot.on("message:successful_payment", async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) return;

      const payload = ctx.message?.successful_payment?.invoice_payload || "";
      if (!payload.startsWith("diamond_pack_")) return;

      const diamonds = parseInt(payload.replace("diamond_pack_", ""));
      if (isNaN(diamonds)) return;

      const player = await getPlayer(telegramId);
      if (!player) return;

      await db
        .update(players)
        .set({ diamonds: (player.diamonds || 0) + diamonds })
        .where(eq(players.id, player.id));

      await ctx.reply(
        `💎 <b>Пополнение успешно!</b>\n+${diamonds}💎 алмазов зачислено!\nТеперь у тебя ${player.diamonds + diamonds}💎`,
        { parse_mode: "HTML" },
      );
    } catch (e) {
      logger.error({ err: e }, "successful_payment error");
    }
  });
}

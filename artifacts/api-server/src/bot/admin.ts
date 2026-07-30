import { Bot, InlineKeyboard } from "grammy";
import { db, players } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── Admin Telegram ID ─────────────────────────────────────────────────
const ADMIN_IDS = new Set([7716573475]); // only this user

// ─── Auth guard ────────────────────────────────────────────────────────
export function isAdmin(telegramId?: number): boolean {
  return telegramId ? ADMIN_IDS.has(telegramId) : false;
}

// ─── Find player by nickname (case-insensitive LIKE) ────────────────────
async function findPlayerByNickname(nickname: string) {
  const rows = await db.query.players.findMany({
    where: (p, { ilike }) => ilike(p.nickname, nickname),
    limit: 1,
  });
  return rows[0] ?? null;
}

// ─── Register admin commands ───────────────────────────────────────────
export function registerAdminCommands(bot: Bot) {
  // ── /admin_levelup <ник> <число> ────────────────────────────────────
  bot.command("admin_levelup", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const parts = ctx.match?.trim().split(/\s+/);
    if (!parts || parts.length < 2) {
      await ctx.reply("❌ Использование: /admin_levelup ИмяПерсонажа Число");
      return;
    }
    const amount = parseInt(parts.pop()!, 10);
    const nickname = parts.join(" ");
    if (isNaN(amount) || amount < 1) {
      await ctx.reply("❌ Число должно быть положительным.");
      return;
    }
    const player = await findPlayerByNickname(nickname);
    if (!player) {
      await ctx.reply(`❌ Игрок с ником «${nickname}» не найден.`);
      return;
    }
    await db.update(players).set({ level: player.level + amount }).where(eq(players.id, player.id));
    await ctx.reply(`✅ ${player.nickname} — уровень повышен с ${player.level} до ${player.level + amount}.`);
  });

  // ── /admin_leveldown <ник> <число> ──────────────────────────────────
  bot.command("admin_leveldown", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const parts = ctx.match?.trim().split(/\s+/);
    if (!parts || parts.length < 2) {
      await ctx.reply("❌ Использование: /admin_leveldown ИмяПерсонажа Число");
      return;
    }
    const amount = parseInt(parts.pop()!, 10);
    const nickname = parts.join(" ");
    if (isNaN(amount) || amount < 1) {
      await ctx.reply("❌ Число должно быть положительным.");
      return;
    }
    const player = await findPlayerByNickname(nickname);
    if (!player) {
      await ctx.reply(`❌ Игрок с ником «${nickname}» не найден.`);
      return;
    }
    const newLevel = Math.max(1, player.level - amount);
    await db.update(players).set({ level: newLevel }).where(eq(players.id, player.id));
    await ctx.reply(`✅ ${player.nickname} — уровень понижен с ${player.level} до ${newLevel}.`);
  });

  // ── /admin_gold <ник> <число> ───────────────────────────────────────
  bot.command("admin_gold", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const parts = ctx.match?.trim().split(/\s+/);
    if (!parts || parts.length < 2) {
      await ctx.reply("❌ Использование: /admin_gold ИмяПерсонажа Число");
      return;
    }
    const amount = parseInt(parts.pop()!, 10);
    const nickname = parts.join(" ");
    if (isNaN(amount) || amount < 1) {
      await ctx.reply("❌ Число должно быть положительным.");
      return;
    }
    const player = await findPlayerByNickname(nickname);
    if (!player) {
      await ctx.reply(`❌ Игрок с ником «${nickname}» не найден.`);
      return;
    }
    await db.update(players).set({ gold: player.gold + amount }).where(eq(players.id, player.id));
    await ctx.reply(`✅ ${player.nickname} — выдано ${amount}🪙. Баланс: ${player.gold + amount}🪙.`);
  });

  // ── /admin_diamonds <ник> <число> ───────────────────────────────────
  bot.command("admin_diamonds", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const parts = ctx.match?.trim().split(/\s+/);
    if (!parts || parts.length < 2) {
      await ctx.reply("❌ Использование: /admin_diamonds ИмяПерсонажа Число");
      return;
    }
    const amount = parseInt(parts.pop()!, 10);
    const nickname = parts.join(" ");
    if (isNaN(amount) || amount < 1) {
      await ctx.reply("❌ Число должно быть положительным.");
      return;
    }
    const player = await findPlayerByNickname(nickname);
    if (!player) {
      await ctx.reply(`❌ Игрок с ником «${nickname}» не найден.`);
      return;
    }
    await db.update(players).set({ diamonds: player.diamonds + amount }).where(eq(players.id, player.id));
    await ctx.reply(`✅ ${player.nickname} — выдано ${amount}💎. Баланс: ${player.diamonds + amount}💎.`);
  });

  // ── /admin_ban <ник> ────────────────────────────────────────────────
  bot.command("admin_ban", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const nickname = ctx.match?.trim();
    if (!nickname) {
      await ctx.reply("❌ Использование: /admin_ban ИмяПерсонажа");
      return;
    }
    const player = await findPlayerByNickname(nickname);
    if (!player) {
      await ctx.reply(`❌ Игрок с ником «${nickname}» не найден.`);
      return;
    }
    if (player.banned) {
      await ctx.reply(`⚠️ ${player.nickname} уже забанен.`);
      return;
    }
    await db.update(players).set({ banned: true }).where(eq(players.id, player.id));
    await ctx.reply(`✅ ${player.nickname} забанен.`);
  });

  // ── /admin_unban <ник> ──────────────────────────────────────────────
  bot.command("admin_unban", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    const nickname = ctx.match?.trim();
    if (!nickname) {
      await ctx.reply("❌ Использование: /admin_unban ИмяПерсонажа");
      return;
    }
    const player = await findPlayerByNickname(nickname);
    if (!player) {
      await ctx.reply(`❌ Игрок с ником «${nickname}» не найден.`);
      return;
    }
    if (!player.banned) {
      await ctx.reply(`⚠️ ${player.nickname} не забанен.`);
      return;
    }
    await db.update(players).set({ banned: false }).where(eq(players.id, player.id));
    await ctx.reply(`✅ ${player.nickname} разбанен.`);
  });

  // ── /admin_help — список команд ─────────────────────────────────────
  bot.command("admin_help", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return;
    await ctx.reply(
      `🔐 <b>Админ-команды:</b>\n\n` +
      `/admin_levelup Ник Число — поднять уровень\n` +
      `/admin_leveldown Ник Число — опустить уровень\n` +
      `/admin_gold Ник Число — выдать золото\n` +
      `/admin_diamonds Ник Число — выдать алмазы\n` +
      `/admin_ban Ник — забанить игрока\n` +
      `/admin_unban Ник — разбанить игрока\n`,
      { parse_mode: "HTML" }
    );
  });
}

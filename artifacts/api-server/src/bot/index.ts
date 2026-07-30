import { Bot } from "grammy";
import { logger } from "../lib/logger";
import { registerHandlers } from "./handlers";

let botInstance: Bot | null = null;

// Simple in-memory session store for temp state
const tempSession = new Map<number, Record<string, any>>();

export function getTempSession(telegramId: number) {
  if (!tempSession.has(telegramId)) {
    tempSession.set(telegramId, {});
  }
  return tempSession.get(telegramId)!;
}

export function clearTempSession(telegramId: number) {
  tempSession.delete(telegramId);
}

export function startBot() {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.error("TELEGRAM_BOT_TOKEN is not set. Bot will not start.");
    return;
  }

  const bot = new Bot(token);

  // Add session helpers via middleware
  bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (telegramId) {
      const session = getTempSession(telegramId);
      (ctx as any).session = {
        get: async (key: string) => session[key],
        set: async (key: string, value: any) => {
          session[key] = value;
        },
      };
    }
    await next();
  });

  registerHandlers(bot);

  bot.catch((err) => {
    logger.error({ err: err.error }, "Bot error");
  });

  botInstance = bot;

  // Start polling — no drop_pending_updates to avoid losing messages
  bot.start({
    onStart: ({ username }) => {
      logger.info({ username }, "TG bot started");
    },
  });

  logger.info("Telegram bot polling started");
}

export function stopBot() {
  if (botInstance) {
    botInstance.stop();
    botInstance = null;
    logger.info("Telegram bot stopped");
  }
}

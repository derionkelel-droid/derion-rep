import cron from "node-cron";
import { MSK_TIMEZONE, formatMskTime } from "./time";
import { logger } from "../lib/logger";

type ScheduledTask = {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  running: boolean;
};

const tasks: ScheduledTask[] = [];

/**
 * Register a cron task that runs in Moscow timezone.
 * @param name — human-readable task name for logs
 * @param cronExpression — standard 5-field cron (no seconds field)
 * @param handler — async function to execute
 */
export function registerCronTask(name: string, cronExpression: string, handler: () => Promise<void>) {
  const task: ScheduledTask = { name, cronExpression, handler, running: false };

  cron.schedule(
    cronExpression,
    async () => {
      if (task.running) {
        logger.warn({ task: name }, "Skipping cron run — previous run still in progress");
        return;
      }
      task.running = true;
      try {
        logger.info({ task: name, time: formatMskTime() }, "Cron task started");
        await handler();
        logger.info({ task: name }, "Cron task completed");
      } catch (err) {
        logger.error({ err, task: name }, "Cron task failed");
      } finally {
        task.running = false;
      }
    },
    { timezone: MSK_TIMEZONE },
  );

  tasks.push(task);
  logger.info({ name, cron: cronExpression, tz: MSK_TIMEZONE }, "Cron task registered");
}

/**
 * Start all time-based schedulers for the game.
 */
export function initSchedulers() {
  logger.info({ tz: MSK_TIMEZONE }, "Initializing game schedulers (MSK)");

  // ─── Daily reset at 06:00 MSK ──────────────────────────────────────────
  // Reset daily limits, regenerate energy, etc.
  registerCronTask("daily_reset", "0 6 * * *", async () => {
    // Future: daily quest reset, energy regen, etc.
    logger.info("Daily MSK reset tick");
  });

  // ─── Hourly server tick ────────────────────────────────────────────────
  registerCronTask("hourly_tick", "0 * * * *", async () => {
    // Future: passive regeneration, world events
    logger.info({ time: formatMskTime() }, "Hourly tick");
  });

  logger.info("Schedulers initialized");
}

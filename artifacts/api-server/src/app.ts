import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startBot } from "./bot";
import { MSK_TIMEZONE } from "./bot/time";
import { seedGameData, migrateNpcs, migrateJunk, migrateJunkBuyers, migrateNewNpcs, migrateEquipmentLocations } from "./bot/seed";
import { initSchedulers } from "./bot/scheduler";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Start bot and seed data after app initialization
// Set Moscow timezone for all Date operations
process.env["TZ"] = MSK_TIMEZONE;

seedGameData()
  .then(() => migrateNpcs())
  .then(() => migrateJunk())
  .then(() => migrateJunkBuyers())
  .then(() => migrateNewNpcs())
  .then(() => migrateEquipmentLocations())
  .then(() => {
    initSchedulers();
    startBot();
  })
  .catch((err) => {
    logger.error({ err }, "Failed to seed game data or start bot");
    startBot(); // still try to start the bot
  });

export default app;

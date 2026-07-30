import { db, eq, players, type Player } from "@workspace/db";
import { calculateAttack, calculateDefense, calculateMaxHp } from "./game";

const ATTACK_ZONES = ["голова", "грудь", "живот", "пояс", "ноги"] as const;
const BLOCK_ZONES = [
  ["голова", "грудь"],
  ["грудь", "живот"],
  ["живот", "пояс"],
  ["пояс", "ноги"],
  ["ноги", "голова"],
] as const;
const ZONE_NAMES: Record<string, string> = {
  голова: "🎯 Голова",
  грудь: "🎯 Грудь",
  живот: "🎯 Живот",
  пояс: "🎯 Пояс",
  ноги: "🎯 Ноги",
};
const BLOCK_NAMES = [
  "🛡️ Голова+Грудь",
  "🛡️ Грудь+Живот",
  "🛡️ Живот+Пояс",
  "🛡️ Пояс+Ноги",
  "🛡️ Ноги+Голова",
];

export function getAttackZones() {
  return ATTACK_ZONES.map((z, i) => ({ zone: z, label: ZONE_NAMES[z], index: i }));
}

export function getBlockZones() {
  return BLOCK_ZONES.map((z, i) => ({
    zone1: z[0],
    zone2: z[1],
    label: BLOCK_NAMES[i],
    index: i,
  }));
}

export function randomEnemyAttack(): string {
  return ATTACK_ZONES[Math.floor(Math.random() * ATTACK_ZONES.length)];
}

export function randomEnemyBlock(): [string, string] {
  return BLOCK_ZONES[Math.floor(Math.random() * BLOCK_ZONES.length)];
}

export interface CombatResult {
  playerDamage: number;
  monsterDamage: number;
  playerHit: boolean;
  monsterHit: boolean;
  playerBlocked: boolean;
  monsterBlocked: boolean;
  playerNewHp: number;
  monsterNewHp: number;
  attackZone: string;
  monsterAttackZone: string;
  playerBlockZone: [string, string];
  monsterBlockZone: [string, string];
  log: string[];
}

export function resolveRound(
  player: Player,
  playerAttackZone: string,
  playerBlockZone: [string, string],
  monsterHp: number,
  monsterAttack: number,
  monsterDefense: number,
  equipBonusAtk = 0,
  equipBonusDef = 0,
): CombatResult {
  const monsterAttackZone = randomEnemyAttack();
  const monsterBlockZone = randomEnemyBlock();

  // Monster attack blocked?
  const monsterBlocked = playerBlockZone.includes(monsterAttackZone);
  // Player attack blocked?
  const playerBlocked = monsterBlockZone.includes(playerAttackZone);

  const playerAtk = calculateAttack(player, equipBonusAtk);
  const playerDef = calculateDefense(player, equipBonusDef);

  // Player hits monster
  let rawPlayerDmg = Math.max(1, playerAtk - monsterDefense * 0.3);
  rawPlayerDmg = rawPlayerDmg * (0.8 + Math.random() * 0.4);
  const playerDamage = playerBlocked ? Math.floor(rawPlayerDmg * 0.3) : Math.floor(rawPlayerDmg);

  // Monster hits player
  let rawMonsterDmg = Math.max(1, monsterAttack - playerDef * 0.3);
  rawMonsterDmg = rawMonsterDmg * (0.8 + Math.random() * 0.4);
  const monsterDamage = monsterBlocked ? Math.floor(rawMonsterDmg * 0.3) : Math.floor(rawMonsterDmg);

  const newMonsterHp = Math.max(0, monsterHp - playerDamage);
  const newPlayerHp = Math.max(0, player.currentHp - monsterDamage);

  const log: string[] = [];
  log.push(`⚔️ <b>РАУНД!</b>`);
  log.push(`━━━━━━━━━━━━━━━`);
  log.push(
    `🗡️ Ты атакуешь <b>${ZONE_NAMES[playerAttackZone].replace("🎯 ", "")}</b>` +
      (playerBlocked ? ` — 🛡️ Монстр заблокировал! (-${playerDamage} HP)` : ` — 💥 Попадание! (-${playerDamage} HP)`),
  );
  log.push(
    `👹 Монстр атакует <b>${ZONE_NAMES[monsterAttackZone].replace("🎯 ", "")}</b>` +
      (monsterBlocked ? ` — 🛡️ Ты заблокировал! (-${monsterDamage} HP)` : ` — 💥 Попадание! (-${monsterDamage} HP)`),
  );
  log.push(`━━━━━━━━━━━━━━━`);
  log.push(`❤️ Твоё HP: ${newPlayerHp} (-${monsterDamage})`);
  log.push(`💀 HP монстра: ${newMonsterHp} (-${playerDamage})`);

  return {
    playerDamage,
    monsterDamage,
    playerHit: playerDamage > 0,
    monsterHit: monsterDamage > 0,
    playerBlocked,
    monsterBlocked,
    playerNewHp: newPlayerHp,
    monsterNewHp: newMonsterHp,
    attackZone: playerAttackZone,
    monsterAttackZone,
    playerBlockZone,
    monsterBlockZone,
    log,
  };
}

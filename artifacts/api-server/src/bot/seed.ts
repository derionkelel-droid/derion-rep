import { db } from "@workspace/db";
import {
  locations,
  equipmentItems,
  monsters,
  monsterDrops,
  npcs,
} from "@workspace/db";
import { logger } from "../lib/logger";

export async function seedGameData() {
  const existing = await db.query.locations.findFirst();
  if (existing) {
    logger.info("Game data already seeded, skipping.");
    return;
  }

  logger.info("Seeding game data...");

  // ─── 1. LOCATIONS ──────────────────────────────────────────────────────
  await db.insert(locations).values([
    { name: "🌿 Начальная поляна", description: "Мирное место, где начинающие герои делают свои первые шаги. Здесь водятся лишь слабые монстры.", requiredLevel: 1, orderIndex: 0 },
    { name: "🌲 Тёмный лес", description: "Густой лес куда не проникает солнечный свет. Опасные твари прячутся в тени деревьев.", requiredLevel: 5, orderIndex: 1 },
    { name: "🌊 Болотные топи", description: "Зловонные болота с ядовитыми испарениями.", requiredLevel: 10, orderIndex: 2 },
    { name: "🏔️ Каменистое плато", description: "Ветреное плато с острыми скалами.", requiredLevel: 15, orderIndex: 3 },
    { name: "🏛️ Забытые руины", description: "Древние руины павшей цивилизации.", requiredLevel: 20, orderIndex: 4 },
    { name: "❄️ Ледяные вершины", description: "Вечная мерзлота и ледяные ветра.", requiredLevel: 25, orderIndex: 5 },
    { name: "🌋 Вулканические недра", description: "Раскалённые пещеры под землёй.", requiredLevel: 30, orderIndex: 6 },
    { name: "🌫️ Туманное ущелье", description: "Ущелье окутанное густым туманом.", requiredLevel: 35, orderIndex: 7 },
    { name: "🔮 Затерянный храм", description: "Древний храм полный ловушек и магических стражей.", requiredLevel: 40, orderIndex: 8 },
    { name: "✨ Эфирные чертоги", description: "Пограничье между мирами.", requiredLevel: 45, orderIndex: 9 },
  ]);

  // ─── 2. EQUIPMENT ──────────────────────────────────────────────────────
  await db.insert(equipmentItems).values([
    // == SHOP ITEMS ==
    { name: "Деревянный меч", slot: "weapon", armorType: "weapon", requiredLevel: 1, requiredClass: "warrior", bonusAttack: 5, price: 50, isShopItem: true, description: "Простой деревянный меч." },
    { name: "Короткий лук", slot: "weapon", armorType: "weapon", requiredLevel: 1, requiredClass: "archer", bonusAttack: 4, bonusAgility: 1, price: 50, isShopItem: true, description: "Лёгкий лук для охоты." },
    { name: "Ученический посох", slot: "weapon", armorType: "weapon", requiredLevel: 1, requiredClass: "mage", bonusAttack: 3, bonusIntelligence: 2, price: 50, isShopItem: true, description: "Простой посох." },
    { name: "Ржавый кинжал", slot: "weapon", armorType: "weapon", requiredLevel: 1, requiredClass: "assassin", bonusAttack: 3, bonusAgility: 2, price: 50, isShopItem: true, description: "Старый но острый кинжал." },
    { name: "Тряпичная шапка", slot: "head", armorType: "cloth", requiredLevel: 1, bonusDefense: 2, price: 30, isShopItem: true, description: "Простая шапка." },
    { name: "Кожаный жилет", slot: "chest", armorType: "leather", requiredLevel: 1, bonusDefense: 3, bonusHp: 10, price: 60, isShopItem: true, description: "Лёгкий кожаный жилет." },
    { name: "Железный меч", slot: "weapon", armorType: "weapon", requiredLevel: 5, requiredClass: "warrior", bonusAttack: 12, bonusStrength: 2, price: 200, isShopItem: true, description: "Надёжный железный меч." },
    { name: "Длинный лук", slot: "weapon", armorType: "weapon", requiredLevel: 5, requiredClass: "archer", bonusAttack: 10, bonusAgility: 2, price: 200, isShopItem: true, description: "Лук с хорошей дальностью." },
    { name: "Магический жезл", slot: "weapon", armorType: "weapon", requiredLevel: 5, requiredClass: "mage", bonusAttack: 8, bonusIntelligence: 3, price: 200, isShopItem: true, description: "Жезл с магическим камнем." },
    { name: "Стальной кинжал", slot: "weapon", armorType: "weapon", requiredLevel: 5, requiredClass: "assassin", bonusAttack: 8, bonusAgility: 3, price: 200, isShopItem: true, description: "Острый стальной кинжал." },
    { name: "Железный шлем", slot: "head", armorType: "plate", requiredLevel: 5, requiredClass: "warrior", bonusDefense: 6, bonusHp: 10, price: 150, isShopItem: true, description: "Тяжёлый железный шлем." },
    { name: "Кольчуга", slot: "chest", armorType: "plate", requiredLevel: 5, requiredClass: "warrior", bonusDefense: 10, bonusHp: 25, price: 300, isShopItem: true, description: "Надёжная кольчуга." },
    { name: "Берсеркер", slot: "weapon", armorType: "weapon", requiredLevel: 10, requiredClass: "warrior", bonusAttack: 22, bonusStrength: 3, bonusVitality: 2, price: 500, isShopItem: true, description: "Тяжёлый двуручный меч." },
    { name: "Ледяные стрелы", slot: "weapon", armorType: "weapon", requiredLevel: 10, requiredClass: "archer", bonusAttack: 18, bonusAgility: 4, price: 500, isShopItem: true, description: "Стрелы с ледяным наконечником." },
    { name: "Посох огня", slot: "weapon", armorType: "weapon", requiredLevel: 10, requiredClass: "mage", bonusAttack: 16, bonusIntelligence: 5, price: 500, isShopItem: true, description: "Посох наполненный огненной магией." },
    { name: "Когти тьмы", slot: "weapon", armorType: "weapon", requiredLevel: 10, requiredClass: "assassin", bonusAttack: 16, bonusAgility: 5, price: 500, isShopItem: true, description: "Парные когти отравленные ядом." },
    { name: "Стальной нагрудник", slot: "chest", armorType: "plate", requiredLevel: 10, requiredClass: "warrior", bonusDefense: 18, bonusHp: 40, bonusVitality: 2, price: 600, isShopItem: true, description: "Тяжёлый стальной нагрудник." },
    { name: "Плащ ткача", slot: "chest", armorType: "cloth", requiredLevel: 10, requiredClass: "mage", bonusDefense: 8, bonusHp: 20, bonusIntelligence: 3, price: 400, isShopItem: true, description: "Магический плащ." },
    { name: "Мифриловый меч", slot: "weapon", armorType: "weapon", requiredLevel: 15, requiredClass: "warrior", bonusAttack: 35, bonusStrength: 5, price: 1200, isShopItem: true, description: "Лёгкий и прочный мифриловый меч." },
    { name: "Эльфийский лук", slot: "weapon", armorType: "weapon", requiredLevel: 15, requiredClass: "archer", bonusAttack: 28, bonusAgility: 6, price: 1200, isShopItem: true, description: "Эльфийский лук." },
    { name: "Посох бурь", slot: "weapon", armorType: "weapon", requiredLevel: 15, requiredClass: "mage", bonusAttack: 25, bonusIntelligence: 7, price: 1200, isShopItem: true, description: "Посох призывающий молнии." },
    { name: "Теневые клинки", slot: "weapon", armorType: "weapon", requiredLevel: 15, requiredClass: "assassin", bonusAttack: 25, bonusAgility: 7, price: 1200, isShopItem: true, description: "Клинки из теневой стали." },
    { name: "Стальные поножи", slot: "legs", armorType: "plate", requiredLevel: 10, requiredClass: "warrior", bonusDefense: 12, bonusVitality: 1, price: 350, isShopItem: true, description: "Тяжёлые стальные поножи." },
    { name: "Кожаные штаны", slot: "legs", armorType: "leather", requiredLevel: 5, bonusDefense: 5, bonusAgility: 1, price: 120, isShopItem: true, description: "Лёгкие кожаные штаны." },
    { name: "Сапоги странника", slot: "feet", armorType: "leather", requiredLevel: 1, bonusDefense: 2, price: 40, isShopItem: true, description: "Прочные сапоги для дальних странствий." },
    // Higher tier shop items
    { name: "Рунический меч", slot: "weapon", armorType: "weapon", requiredLevel: 20, requiredClass: "warrior", bonusAttack: 48, bonusStrength: 7, bonusVitality: 3, price: 2500, isShopItem: true, description: "Меч с древними рунами." },
    { name: "Арбалет", slot: "weapon", armorType: "weapon", requiredLevel: 20, requiredClass: "archer", bonusAttack: 40, bonusAgility: 8, price: 2500, isShopItem: true, description: "Мощный механический арбалет." },
    { name: "Посох времени", slot: "weapon", armorType: "weapon", requiredLevel: 20, requiredClass: "mage", bonusAttack: 35, bonusIntelligence: 10, price: 2500, isShopItem: true, description: "Посох искажающий время." },
    { name: "Убийца драконов", slot: "weapon", armorType: "weapon", requiredLevel: 20, requiredClass: "assassin", bonusAttack: 35, bonusAgility: 10, price: 2500, isShopItem: true, description: "Кинжал убивавший драконов." },
    { name: "Палач", slot: "weapon", armorType: "weapon", requiredLevel: 25, requiredClass: "warrior", bonusAttack: 65, bonusStrength: 10, bonusVitality: 5, price: 5000, isShopItem: true, description: "Массивный топор палача." },
    { name: "Лук феникса", slot: "weapon", armorType: "weapon", requiredLevel: 25, requiredClass: "archer", bonusAttack: 55, bonusAgility: 12, price: 5000, isShopItem: true, description: "Лук из пера феникса." },
    { name: "Посох бездны", slot: "weapon", armorType: "weapon", requiredLevel: 25, requiredClass: "mage", bonusAttack: 50, bonusIntelligence: 14, price: 5000, isShopItem: true, description: "Посох из глубин бездны." },
    { name: "Коса смерти", slot: "weapon", armorType: "weapon", requiredLevel: 25, requiredClass: "assassin", bonusAttack: 50, bonusAgility: 14, price: 5000, isShopItem: true, description: "Коса несущая смерть." },
    { name: "Легенда", slot: "weapon", armorType: "weapon", requiredLevel: 30, requiredClass: "warrior", bonusAttack: 85, bonusStrength: 14, bonusVitality: 8, price: 10000, isShopItem: true, description: "Меч о котором слагают легенды." },
    { name: "Ветролом", slot: "weapon", armorType: "weapon", requiredLevel: 30, requiredClass: "archer", bonusAttack: 72, bonusAgility: 16, price: 10000, isShopItem: true, description: "Лук пронзающий ветер." },
    { name: "Посох творца", slot: "weapon", armorType: "weapon", requiredLevel: 30, requiredClass: "mage", bonusAttack: 65, bonusIntelligence: 18, price: 10000, isShopItem: true, description: "Посох созданный богами." },
    { name: "Немезида", slot: "weapon", armorType: "weapon", requiredLevel: 30, requiredClass: "assassin", bonusAttack: 65, bonusAgility: 18, price: 10000, isShopItem: true, description: "Оружие возмездия." },
    { name: "Громовержец", slot: "weapon", armorType: "weapon", requiredLevel: 35, requiredClass: "warrior", bonusAttack: 110, bonusStrength: 18, bonusVitality: 10, price: 20000, isShopItem: true, description: "Молот мечущий громы." },
    { name: "Небесная стрела", slot: "weapon", armorType: "weapon", requiredLevel: 35, requiredClass: "archer", bonusAttack: 95, bonusAgility: 20, price: 20000, isShopItem: true, description: "Стрела сбивающая звёзды." },
    { name: "Посох вечности", slot: "weapon", armorType: "weapon", requiredLevel: 35, requiredClass: "mage", bonusAttack: 85, bonusIntelligence: 24, price: 20000, isShopItem: true, description: "Посох существующий вне времени." },
    { name: "Клинок тени", slot: "weapon", armorType: "weapon", requiredLevel: 35, requiredClass: "assassin", bonusAttack: 85, bonusAgility: 24, price: 20000, isShopItem: true, description: "Клинок из чистой тьмы." },
    { name: "Эфириум", slot: "weapon", armorType: "weapon", requiredLevel: 40, requiredClass: "warrior", bonusAttack: 140, bonusStrength: 24, bonusVitality: 14, price: 40000, isShopItem: true, description: "Оружие из эфирной стали." },
    { name: "Созвездие", slot: "weapon", armorType: "weapon", requiredLevel: 40, requiredClass: "archer", bonusAttack: 120, bonusAgility: 28, price: 40000, isShopItem: true, description: "Лук выкованный из звёзд." },
    { name: "Бесконечность", slot: "weapon", armorType: "weapon", requiredLevel: 40, requiredClass: "mage", bonusAttack: 110, bonusIntelligence: 32, price: 40000, isShopItem: true, description: "Посох бесконечной магии." },
    { name: "Призрак", slot: "weapon", armorType: "weapon", requiredLevel: 40, requiredClass: "assassin", bonusAttack: 110, bonusAgility: 32, price: 40000, isShopItem: true, description: "Кинжал невидимый для врага." },

    // == MONSTER DROP ITEMS (not sold in shop) ==
    { name: "Клык кабана", slot: "weapon", armorType: "weapon", requiredLevel: 2, bonusAttack: 4, price: 0, isShopItem: false, description: "Острый клык дикого кабана." },
    { name: "Паучья нить", slot: "accessory", armorType: "cloth", requiredLevel: 2, bonusDefense: 1, bonusAgility: 2, price: 0, isShopItem: false, description: "Прочная нить из паутины." },
    { name: "Волчья шкура", slot: "chest", armorType: "leather", requiredLevel: 3, bonusDefense: 4, bonusHp: 8, price: 0, isShopItem: false, description: "Тёплая шкура волка." },
    { name: "Крысиный хвост", slot: "accessory", armorType: "cloth", requiredLevel: 1, bonusAgility: 1, price: 0, isShopItem: false, description: "Скользкий хвост гигантской крысы." },
    { name: "Ветка лешего", slot: "weapon", armorType: "weapon", requiredLevel: 4, requiredClass: "mage", bonusAttack: 5, bonusIntelligence: 2, price: 0, isShopItem: false, description: "Ветка с магической энергией леса." },
    { name: "Медвежья шкура", slot: "chest", armorType: "leather", requiredLevel: 6, bonusDefense: 7, bonusHp: 20, price: 0, isShopItem: false, description: "Толстая шкура медведя." },
    { name: "Клык вампира", slot: "weapon", armorType: "weapon", requiredLevel: 7, requiredClass: "assassin", bonusAttack: 10, bonusAgility: 3, price: 0, isShopItem: false, description: "Клык лесного вампира." },
    { name: "Древесная кора", slot: "chest", armorType: "plate", requiredLevel: 6, requiredClass: "warrior", bonusDefense: 10, bonusHp: 15, price: 0, isShopItem: false, description: "Твёрдая кора корня-душителя." },
    { name: "Олений рог", slot: "weapon", armorType: "weapon", requiredLevel: 7, bonusAttack: 8, bonusAgility: 2, price: 0, isShopItem: false, description: "Крепкий олений рог." },
    { name: "Дубина тролля", slot: "weapon", armorType: "weapon", requiredLevel: 8, requiredClass: "warrior", bonusAttack: 15, bonusStrength: 2, price: 0, isShopItem: false, description: "Тяжёлая дубина лесного тролля." },
    { name: "Чешуя крокодила", slot: "chest", armorType: "plate", requiredLevel: 11, bonusDefense: 12, bonusHp: 20, price: 0, isShopItem: false, description: "Прочная чешуя болотного крокодила." },
    { name: "Ядовитая железа", slot: "accessory", armorType: "cloth", requiredLevel: 11, requiredClass: "assassin", bonusAttack: 6, price: 0, isShopItem: false, description: "Железа ядовитой жабы." },
    { name: "Грязевая сфера", slot: "accessory", armorType: "cloth", requiredLevel: 12, requiredClass: "mage", bonusAttack: 5, bonusIntelligence: 3, price: 0, isShopItem: false, description: "Сфера болотной магии." },
    { name: "Крыло москита", slot: "weapon", armorType: "weapon", requiredLevel: 11, bonusAgility: 4, price: 0, isShopItem: false, description: "Крыло огромного москита." },
    { name: "Змеиный клык", slot: "weapon", armorType: "weapon", requiredLevel: 13, requiredClass: "assassin", bonusAttack: 12, bonusAgility: 4, price: 0, isShopItem: false, description: "Ядовитый клык болотной змеи." },
    { name: "Топяное жало", slot: "weapon", armorType: "weapon", requiredLevel: 13, bonusAttack: 11, bonusAgility: 3, price: 0, isShopItem: false, description: "Жало топяного паука." },
    { name: "Каменное сердце", slot: "accessory", armorType: "cloth", requiredLevel: 16, requiredClass: "warrior", bonusVitality: 4, bonusDefense: 5, price: 0, isShopItem: false, description: "Сердце каменного голема." },
    { name: "Острый осколок", slot: "weapon", armorType: "weapon", requiredLevel: 17, bonusAttack: 18, bonusStrength: 3, price: 0, isShopItem: false, description: "Осколок горной породы." },
    { name: "Перо орла", slot: "accessory", armorType: "cloth", requiredLevel: 16, bonusAgility: 5, price: 0, isShopItem: false, description: "Гигантское перо горного орла." },
    { name: "Кристаллический глаз", slot: "accessory", armorType: "cloth", requiredLevel: 17, requiredClass: "mage", bonusIntelligence: 5, price: 0, isShopItem: false, description: "Глаз кристального паука." },
    { name: "Осколок руды", slot: "weapon", armorType: "weapon", requiredLevel: 18, bonusAttack: 22, bonusVitality: 2, price: 0, isShopItem: false, description: "Тяжёлый осколок руды." },
    { name: "Кость скелета", slot: "weapon", armorType: "weapon", requiredLevel: 21, bonusAttack: 25, bonusStrength: 4, price: 0, isShopItem: false, description: "Кость древнего скелета." },
    { name: "Эфирная сфера", slot: "accessory", armorType: "cloth", requiredLevel: 22, requiredClass: "mage", bonusIntelligence: 7, bonusAttack: 8, price: 0, isShopItem: false, description: "Сфера призрачной магии." },
    { name: "Проклятый доспех", slot: "chest", armorType: "plate", requiredLevel: 23, requiredClass: "warrior", bonusDefense: 16, bonusHp: 30, bonusStrength: 3, price: 0, isShopItem: false, description: "Доспех проклятого рыцаря." },
    { name: "Мутировавшая лапка", slot: "weapon", armorType: "weapon", requiredLevel: 21, bonusAttack: 22, bonusAgility: 5, price: 0, isShopItem: false, description: "Лапа паука-мутанта." },
    { name: "Фолиант лича", slot: "weapon", armorType: "weapon", requiredLevel: 24, requiredClass: "mage", bonusAttack: 28, bonusIntelligence: 8, price: 0, isShopItem: false, description: "Книга заклинаний лича." },
    { name: "Ледяной клык", slot: "weapon", armorType: "weapon", requiredLevel: 26, bonusAttack: 35, bonusAgility: 6, price: 0, isShopItem: false, description: "Клык ледяного волка." },
    { name: "Снежная корона", slot: "head", armorType: "cloth", requiredLevel: 27, bonusIntelligence: 7, bonusDefense: 8, price: 0, isShopItem: false, description: "Корона из снежного хрусталя." },
    { name: "Когти медведя", slot: "weapon", armorType: "weapon", requiredLevel: 27, requiredClass: "warrior", bonusAttack: 35, bonusStrength: 6, bonusVitality: 3, price: 0, isShopItem: false, description: "Когти белого медведя." },
    { name: "Ледовый щит", slot: "chest", armorType: "plate", requiredLevel: 28, bonusDefense: 22, bonusHp: 35, price: 0, isShopItem: false, description: "Щит из вечного льда." },
    { name: "Чешуя дракона", slot: "chest", armorType: "plate", requiredLevel: 29, bonusDefense: 25, bonusHp: 50, bonusStrength: 4, price: 0, isShopItem: false, description: "Чешуя снежного дракона." },
    { name: "Искра огня", slot: "accessory", armorType: "cloth", requiredLevel: 31, requiredClass: "mage", bonusIntelligence: 10, bonusAttack: 10, price: 0, isShopItem: false, description: "Искра огненного элементаля." },
    { name: "Лавовый клинок", slot: "weapon", armorType: "weapon", requiredLevel: 32, requiredClass: "warrior", bonusAttack: 48, bonusStrength: 8, price: 0, isShopItem: false, description: "Клинок из лавы." },
    { name: "Рога демона", slot: "head", armorType: "plate", requiredLevel: 33, requiredClass: "warrior", bonusDefense: 15, bonusStrength: 5, bonusAttack: 10, price: 0, isShopItem: false, description: "Рога огненного демона." },
    { name: "Огненный язык", slot: "weapon", armorType: "weapon", requiredLevel: 32, bonusAttack: 42, bonusAgility: 7, price: 0, isShopItem: false, description: "Язык саламандры." },
    { name: "Вулканический жезл", slot: "weapon", armorType: "weapon", requiredLevel: 34, requiredClass: "mage", bonusAttack: 38, bonusIntelligence: 12, price: 0, isShopItem: false, description: "Жезл вулканического мага." },
    { name: "Призрачная ткань", slot: "chest", armorType: "cloth", requiredLevel: 36, bonusDefense: 14, bonusAgility: 8, price: 0, isShopItem: false, description: "Ткань из призрачной материи." },
    { name: "Теневой кинжал", slot: "weapon", armorType: "weapon", requiredLevel: 37, requiredClass: "assassin", bonusAttack: 48, bonusAgility: 12, price: 0, isShopItem: false, description: "Кинжал теневого убийцы." },
    { name: "Проклятый меч", slot: "weapon", armorType: "weapon", requiredLevel: 38, requiredClass: "warrior", bonusAttack: 55, bonusStrength: 10, bonusVitality: 5, price: 0, isShopItem: false, description: "Меч проклятого паладина." },
    { name: "Перо тьмы", slot: "accessory", armorType: "cloth", requiredLevel: 36, bonusAgility: 10, price: 0, isShopItem: false, description: "Перо призрачной совы." },
    { name: "Эхо битвы", slot: "weapon", armorType: "weapon", requiredLevel: 39, requiredClass: "archer", bonusAttack: 55, bonusAgility: 14, price: 0, isShopItem: false, description: "Лук тёмного генерала." },
    { name: "Древний амулет", slot: "accessory", armorType: "cloth", requiredLevel: 41, bonusIntelligence: 12, bonusDefense: 8, price: 0, isShopItem: false, description: "Амулет храмового стража." },
    { name: "Магический кристалл", slot: "weapon", armorType: "weapon", requiredLevel: 42, requiredClass: "mage", bonusAttack: 55, bonusIntelligence: 18, price: 0, isShopItem: false, description: "Кристалл магического голема." },
    { name: "Кожа змеи", slot: "chest", armorType: "leather", requiredLevel: 43, bonusDefense: 18, bonusAgility: 10, price: 0, isShopItem: false, description: "Кожа древней змеи." },
    { name: "Посох жреца", slot: "weapon", armorType: "weapon", requiredLevel: 42, requiredClass: "mage", bonusAttack: 50, bonusIntelligence: 16, bonusHp: 30, price: 0, isShopItem: false, description: "Посох призрака жреца." },
    { name: "Пламя дракона", slot: "weapon", armorType: "weapon", requiredLevel: 44, requiredClass: "warrior", bonusAttack: 75, bonusStrength: 14, bonusVitality: 8, price: 0, isShopItem: false, description: "Оружие с дыханием дракона." },
    { name: "Эфирный клинок", slot: "weapon", armorType: "weapon", requiredLevel: 46, bonusAttack: 75, bonusAgility: 14, price: 0, isShopItem: false, description: "Клинок эфирного стража." },
    { name: "Вихревая сфера", slot: "accessory", armorType: "cloth", requiredLevel: 47, requiredClass: "mage", bonusIntelligence: 20, bonusAttack: 15, price: 0, isShopItem: false, description: "Сфера чистого хаоса." },
    { name: "Звездная пыль", slot: "accessory", armorType: "cloth", requiredLevel: 48, bonusStrength: 3, bonusAgility: 3, bonusIntelligence: 3, bonusVitality: 3, price: 0, isShopItem: false, description: "Пыль угасших звёзд." },
    { name: "Титановый кулак", slot: "weapon", armorType: "weapon", requiredLevel: 49, requiredClass: "warrior", bonusAttack: 100, bonusStrength: 20, bonusVitality: 12, price: 0, isShopItem: false, description: "Кулак эфирного титана." },
    { name: "Сердце бездны", slot: "accessory", armorType: "cloth", requiredLevel: 50, requiredClass: "assassin", bonusAttack: 35, bonusAgility: 20, price: 0, isShopItem: false, description: "Сердце повелителя бездны." },
  ]);

  // ─── 3. MONSTERS ────────────────────────────────────────────────────────
  await db.insert(monsters).values([
    { name: "🐗 Злобный кабан", locationId: 1, level: 1, baseHp: 40, baseAttack: 8, baseDefense: 3, xpReward: 10, goldRewardMin: 3, goldRewardMax: 8 },
    { name: "🕷️ Лесной паук", locationId: 1, level: 1, baseHp: 35, baseAttack: 10, baseDefense: 2, xpReward: 10, goldRewardMin: 3, goldRewardMax: 8 },
    { name: "🐺 Голодный волк", locationId: 1, level: 2, baseHp: 50, baseAttack: 12, baseDefense: 4, xpReward: 15, goldRewardMin: 4, goldRewardMax: 10 },
    { name: "🐭 Гигантская крыса", locationId: 1, level: 1, baseHp: 30, baseAttack: 7, baseDefense: 2, xpReward: 8, goldRewardMin: 2, goldRewardMax: 6 },
    { name: "🌿 Леший", locationId: 1, level: 3, baseHp: 60, baseAttack: 10, baseDefense: 6, xpReward: 20, goldRewardMin: 5, goldRewardMax: 12 },

    { name: "🐻 Бурый медведь", locationId: 2, level: 5, baseHp: 120, baseAttack: 22, baseDefense: 10, xpReward: 35, goldRewardMin: 10, goldRewardMax: 25 },
    { name: "🧛 Лесной вампир", locationId: 2, level: 6, baseHp: 100, baseAttack: 28, baseDefense: 8, xpReward: 40, goldRewardMin: 12, goldRewardMax: 28 },
    { name: "🌳 Корень-душитель", locationId: 2, level: 5, baseHp: 150, baseAttack: 18, baseDefense: 14, xpReward: 35, goldRewardMin: 10, goldRewardMax: 25 },
    { name: "🦌 Тёмный олень", locationId: 2, level: 6, baseHp: 110, baseAttack: 25, baseDefense: 11, xpReward: 40, goldRewardMin: 12, goldRewardMax: 28 },
    { name: "🐗 Лесной тролль", locationId: 2, level: 7, baseHp: 180, baseAttack: 20, baseDefense: 16, xpReward: 50, goldRewardMin: 15, goldRewardMax: 35 },

    { name: "🐊 Болотный крокодил", locationId: 3, level: 10, baseHp: 200, baseAttack: 35, baseDefense: 18, xpReward: 65, goldRewardMin: 20, goldRewardMax: 45 },
    { name: "🐸 Ядовитая жаба", locationId: 3, level: 10, baseHp: 150, baseAttack: 40, baseDefense: 12, xpReward: 65, goldRewardMin: 20, goldRewardMax: 45 },
    { name: "🌿 Болотный элементаль", locationId: 3, level: 11, baseHp: 180, baseAttack: 38, baseDefense: 20, xpReward: 75, goldRewardMin: 22, goldRewardMax: 50 },
    { name: "🦟 Рой москитов", locationId: 3, level: 10, baseHp: 120, baseAttack: 45, baseDefense: 8, xpReward: 60, goldRewardMin: 18, goldRewardMax: 40 },
    { name: "🐍 Болотная змея", locationId: 3, level: 12, baseHp: 170, baseAttack: 42, baseDefense: 15, xpReward: 80, goldRewardMin: 25, goldRewardMax: 55 },
    { name: "🕷️ Топяной паук", locationId: 3, level: 12, baseHp: 160, baseAttack: 44, baseDefense: 16, xpReward: 80, goldRewardMin: 25, goldRewardMax: 55 },

    { name: "🪨 Каменный голем", locationId: 4, level: 15, baseHp: 350, baseAttack: 45, baseDefense: 35, xpReward: 110, goldRewardMin: 35, goldRewardMax: 70 },
    { name: "🏔️ Горный тролль", locationId: 4, level: 16, baseHp: 300, baseAttack: 52, baseDefense: 28, xpReward: 120, goldRewardMin: 38, goldRewardMax: 75 },
    { name: "🦅 Гигантский орёл", locationId: 4, level: 15, baseHp: 220, baseAttack: 55, baseDefense: 20, xpReward: 110, goldRewardMin: 35, goldRewardMax: 70 },
    { name: "🪨 Кристальный паук", locationId: 4, level: 16, baseHp: 250, baseAttack: 50, baseDefense: 30, xpReward: 120, goldRewardMin: 38, goldRewardMax: 75 },
    { name: "🐉 Каменный дракончик", locationId: 4, level: 17, baseHp: 400, baseAttack: 48, baseDefense: 38, xpReward: 135, goldRewardMin: 42, goldRewardMax: 85 },

    { name: "💀 Скелет-воин", locationId: 5, level: 20, baseHp: 350, baseAttack: 60, baseDefense: 30, xpReward: 160, goldRewardMin: 50, goldRewardMax: 100 },
    { name: "👻 Призрачный маг", locationId: 5, level: 21, baseHp: 280, baseAttack: 72, baseDefense: 22, xpReward: 175, goldRewardMin: 55, goldRewardMax: 110 },
    { name: "🏛️ Проклятый рыцарь", locationId: 5, level: 22, baseHp: 450, baseAttack: 65, baseDefense: 40, xpReward: 190, goldRewardMin: 60, goldRewardMax: 120 },
    { name: "🕷️ Паук-мутант", locationId: 5, level: 20, baseHp: 300, baseAttack: 68, baseDefense: 25, xpReward: 160, goldRewardMin: 50, goldRewardMax: 100 },
    { name: "⚱️ Лич", locationId: 5, level: 23, baseHp: 400, baseAttack: 75, baseDefense: 35, xpReward: 210, goldRewardMin: 65, goldRewardMax: 130 },

    { name: "❄️ Ледяной волк", locationId: 6, level: 25, baseHp: 450, baseAttack: 78, baseDefense: 38, xpReward: 230, goldRewardMin: 70, goldRewardMax: 140 },
    { name: "🧊 Снежный элементаль", locationId: 6, level: 26, baseHp: 500, baseAttack: 75, baseDefense: 45, xpReward: 250, goldRewardMin: 75, goldRewardMax: 150 },
    { name: "🐻‍❄️ Белый медведь", locationId: 6, level: 26, baseHp: 550, baseAttack: 82, baseDefense: 40, xpReward: 250, goldRewardMin: 75, goldRewardMax: 150 },
    { name: "🗡️ Ледяной воин", locationId: 6, level: 27, baseHp: 480, baseAttack: 88, baseDefense: 42, xpReward: 270, goldRewardMin: 80, goldRewardMax: 160 },
    { name: "🐉 Снежный дракон", locationId: 6, level: 28, baseHp: 700, baseAttack: 85, baseDefense: 50, xpReward: 290, goldRewardMin: 85, goldRewardMax: 170 },

    { name: "🔥 Огненный элементаль", locationId: 7, level: 30, baseHp: 550, baseAttack: 95, baseDefense: 40, xpReward: 320, goldRewardMin: 95, goldRewardMax: 190 },
    { name: "🪨 Лавовый голем", locationId: 7, level: 31, baseHp: 700, baseAttack: 90, baseDefense: 55, xpReward: 340, goldRewardMin: 100, goldRewardMax: 200 },
    { name: "😈 Огненный демон", locationId: 7, level: 32, baseHp: 600, baseAttack: 105, baseDefense: 45, xpReward: 360, goldRewardMin: 105, goldRewardMax: 210 },
    { name: "🦎 Саламандра", locationId: 7, level: 31, baseHp: 500, baseAttack: 100, baseDefense: 38, xpReward: 340, goldRewardMin: 100, goldRewardMax: 200 },
    { name: "🔮 Вулканический маг", locationId: 7, level: 33, baseHp: 520, baseAttack: 112, baseDefense: 42, xpReward: 380, goldRewardMin: 110, goldRewardMax: 220 },

    { name: "👻 Призрак рыцаря", locationId: 8, level: 35, baseHp: 650, baseAttack: 110, baseDefense: 48, xpReward: 420, goldRewardMin: 125, goldRewardMax: 250 },
    { name: "🌫️ Теневой убийца", locationId: 8, level: 36, baseHp: 500, baseAttack: 125, baseDefense: 35, xpReward: 440, goldRewardMin: 130, goldRewardMax: 260 },
    { name: "💀 Проклятый паладин", locationId: 8, level: 37, baseHp: 800, baseAttack: 115, baseDefense: 55, xpReward: 460, goldRewardMin: 135, goldRewardMax: 270 },
    { name: "🦉 Призрачная сова", locationId: 8, level: 35, baseHp: 450, baseAttack: 120, baseDefense: 32, xpReward: 420, goldRewardMin: 125, goldRewardMax: 250 },
    { name: "⚔️ Тёмный генерал", locationId: 8, level: 38, baseHp: 900, baseAttack: 120, baseDefense: 58, xpReward: 490, goldRewardMin: 140, goldRewardMax: 280 },

    { name: "🗿 Храмовый страж", locationId: 9, level: 40, baseHp: 900, baseAttack: 130, baseDefense: 55, xpReward: 520, goldRewardMin: 160, goldRewardMax: 320 },
    { name: "🔮 Магический голем", locationId: 9, level: 41, baseHp: 800, baseAttack: 140, baseDefense: 60, xpReward: 550, goldRewardMin: 165, goldRewardMax: 330 },
    { name: "🐍 Древняя змея", locationId: 9, level: 42, baseHp: 750, baseAttack: 150, baseDefense: 48, xpReward: 580, goldRewardMin: 175, goldRewardMax: 350 },
    { name: "👤 Призрак жреца", locationId: 9, level: 41, baseHp: 650, baseAttack: 145, baseDefense: 42, xpReward: 550, goldRewardMin: 165, goldRewardMax: 330 },
    { name: "🐉 Дракон храма", locationId: 9, level: 43, baseHp: 1200, baseAttack: 140, baseDefense: 65, xpReward: 620, goldRewardMin: 185, goldRewardMax: 370 },

    { name: "✨ Эфирный страж", locationId: 10, level: 45, baseHp: 1100, baseAttack: 155, baseDefense: 58, xpReward: 680, goldRewardMin: 210, goldRewardMax: 420 },
    { name: "🌀 Энергетический вихрь", locationId: 10, level: 46, baseHp: 900, baseAttack: 170, baseDefense: 45, xpReward: 710, goldRewardMin: 220, goldRewardMax: 440 },
    { name: "🌟 Кристальный дракон", locationId: 10, level: 47, baseHp: 1400, baseAttack: 160, baseDefense: 70, xpReward: 750, goldRewardMin: 230, goldRewardMax: 460 },
    { name: "🌌 Эфирный титан", locationId: 10, level: 48, baseHp: 1600, baseAttack: 165, baseDefense: 75, xpReward: 790, goldRewardMin: 240, goldRewardMax: 480 },
    { name: "⚡ Повелитель бездны", locationId: 10, level: 49, baseHp: 1800, baseAttack: 175, baseDefense: 72, xpReward: 840, goldRewardMin: 250, goldRewardMax: 500 },
    { name: "👑 Астральный бог", locationId: 10, level: 50, baseHp: 2000, baseAttack: 185, baseDefense: 80, xpReward: 900, goldRewardMin: 260, goldRewardMax: 520 },
  ]);

  // ─── 4. NPCS ───────────────────────────────────────────────────────────
  await db.insert(npcs).values([
    { name: "Старый Эдвин", title: "Наставник новичков", locationId: 1, greeting: "А новый герой! В лесах опасно но с моими советами ты справишься. Начни с охоты на кабанов.", advice: "Не забывай распределять очки после повышения уровня! И всегда блокируй зону по которой монстр бьёт.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Сестра Милосердия", title: "Целительница", locationId: 1, greeting: "Раны беспокоят? Я помогу тебе восстановить силы. Лечение недорогое — всего 2 монеты за единицу здоровья.", advice: "Возвращайся ко мне когда нужна подзарядка! Я всегда в Начальной поляне.", npcType: "healer", healCostPerHp: 2 },
    { name: "Моргана", title: "Хранительница леса", locationId: 2, greeting: "Тёмный лес полон опасностей путник. Ты силён но будь осторожен.", advice: "Когда идёшь в лес защищай грудь и голову — твари бьют сверху.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Лесной Доктор", title: "Травник", locationId: 2, greeting: "В лесу много ядовитых тварей. Позволь обработать твои раны за 3 монеты за единицу.", advice: "Собирай травы когда охотишься — они помогут быстрее восстановиться.", npcType: "healer", healCostPerHp: 3 },
    { name: "Грязный Гарри", title: "Проводник топи", locationId: 3, greeting: "Ещё один смельчак решил пройти через топи? Не суйся в воду без защиты.", advice: "На болотах главное — ноги. Твари ползают и кусают снизу.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Болотная Знахарка", title: "Шаманка", locationId: 3, greeting: "Топи высасывают жизнь. Мои зелья поставят тебя на ноги за 4 монеты за единицу.", advice: "Остерегайся болотной лихорадки — сразу лечись после боёв в топи.", npcType: "healer", healCostPerHp: 4 },
    { name: "Каменный Джек", title: "Шахтёр-ветеран", locationId: 4, greeting: "Неплохо ты добрался вояка. На плато ветер сильный смотри под ноги!", advice: "Големы медленные — уворачивайся. Их слабость в ногах.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Эльда", title: "Мастер квестов", locationId: 2, greeting: "Ищешь достойное испытание? Убей 5 лесных троллей — я щедро награжу!", advice: "Тролли сильны в лобовой атаке — бей с фланга.", npcType: "quest_giver", healCostPerHp: 0 },
    { name: "Лира", title: "Дух руин", locationId: 5, greeting: "Ты чувствуешь магию? Руины хранят знания и чудовищ.", advice: "Нежить боится атак в голову — без неё они теряются.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Белый Клык", title: "Вожак клана", locationId: 6, greeting: "Мало кто забирается так высоко. Лёд не прощает ошибок.", advice: "В холода блокируй грудь и живот — холодные твари бьют в центр.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Пламенный Кузнец", title: "Мастер огня", locationId: 7, greeting: "Жарко тут? Ха! Если выживешь расскажу о легендарном оружии.", advice: "Демоны атакуют пояс — прикрой его в первую очередь.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Туманный Странник", title: "Проводник душ", locationId: 8, greeting: "Туман густой как кисель... Я брожу тут века.", advice: "В ущелье блокируй ноги. Призраки любят атаковать снизу.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Хранитель Тайн", title: "Библиотекарь", locationId: 9, greeting: "Ты дошёл до храма. Мало кому это удаётся.", advice: "Стражи бьют в голову и ноги — выбери зону и держись её.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Эфириус", title: "Сущность", locationId: 10, greeting: "Ты достиг границы миров. Докажи что достоин.", advice: "В эфире нет правил. Читай атаки врага и адаптируйся.", npcType: "advisor", healCostPerHp: 0 },
    { name: "Сержант Кейн", title: "Квестмейстер", locationId: 5, greeting: "Проклятые руины кишат нежитью. Очисти их от скверны!", advice: "Скелеты слабы к дробящим атакам — используй это.", npcType: "quest_giver", healCostPerHp: 0 },
    { name: "Ледяная Мари", title: "Целительница Севера", locationId: 6, greeting: "Обморожение и раны — моя специальность. 6 монет за единицу.", advice: "В холодной местности трать больше энергии на блок — замёрзшие мышцы медленнее.", npcType: "healer", healCostPerHp: 6 },
    { name: "Полковник Вульф", title: "Охотник на демонов", locationId: 7, greeting: "Вулканические твари опаснее всего. Докажи что ты охотник!", advice: "Огонь обжигает — держи дистанцию.", npcType: "quest_giver", healCostPerHp: 0 },
  ]);

  // ─── 5. MONSTER DROPS (match by monster name and item name) ──────────
  const allMonsters = await db.query.monsters.findMany();
  const allItems = await db.query.equipmentItems.findMany({ where: (eqi, { eq: op }) => op(eqi.isShopItem, false) });

  type ByName<T> = Record<string, T>;
  const mobByName: ByName<typeof allMonsters[number]> = {};
  const itemByName: ByName<typeof allItems[number]> = {};
  for (const m of allMonsters) mobByName[m.name] = m;
  for (const i of allItems) itemByName[i.name] = i;

  const dropPairs: { mobName: string; itemName: string; chance: string }[] = [
    { mobName: "🐗 Злобный кабан", itemName: "Клык кабана", chance: "5.0" },
    { mobName: "🕷️ Лесной паук", itemName: "Паучья нить", chance: "5.0" },
    { mobName: "🐺 Голодный волк", itemName: "Волчья шкура", chance: "4.0" },
    { mobName: "🐭 Гигантская крыса", itemName: "Крысиный хвост", chance: "5.0" },
    { mobName: "🌿 Леший", itemName: "Ветка лешего", chance: "4.0" },
    { mobName: "🐻 Бурый медведь", itemName: "Медвежья шкура", chance: "4.0" },
    { mobName: "🧛 Лесной вампир", itemName: "Клык вампира", chance: "5.0" },
    { mobName: "🌳 Корень-душитель", itemName: "Древесная кора", chance: "4.0" },
    { mobName: "🦌 Тёмный олень", itemName: "Олений рог", chance: "5.0" },
    { mobName: "🐗 Лесной тролль", itemName: "Дубина тролля", chance: "5.0" },
    { mobName: "🐊 Болотный крокодил", itemName: "Чешуя крокодила", chance: "4.0" },
    { mobName: "🐸 Ядовитая жаба", itemName: "Ядовитая железа", chance: "5.0" },
    { mobName: "🌿 Болотный элементаль", itemName: "Грязевая сфера", chance: "5.0" },
    { mobName: "🦟 Рой москитов", itemName: "Крыло москита", chance: "5.0" },
    { mobName: "🐍 Болотная змея", itemName: "Змеиный клык", chance: "4.0" },
    { mobName: "🕷️ Топяной паук", itemName: "Топяное жало", chance: "5.0" },
    { mobName: "🪨 Каменный голем", itemName: "Каменное сердце", chance: "5.0" },
    { mobName: "🏔️ Горный тролль", itemName: "Острый осколок", chance: "4.0" },
    { mobName: "🦅 Гигантский орёл", itemName: "Перо орла", chance: "5.0" },
    { mobName: "🪨 Кристальный паук", itemName: "Кристаллический глаз", chance: "5.0" },
    { mobName: "🐉 Каменный дракончик", itemName: "Осколок руды", chance: "3.0" },
    { mobName: "💀 Скелет-воин", itemName: "Кость скелета", chance: "5.0" },
    { mobName: "👻 Призрачный маг", itemName: "Эфирная сфера", chance: "5.0" },
    { mobName: "🏛️ Проклятый рыцарь", itemName: "Проклятый доспех", chance: "4.0" },
    { mobName: "🕷️ Паук-мутант", itemName: "Мутировавшая лапка", chance: "5.0" },
    { mobName: "⚱️ Лич", itemName: "Фолиант лича", chance: "5.0" },
    { mobName: "❄️ Ледяной волк", itemName: "Ледяной клык", chance: "4.0" },
    { mobName: "🧊 Снежный элементаль", itemName: "Снежная корона", chance: "4.0" },
    { mobName: "🐻‍❄️ Белый медведь", itemName: "Когти медведя", chance: "5.0" },
    { mobName: "🗡️ Ледяной воин", itemName: "Ледовый щит", chance: "4.0" },
    { mobName: "🐉 Снежный дракон", itemName: "Чешуя дракона", chance: "3.0" },
    { mobName: "🔥 Огненный элементаль", itemName: "Искра огня", chance: "5.0" },
    { mobName: "🪨 Лавовый голем", itemName: "Лавовый клинок", chance: "4.0" },
    { mobName: "😈 Огненный демон", itemName: "Рога демона", chance: "4.0" },
    { mobName: "🦎 Саламандра", itemName: "Огненный язык", chance: "5.0" },
    { mobName: "🔮 Вулканический маг", itemName: "Вулканический жезл", chance: "5.0" },
    { mobName: "👻 Призрак рыцаря", itemName: "Призрачная ткань", chance: "4.0" },
    { mobName: "🌫️ Теневой убийца", itemName: "Теневой кинжал", chance: "5.0" },
    { mobName: "💀 Проклятый паладин", itemName: "Проклятый меч", chance: "5.0" },
    { mobName: "🦉 Призрачная сова", itemName: "Перо тьмы", chance: "5.0" },
    { mobName: "⚔️ Тёмный генерал", itemName: "Эхо битвы", chance: "4.0" },
    { mobName: "🗿 Храмовый страж", itemName: "Древний амулет", chance: "4.0" },
    { mobName: "🔮 Магический голем", itemName: "Магический кристалл", chance: "5.0" },
    { mobName: "🐍 Древняя змея", itemName: "Кожа змеи", chance: "4.0" },
    { mobName: "👤 Призрак жреца", itemName: "Посох жреца", chance: "5.0" },
    { mobName: "🐉 Дракон храма", itemName: "Пламя дракона", chance: "3.0" },
    { mobName: "✨ Эфирный страж", itemName: "Эфирный клинок", chance: "4.0" },
    { mobName: "🌀 Энергетический вихрь", itemName: "Вихревая сфера", chance: "4.0" },
    { mobName: "🌟 Кристальный дракон", itemName: "Звездная пыль", chance: "3.0" },
    { mobName: "🌌 Эфирный титан", itemName: "Титановый кулак", chance: "3.0" },
    { mobName: "⚡ Повелитель бездны", itemName: "Сердце бездны", chance: "4.0" },
  ];

  const dropValues: { monsterId: number; itemId: number; dropChance: string }[] = [];
  for (const pair of dropPairs) {
    const mob = mobByName[pair.mobName];
    const item = itemByName[pair.itemName];
    if (mob && item) {
      dropValues.push({ monsterId: mob.id, itemId: item.id, dropChance: pair.chance });
    } else {
      logger.warn({ mobName: pair.mobName, itemName: pair.itemName }, "Drop pair not found");
    }
  }

  if (dropValues.length > 0) {
    await db.insert(monsterDrops).values(dropValues);
  }

  logger.info({ drops: dropValues.length }, "Game data seeded");
}

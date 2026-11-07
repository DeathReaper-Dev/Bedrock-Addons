import { world, system, ItemStack, EnchantmentType } from "@minecraft/server";

// ------------------ НАСТРОЙКИ ------------------
const CONFIG = {
  MAX_ENCHANTS: 4,
  MIN_ENCHANTS: 1,
  CHANCE_EXTRA: 0.55,
  CHAT_MESSAGES: true,
  SHOW_ONLY_RARE: true,
  TICK_INTERVAL: 20,
  WELCOME: true
};

// Зачарование -> максимальный валидный уровень в Bedrock
const ENCHANTMENTS = {
  protection: 4, fire_protection: 4, feather_falling: 4, blast_protection: 4,
  projectile_protection: 4, thorns: 3, respiration: 3, aqua_affinity: 1,
  sharpness: 5, smite: 5, bane_of_arthropods: 5, knockback: 2, fire_aspect: 2,
  looting: 3, efficiency: 5, silk_touch: 1, unbreaking: 3, fortune: 3,
  power: 5, punch: 2, flame: 1, infinity: 1, luck_of_the_sea: 3, lure: 3,
  depth_strider: 3, frost_walker: 2, loyalty: 3, impaling: 5, riptide: 3,
  channeling: 1, multishot: 1, piercing: 4, quick_charge: 3, mending: 1,
  soul_speed: 3, swift_sneak: 3
};

const NAMES = [...Object.keys(ENCHANTMENTS)];

// Что не трогаем: книги и стойки для брони
const BLOCKLIST = new Set(["minecraft:enchanted_book", "minecraft:armor_stand"]);

const RARITY_MESSAGES = {
  4: "§d§lINCREDIBLE! Four enchantments at once!",
  3: "§b§lINSANE! Three enchantments loaded!",
  2: "§aAwesome! Two enchantments!",
  1: "§eItem enchanted!"
};

// ------------------ УТИЛИТЫ ------------------
const rnd = (n) => Math.floor(Math.random() * n);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollCount() {
  let count = CONFIG.MIN_ENCHANTS;
  while (count < CONFIG.MAX_ENCHANTS && Math.random() < CONFIG.CHANCE_EXTRA) count++;
  return count;
}

// Ключ «уже обработано»: предмет + его текущие чары.
// Меняется только когда предмет реально изменился, а не когда поменялся amount.
function itemKey(item) {
  const ench = safeEnchants(item);
  const sig = ench.map((e) => `${e.type.id}:${e.level}`).sort().join(",");
  return `${item.typeId}|${sig}`;
}

function safeEnchants(item) {
  try {
    const comp = item.getComponent("minecraft:enchantable");
    if (!comp) return [];
    return comp.getEnchantments() ?? [];
  } catch {
    return [];
  }
}

// ------------------ ЛОГИКА ------------------
function enchantItem(item) {
  const comp = item.getComponent("minecraft:enchantable");
  if (!comp) return 0;

  let current;
  try {
    current = comp.getEnchantments() ?? [];
  } catch {
    return 0;
  }
  if (current.length >= CONFIG.MAX_ENCHANTS) return 0;

  const have = new Set(current.map((e) => e.type.id));
  const howMany = Math.min(rollCount(), CONFIG.MAX_ENCHANTS - current.length);
  let added = 0;

  for (const name of shuffle(NAMES)) {
    if (added >= howMany) break;
    if (have.has(name)) continue;

    const maxLevel = ENCHANTMENTS[name];
    const level = 1 + rnd(maxLevel); // никогда не превышаем лимит типа

    try {
      comp.addEnchantment({ type: new EnchantmentType(name), level });
      have.add(name);
      added++;
    } catch {
      // несовместимо с предметом (например, Sharpness на шлеме) — пробуем следующее
    }
  }
  return added;
}

function enchantContainer(player, processed) {
  const inv = player.getComponent("minecraft:inventory");
  const container = inv?.container;
  if (!container) return;

  let best = { name: null, count: 0 };

  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item || BLOCKLIST.has(item.typeId)) continue;
    if (safeEnchants(item).length >= CONFIG.MAX_ENCHANTS) continue;

    const key = itemKey(item);
    if (processed.has(key)) continue;

    let added = 0;
    try {
      added = enchantItem(item); // мутируем копию
    } catch {
      continue;
    }

    if (added > 0) {
      try {
        container.setItem(slot, item); // обязательно: иначе чары потеряются
      } catch {
        continue; // запись не удалась — НЕ помечаем как обработанное
      }
    }

    processed.add(itemKey(item)); // ключ уже с новыми чарами

    const total = safeEnchants(item).length;
    if (total > best.count) {
      best = { name: item.nameTag ?? item.typeId.replace("minecraft:", ""), count: total };
    }
  }

  if (!CONFIG.CHAT_MESSAGES || best.count === 0) return;
  const need = CONFIG.SHOW_ONLY_RARE ? 3 : 1;
  if (best.count < need) return;

  const msg = RARITY_MESSAGES[Math.min(best.count, 4)] ?? RARITY_MESSAGES[1];
    try {
      player.onScreenDisplay.setActionBar(`§f${best.name} §7— ${best.count} enchants`);
      player.sendMessage(`${msg} §7${best.name} §8(${best.count})`);
      player.playSound("random.orb", { location: player.location });
    } catch {}
}

// Главный цикл. Set ограничен: чистим его, чтобы не рос бесконечно.
let processed = new Set();

system.runInterval(() => {
  if (processed.size > 4000) processed = new Set();
  for (const player of world.getAllPlayers()) {
    try {
      enchantContainer(player, processed);
    } catch {}
  }
}, CONFIG.TICK_INTERVAL);

// Приветствие только на первом входе
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn || !CONFIG.WELCOME) return;
  const player = event.player;
  system.runTimeout(() => {
    try {
      enchantContainer(player, processed);
    } catch {}
  }, 40);

  try {
    player.sendMessage(
      "§d§lInventory Magic §r§7is enabled! Every enchantable item " +
        "entering your inventory will receive up to §d4§7 random enchantments."
    );
  } catch {}

});

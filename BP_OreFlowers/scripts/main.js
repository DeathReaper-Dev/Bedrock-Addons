import { world, system, ItemStack } from "@minecraft/server";

/* ------------------------------------------------------------------
 * Конфиг цветов.
 * particle — валидные ID частиц Bedrock (проверено по vanilla).
 * drop     — ID предмета, который выпадает.
 * ------------------------------------------------------------------ */
const ORE_FLOWERS = {
    "axiom:coal_flower":      { particle: "minecraft:basic_smoke_particle",         drop: "minecraft:coal" },
    "axiom:copper_flower":    { particle: "minecraft:basic_crit_particle",          drop: "minecraft:raw_copper" },
    "axiom:iron_flower":      { particle: "minecraft:crit_particle",                drop: "minecraft:raw_iron" },
    "axiom:gold_flower":      { particle: "minecraft:totem_particle",               drop: "minecraft:raw_gold" },
    "axiom:lapis_flower":     { particle: "minecraft:conduit_particle",             drop: "minecraft:lapis_lazuli" },
    "axiom:redstone_flower":  { particle: "minecraft:redstone_wire_dust_particle",  drop: "minecraft:redstone" },
    "axiom:diamond_flower":   { particle: "minecraft:basic_flame_particle",         drop: "minecraft:diamond" },
    "axiom:emerald_flower":   { particle: "minecraft:villager_happy",               drop: "minecraft:emerald" },
    "axiom:amethyst_flower":  { particle: "minecraft:snowflake_particle",           drop: "minecraft:amethyst_shard" },
    "axiom:netherite_flower": { particle: "minecraft:lava_particle",                drop: "minecraft:netherite_scrap" }
};

const ORE_FLOWER_IDS = Object.keys(ORE_FLOWERS);

const SCAN_RADIUS    = 12;     // радиус скана (в блоках)
const SCAN_Y_UP      = 4;      // насколько вверх смотрим
const SCAN_Y_DOWN    = 4;      // насколько вниз смотрим
const SPACING        = 1;      // Проверяем КАЖДЫЙ блок без пропусков сетки
const PARTICLE_TICKS = 3;      // Частицы каждые 3 секунды
const DROP_TICKS     = 10;     // Дроп руды каждые 10 секунд
const DROP_CHANCE    = 0.5;
const CACHE_MAX_AGE  = 5;      // Пересканируем цветы вокруг игрока каждые 5 секунд!
  // после 30 с скан пересобирается
const MAX_DROPS_PER_CYCLE = 24;

const cache = new Map();       // playerId -> { tick, list: [{x,y,z,data}] }
let tick = 0;

/** Безопасное чтение блока: в незагруженном чанке getBlock бросает. */
function safeGetBlock(dim, x, y, z) {
    try {
        return dim.getBlock({ x, y, z });
    } catch {
        return undefined; // незагруженный чанк / за пределами мира
    }
}

/** Воздух ли блок. cave_air и void_air тоже считаются воздухом. */
function isAirBlock(block) {
    if (!block) return false;
    return block.isAir === true
        || block.typeId === "minecraft:air"
        || block.typeId === "minecraft:cave_air"
        || block.typeId === "minecraft:void_air";
}

/**
 * Сканирует окрестность игрока.
 * [P1] Сетка прорежена: цветы стоят в любых координатах,
 * но нам не нужен каждый блок — берём каждые SPACING по X/Z,
 * а по Y идём плотно (высота цветка = 1 блок).
 * [P2] Ранний выход: если блок — не наш цветок, ничего не делаем.
 */
function scanAround(player) {
    const dim = player.dimension;
    const loc = player.location;
    const px = Math.floor(loc.x);
    const py = Math.floor(loc.y);
    const pz = Math.floor(loc.z);

    const found = [];

    for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx += SPACING) {
        const x = px + dx;
        for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz += SPACING) {
            const z = pz + dz;
            for (let dy = -SCAN_Y_DOWN; dy <= SCAN_Y_UP; dy++) {
                const y = py + dy;
                // Быстрая проверка по дистанции (шар, а не куб)
                if (dx * dx + dz * dz > SCAN_RADIUS * SCAN_RADIUS) continue;

                const block = safeGetBlock(dim, x, y, z);
                if (!block) continue;

                const data = ORE_FLOWERS[block.typeId];
                if (!data) continue;

                found.push({ x, y, z, data });
            }
        }
    }
    return found;
}

/**
 * [P3] Над цветком должен быть воздух ЛЮБОГО типа,
 * иначе дроп появится внутри твёрдого блока и пропадёт.
 */
function isOpenSpace(dim, x, y, z) {
    const above = safeGetBlock(dim, x, y + 1, z);
    return isAirBlock(above);
}

/** Есть ли игрок в радиусе "прогрузки" (защита от спавна в пустоте). */
function isValidPlayer(player) {
    try {
        return player && player.isValid !== false && !!player.location;
    } catch {
        return false;
    }
}

let dropBudget = 0;

system.runInterval(() => {
    tick++;

    const doParticles = tick % PARTICLE_TICKS === 0;
    const doDrop      = tick % DROP_TICKS === 0;
    if (!doParticles && !doDrop) return;

    // Лимит дропа за цикл — чтобы не выронить 2000 предметов разом
    dropBudget = doDrop ? MAX_DROPS_PER_CYCLE : 0;

    for (const player of world.getPlayers()) {
        if (!isValidPlayer(player)) continue;

        let entry = cache.get(player.id);

        // [P4] Кэш протухает по возрасту, но НЕ раньше, чем пришло время
        if (!entry || tick - entry.tick > CACHE_MAX_AGE || entry.dimId !== player.dimension.id) {
            const list = scanAround(player);
            entry = { tick, list, dimId: player.dimension.id };
            cache.set(player.id, entry);
        }

        const dim = player.dimension;

        for (const { x, y, z, data } of entry.list) {
            if (doParticles) {
                try {
                    // Перепроверяем: блок мог быть сломан после скана
                    const b = safeGetBlock(dim, x, y, z);
                    if (b && ORE_FLOWERS[b.typeId]) {
                        dim.spawnParticle(data.particle, { x: x + 0.5, y: y + 0.8, z: z + 0.5 });
                    }
                } catch (e) {
                    // Частица недоступна в этой точке — не роняем интервал
                    console.warn(`[OreFlowers] particle ${data.particle}: ${e}`);
                }
            }

            if (doDrop && dropBudget > 0
                && Math.random() < DROP_CHANCE
                && isOpenSpace(dim, x, y, z)) {
                try {
                    const b = safeGetBlock(dim, x, y, z);
                    if (!b || !ORE_FLOWERS[b.typeId]) continue;

                    const stack = new ItemStack(data.drop, 1);
                    dim.spawnItem(stack, { x: x + 0.5, y: y + 1.2, z: z + 0.5 });
                    dropBudget--;
                } catch (e) {
                    console.warn(`[OreFlowers] drop ${data.drop}: ${e}`);
                }
            }
        }
    }
}, 20);

// Очистка кэша
world.afterEvents.playerLeave.subscribe(({ playerId }) => cache.delete(playerId));

// Подстраховка: если кэш разросся (перезаходы, реконнекты)
system.runInterval(() => {
    if (cache.size > 64) {
        const alive = new Set(world.getPlayers().map(p => p.id));
        for (const id of cache.keys()) if (!alive.has(id)) cache.delete(id);
    }
}, 600);

// Диагностика в лог при старте
console.info(`[OreFlowers] loaded, ${ORE_FLOWER_IDS.length} flower types registered.`);

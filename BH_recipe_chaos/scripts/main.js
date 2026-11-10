import { world, system, ItemStack } from "@minecraft/server";

// Пул безумного рандомного лута (ванильные айдишники без кастомных текстур)
const RANDOM_POOL = [
    "minecraft:diamond_block",
    "minecraft:netherite_ingot",
    "minecraft:tnt",
    "minecraft:bedrock",
    "minecraft:enchanted_golden_apple",
    "minecraft:ender_eye",
    "minecraft:shulker_box",
    "minecraft:lava_bucket",
    "minecraft:totem_of_undying",
    "minecraft:diamond_sword",
    "minecraft:beacon",
    "minecraft:elytra",
    "minecraft:obsidian",
    "minecraft:sponge",
    "minecraft:dragon_egg",
    "minecraft:wither_skeleton_skull"
];

// Хранилище для отслеживания инвентаря: playerId -> массив предметов
const playerInventoryCache = new Map();

system.runInterval(() => {
    const players = world.getAllPlayers();

    for (const player of players) {
        if (!player.isValid) continue;

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) continue;

        const currentItems = [];
        let itemToSwap = null;
        let slotIndex = -1;

        // Сканируем слоты инвентаря
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) {
                currentItems.push(`${i}_${item.typeId}_${item.amount}`);
                
                // Если предмет новый и его не было в кэше — это результат крафта или подбора
                const cache = playerInventoryCache.get(player.id) ?? [];
                if (!cache.includes(`${i}_${item.typeId}_${item.amount}`) && !item.hasTag("swapped")) {
                    itemToSwap = item;
                    slotIndex = i;
                }
            }
        }

        // Если нашли предмет для 100% рандомизации
        if (itemToSwap && slotIndex !== -1) {
            const randomTypeId = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)];
            
            try {
                const newItem = new ItemStack(randomTypeId, itemToSwap.amount);
                newItem.keepOnDeath = itemToSwap.keepOnDeath;
                
                // Ставим скрытую метку, чтобы скрипт не зациклился на подмене
                newItem.addTag("swapped");

                // Подменяем предмет в слоте прямо на лету силами сервера
                inventory.setItem(slotIndex, newItem);
                
                // Эффект глитча вокруг игрока для сочности видео
                player.dimension.runCommandAsync(`particle minecraft:shulker_bullet ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
            } catch (e) {}
        }

        // Обновляем локальный кэш инвентаря игрока
        playerInventoryCache.set(player.id, currentItems);
    }
}, 5); // Проверка 4 раза в секунду (каждые 5 тиков) — моментальная реакция без просадки FPS

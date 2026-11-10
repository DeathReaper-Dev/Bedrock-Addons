import { world, system } from "@minecraft/server";

// Конфигурация абсолютного дисбаланса
const MAX_BLOCKS = 64; // Максимум блоков (1 стак) за один клик для защиты от краша FPS

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const player = event.player;
    const brokenBlock = event.brokenBlockPermutation; 
    const dimension = event.dimension;
    const startLocation = event.block.location;

    // Игнорируем игроков в креативе
    if (player.getGameMode() === "creative") return;

    const blockTypeId = brokenBlock.type.id;

    // Алгоритм BFS (поиск в ширину) для мгновенного сбора соседних блоков
    const queue = [startLocation];
    const visited = new Set();
    const blocksToBreak = [];

    while (queue.length > 0 && blocksToBreak.length < MAX_BLOCKS) {
        const current = queue.shift();
        const key = `${current.x},${current.y},${current.z}`;

        if (visited.has(key)) continue;
        visited.add(key);

        // Проверяем все 6 сторон вокруг текущего блока
        const directions = [
            { x: 0, y: 1, z: 0 },  // Вверх
            { x: 0, y: -1, z: 0 }, // Вниз
            { x: 1, y: 0, z: 0 },  // Вправо
            { x: -1, y: 0, z: 0 }, // Влево
            { x: 0, y: 0, z: 1 },  // Вперед
            { x: 0, y: 0, z: -1 }  // Назад
        ];

        for (const dir of directions) {
            const nextLoc = { x: current.x + dir.x, y: current.y + dir.y, z: current.z + dir.z };
            const nextKey = `${nextLoc.x},${nextLoc.y},${nextLoc.z}`;

            if (visited.has(nextKey)) continue;

            try {
                const checkBlock = dimension.getBlock(nextLoc);
                if (checkBlock && checkBlock.typeId === blockTypeId) {
                    blocksToBreak.push(nextLoc);
                    queue.push(nextLoc);
                }
            } catch (e) {
                // Мягкий пропуск, если чанк на границе прорисовки
            }
        }
    }

    // Если нашли цепную связь — ломаем её без потери прочности инструментов!
    if (blocksToBreak.length > 0) {
        system.run(() => {
            for (const loc of blocksToBreak) {
                try {
                    const block = dimension.getBlock(loc);
                    if (block && block.typeId === blockTypeId) {
                        // Ломаем силами сервера с выпадением ванильного лута
                        dimension.runCommandAsync(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`);
                    }
                } catch (e) {}
            }
        });
    }
});

import { world, system } from "@minecraft/server";

let currentAbyssY = -64;
let timerTicks = 0;
const TIME_INTERVAL = 40; // Бездна поднимается на 1 блок каждые 2 секунды (40 тиков)

let worldInitialized = false;
let barrierCenterX = 0;
let barrierCenterZ = 0;

const CHUNK_SIZE = 16;
const WORLD_CHUNKS = 4; // Арена 4х4 чанка
const BORDER_RADIUS = (WORLD_CHUNKS * CHUNK_SIZE) / 2;

let barrierCurrentY = -64;
let isGeneratingBarrier = false;

// ИСПРАВЛЕНО: Максимальная высота мира в Bedrock — 319
const MAX_WORLD_Y = 319;

function tickBarrierGeneration(dimension) {
    if (barrierCurrentY > MAX_WORLD_Y) {
        // Ставим крышу строго на Y = 319, где движок реально позволяет ставить блоки
        for (let x = -BORDER_RADIUS; x <= BORDER_RADIUS; x++) {
            for (let z = -BORDER_RADIUS; z <= BORDER_RADIUS; z++) {
                setBlockOverride(dimension, barrierCenterX + x, MAX_WORLD_Y, barrierCenterZ + z, "minecraft:barrier");
            }
        }
        
        isGeneratingBarrier = false;
        worldInitialized = true;
        world.sendMessage("§6§l[ABYSS] Arena is completely SEALED with a roof. Game started!");
        return;
    }

    const targetY = Math.min(barrierCurrentY + 15, MAX_WORLD_Y + 1);
    for (let y = barrierCurrentY; y < targetY; y++) {
        for (let i = -BORDER_RADIUS; i <= BORDER_RADIUS; i++) {
            setBlockOverride(dimension, barrierCenterX + i, y, barrierCenterZ - BORDER_RADIUS, "minecraft:barrier");
            setBlockOverride(dimension, barrierCenterX + i, y, barrierCenterZ + BORDER_RADIUS, "minecraft:barrier");
            setBlockOverride(dimension, barrierCenterX - BORDER_RADIUS, y, barrierCenterZ + i, "minecraft:barrier");
            setBlockOverride(dimension, barrierCenterX + BORDER_RADIUS, y, barrierCenterZ + i, "minecraft:barrier");
        }
    }
    barrierCurrentY = targetY;
}

function setupWorldBarrier() {
    if (worldInitialized || isGeneratingBarrier) return;
    
    const players = world.getPlayers();
    if (players.length === 0) return;
    
    const spawnPlayer = players[0];
    barrierCenterX = Math.floor(spawnPlayer.location.x);
    barrierCenterZ = Math.floor(spawnPlayer.location.z);
    
    isGeneratingBarrier = true;
}

function setBlockOverride(dimension, x, y, z, blockTypeId) {
    try {
        const block = dimension.getBlock({ x, y, z });
        if (block && block.typeId !== "minecraft:bedrock" && block.typeId !== blockTypeId) {
            block.setType(blockTypeId);
        }
    } catch(e) {}
}

system.runInterval(() => {
    const playersList = world.getPlayers();
    if (playersList.length === 0) return;

    timerTicks++;

    if (!worldInitialized && !isGeneratingBarrier && timerTicks % 20 === 0) {
        setupWorldBarrier();
    }

    if (isGeneratingBarrier) {
        tickBarrierGeneration(playersList[0].dimension);
    }

    // Урон для отставших игроков
    if (timerTicks % 10 === 0) {
        for (const player of playersList) {
            if (Math.floor(player.location.y) <= currentAbyssY && worldInitialized) {
                player.applyDamage(4, { cause: "void" });
            }
        }
    }

    // Стираем этаж арены строго ОДИН РАЗ за тик (убран лишний цикл по всем игрокам)
    if (timerTicks >= TIME_INTERVAL && worldInitialized) {
        timerTicks = 0;
        currentAbyssY++;

        // Останавливаем подъем бездны, когда она доходит до потолка
        if (currentAbyssY >= MAX_WORLD_Y) return;

        const dimension = playersList[0].dimension;
        
        // Стираем весь слой одним быстрым запросом через runCommandAsync — это гарантированно сносит воду, лаву и waterlogged блоки без лагов
        const x1 = barrierCenterX - BORDER_RADIUS + 1;
        const z1 = barrierCenterZ - BORDER_RADIUS + 1;
        const x2 = barrierCenterX + BORDER_RADIUS - 1;
        const z2 = barrierCenterZ + BORDER_RADIUS - 1;

        try {
            dimension.runCommandAsync(`fill ${x1} ${currentAbyssY} ${z1} ${x2} ${currentAbyssY} ${z2} air replace`);
        } catch (e) {
            // Запасной построчный метод, если чанк временно не прогружен
            for (let x = x1; x <= x2; x++) {
                for (let z = z1; z <= z2; z++) {
                    try {
                        const block = dimension.getBlock({ x, y: currentAbyssY, z });
                        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:barrier" && block.typeId !== "minecraft:bedrock") {
                            if (block.isWaterlogged) block.setWaterlogged(false);
                            block.setType("minecraft:air");
                        }
                    } catch (err) {}
                }
            }
        }
    }
}, 1);

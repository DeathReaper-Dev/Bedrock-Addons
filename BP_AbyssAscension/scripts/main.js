import { world, system } from "@minecraft/server";

let currentAbyssY = -64;
let timerTicks = 0;
const TIME_INTERVAL = 40; // Бездна поднимается на 1 block каждые 2 секунды (40 тиков)

let worldInitialized = false;
let barrierCenterX = 0;
let barrierCenterZ = 0;

const CHUNK_SIZE = 16;
const WORLD_CHUNKS = 4; // Арена 4х4 чанка
const BORDER_RADIUS = (WORLD_CHUNKS * CHUNK_SIZE) / 2;

let barrierCurrentY = -64;
let isGeneratingBarrier = false;

function tickBarrierGeneration(dimension) {
    if (barrierCurrentY > 320) {
        for (let x = -BORDER_RADIUS; x <= BORDER_RADIUS; x++) {
            for (let z = -BORDER_RADIUS; z <= BORDER_RADIUS; z++) {
                setBlockOverride(dimension, barrierCenterX + x, 320, barrierCenterZ + z, "minecraft:barrier");
            }
        }
        
        isGeneratingBarrier = false;
        worldInitialized = true;
        world.sendMessage("§6§l[ABYSS] Arena is completely SEALED with a roof. Game started!");
        return;
    }

    const targetY = Math.min(barrierCurrentY + 15, 321);
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

    // ЭКШЕН-БАР ПОЛНОСТЬЮ УДАЛЕН. Остался только урон для отставших игроков
    if (timerTicks % 10 === 0) {
        for (const player of playersList) {
            if (Math.floor(player.location.y) <= currentAbyssY && worldInitialized) {
                player.applyDamage(4, { cause: "void" });
            }
        }
    }

    if (timerTicks >= TIME_INTERVAL) {
        timerTicks = 0;
        currentAbyssY++;

        for (const player of playersList) {
            const dimension = player.dimension;
            
            for (let x = -BORDER_RADIUS + 1; x < BORDER_RADIUS; x++) {
                for (let z = -BORDER_RADIUS + 1; z < BORDER_RADIUS; z++) {
                    try {
                        const pos = { x: barrierCenterX + x, y: currentAbyssY, z: barrierCenterZ + z };
                        const block = dimension.getBlock(pos);
                        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:barrier" && block.typeId !== "minecraft:bedrock") {
                            block.setType("minecraft:air");
                        }
                    } catch (e) {}
                }
            }
        }
    }
}, 1);

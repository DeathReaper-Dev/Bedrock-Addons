import { world, system } from "@minecraft/server";

// Настройки баланса и оптимизации
const CONFIG = {
    radius: 2.5,          // Зона поражения 3х3 блока вокруг предмета
    baseDamage: 4,        // Базовый урон (2 сердца)
    perItemBonus: 1.0,    // Дополнительный урон за каждый предмет в стаке
    maxDamage: 30,        // Максимальный потолок урона (защита от гриферов)
    fuseTicks: 15,        // Задержка перед детонацией (0.75 сек) после падения на землю
    
    // Множители урона для конкретных опасных блоков
    multipliers: {
        "minecraft:tnt": 3.0,
        "minecraft:gunpowder": 1.5,
        "minecraft:fire_charge": 1.3,
        "minecraft:end_crystal": 4.0
    }
};

// Хранилище для активных фитилей: entityId -> tickДетонации
const pendingExplosions = new Map();

// Главный цикл сканирования
system.runInterval(() => {
    const now = system.currentTick;
    const players = world.getAllPlayers();
    
    for (const player of players) {
        if (!player.isValid) continue;
        const dimension = player.dimension;

        // ОПТИМИЗАЦИЯ: Ищем предметы строго в радиусе 20 блоков от реальных игроков
        const items = dimension.getEntities({
            location: player.location,
            maxDistance: 20,
            type: "minecraft:item"
        });

        for (const itemEntity of items) {
            if (!itemEntity.isValid) continue;
            
            const id = itemEntity.id;

            // Если предмет уже зажжен, проверяем время взрыва
            if (pendingExplosions.has(id)) {
                if (now >= pendingExplosions.get(id)) {
                    pendingExplosions.delete(id);
                    executeDropExplosion(itemEntity, dimension);
                }
                continue;
            }

            // Активируем фитиль только когда предмет приземлился на блоки
            if (itemEntity.isOnGround) {
                pendingExplosions.set(id, now + CONFIG.fuseTicks);
            }
        }
    }
}, 10); // Проверка 2 раза в секунду (каждые 10 тиков) — залог высокого FPS на мобилках

// Логика нанесения урона по области
function executeDropExplosion(itemEntity, dimension) {
    const location = itemEntity.location;
    const itemComp = itemEntity.getComponent("minecraft:item");
    if (!itemComp || !itemComp.itemStack) return;

    const stack = itemComp.itemStack;
    const typeId = stack.typeId;
    const count = stack.amount;

    // Расчет урона с учетом стака и множителей
    const multiplier = CONFIG.multipliers[typeId] ?? 1.0;
    const rawDamage = CONFIG.baseDamage + (count - 1) * CONFIG.perItemBonus;
    const finalDamage = Math.min(rawDamage * multiplier, CONFIG.maxDamage);

    // Ищем цели в зоне поражения
    const targets = dimension.getEntities({
        location: location,
        maxDistance: CONFIG.radius
    });

    // Извлекаем ID бросившего игрока из тегов сущности
    const tags = itemEntity.getTags();
    const ownerTag = tags.find(tag => tag.startsWith("dropped_by_"));
    const ownerId = ownerTag ? ownerTag.replace("dropped_by_", "") : null;

    for (const target of targets) {
        if (target.typeId === "minecraft:item" || !target.isValid) continue;

        // ЗАЩИТА ВЛАДЕЛЬЦА: Создатель броска полностью защищен от своего урона
        if (ownerId && target.id === ownerId) continue;

        try {
            target.applyDamage(finalDamage, { 
                cause: "contact", 
                damagingEntity: itemEntity 
            });
            
            // Сочный визуал взрыва на целях
            dimension.runCommandAsync(`particle minecraft:huge_explosion_emitter ${target.location.x} ${target.location.y} ${target.location.z}`);
        } catch (e) {}
    }

    // Удаляем предмет, который отработал как граната
    try { itemEntity.remove(); } catch (e) {}
}

// Отслеживание момента броска предмета игроком
world.afterEvents.playerDropItem.subscribe((event) => {
    const player = event.player;
    
    // Ждем 1 тик, чтобы сущность предмета физически создалась в мире
    system.runTimeout(() => {
        if (!player.isValid) return;
        
        const dropped = player.dimension.getEntities({
            location: player.location,
            maxDistance: 3,
            type: "minecraft:item"
        });
        
        for (const entity of dropped) {
            // Маркируем предмет уникальным тегом игрока, если его еще нет
            if (!entity.getTags().some(t => t.startsWith("dropped_by_"))) {
                entity.addTag(`dropped_by_${player.id}`);
            }
        }
    }, 1);
});

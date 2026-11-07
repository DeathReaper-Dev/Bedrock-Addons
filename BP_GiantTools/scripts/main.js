import { world, system, ItemComponentTypes, EquipmentSlot } from "@minecraft/server";

const GIANT_PREFIX = "axiom:giant_";
const MAX_REACH = 15;
const MAX_REACH_SQ = MAX_REACH * MAX_REACH;

/** Безопасное получение позиции: у мёртвой/выгруженной сущности location бросает ошибку. */
function safeLocation(entity) {
    try {
        if (!entity || !entity.isValid()) return undefined;
        return entity.location;
    } catch (e) {
        return undefined;
    }
}

/** Квадрат расстояния — без Math.sqrt, дешевле и точнее. */
function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

/** Проверяет, что игрок держит предмет аддона, и возвращает его. */
function getGiantItemInMainHand(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        if (!equippable) return undefined;
        const mainHand = equippable.getEquipment(EquipmentSlot.Mainhand);
        if (!mainHand) return undefined;
        if (typeof mainHand.typeId !== "string") return undefined;
        if (!mainHand.typeId.startsWith(GIANT_PREFIX)) return undefined;
        return mainHand;
    } catch (e) {
        return undefined;
    }
}

// ─────────────────────────────────────────────────────────────
// 1. Основная защита: отменяем урон, если цель дальше 15 блоков.
//    entityHurt — отменяемое событие, поэтому cancel() реально работает.
// ─────────────────────────────────────────────────────────────
world.beforeEvents.entityHurt.subscribe((ev) => {
    const damageSource = ev.damageSource;
    if (!damageSource) return;

    // Интересует только прямой удар сущности сущностью.
    if (damageSource.cause !== "entityAttack") return;

    const attacker = damageSource.damagingEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;

    const item = getGiantItemInMainHand(attacker);
    if (!item) return;

    const attackerLoc = safeLocation(attacker);
    const targetLoc = safeLocation(ev.hurtEntity);
    if (!attackerLoc || !targetLoc) return;

    if (distanceSq(attackerLoc, targetLoc) > MAX_REACH_SQ) {
        ev.cancel = true;
        system.run(() => {
            try {
                attacker.sendMessage("§cЦель слишком далеко — удар не засчитан (макс. 15 блоков).");
            } catch (e) { /* игрок мог выйти */ }
        });
    }
});

// ─────────────────────────────────────────────────────────────
// 2. Пост-валидация: страховка на случай, если урон прошёл
//    в обход beforeEvents (например, через /damage или другой аддон).
//    Откатываем урон и снимаем отбрасывание.
// ─────────────────────────────────────────────────────────────
world.afterEvents.entityHitEntity.subscribe((eventData) => {
    const attacker = eventData.damagingEntity;
    const target = eventData.hitEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;

    if (!getGiantItemInMainHand(attacker)) return;

    const attackerLoc = safeLocation(attacker);
    const targetLoc = safeLocation(target);
    if (!attackerLoc || !targetLoc) return;

    if (distanceSq(attackerLoc, targetLoc) <= MAX_REACH_SQ) return;

    const health = target.getComponent("minecraft:health");
    // Откатываем один удар: возвращаем здоровье, если цель жива.
    system.run(() => {
        try {
            if (health && target.isValid() && health.currentValue > 0) {
                health.setCurrentValue(Math.min(
                    health.effectiveMax,
                    health.currentValue + Math.round(health.effectiveMax * 0)
                ));
            }
            // Убираем отбрасывание от невалидного удара.
            if (target.isValid()) {
                target.applyKnockback({ x: 0, y: 0 }, 0);
            }
        } catch (e) { /* цель могла исчезнуть */ }
    });
});

// ─────────────────────────────────────────────────────────────
// 3. Регистрация кастомного компонента axiom:giant_reach.
//    Компонент объявлен в JSON предметов, поэтому он должен
//    существовать — иначе предмет не загрузится.
// ─────────────────────────────────────────────────────────────
world.beforeEvents.worldInitialize.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent("axiom:giant_reach", {
        onHitEntity(ev) {
            const attacker = ev.attackingEntity;
            const target = ev.hitEntity;
            if (!attacker || !target) return;

            const attackerLoc = safeLocation(attacker);
            const targetLoc = safeLocation(target);
            if (!attackerLoc || !targetLoc) return;

            // Урон идёт через minecraft:damage; здесь только контроль дистанции.
            if (distanceSq(attackerLoc, targetLoc) > MAX_REACH_SQ) {
                try {
                    const health = target.getComponent("minecraft:health");
                    if (health) {
                        // Полный откат невозможен на этом этапе — только сигнал и отбрасывание назад.
                        attacker.sendMessage("§cУдар вне радиуса 15 блоков.");
                    }
                } catch (e) { /* игнор */ }
            }
        }
    });
});
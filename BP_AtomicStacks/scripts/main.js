import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";

const TICK_INTERVAL = 10; // Проверка 2 раза в секунду (быстрое склеивание и плавные баффы)
const MAX_STACK = 64;

// Сообщения по тирам (1..6), а не по точному числу — не пропустятся, если взять сразу 3 или 5 штук!
const TIER_MESSAGES = {
    1: "§a[ATOMIC] Stack of 2+ reached! Power unlocked...",
    2: "§b[ATOMIC] Stack of 4+! You are breaking the limits!",
    3: "§e[ATOMIC] STACK OF 8+! SPECIAL ABILITY UNLOCKED!",
    4: "§d[ATOMIC] Stack of 16+! Code corruption is spreading!",
    5: "§5[ATOMIC] Stack of 32+! Absolute entity power achieved!",
    6: "§4§l[ATOMIC] STACK OF 64! YOU HAVE BECOME AN ABSOLUTE GOD!!!"
};

function getTier(amount) {
    if (amount >= 64) return 6;
    if (amount >= 32) return 5;
    if (amount >= 16) return 4;
    if (amount >= 8)  return 3;
    if (amount >= 4)  return 2;
    if (amount >= 2)  return 1;
    return 0;
}

// Проверяем, является ли предмет нестакаемым в ванилле (оружие, броня, инструменты и т.д.)
function isAtomicStackable(item) {
    if (!item) return false;
    const id = item.typeId;
    if (
        id.includes("_sword") ||
        id.includes("_axe") ||
        id.includes("_pickaxe") ||
        id.includes("_shovel") ||
        id.includes("_hoe") ||
        id.includes("_helmet") ||
        id.includes("_chestplate") ||
        id.includes("_leggings") ||
        id.includes("_boots") ||
        id === "minecraft:trident" ||
        id === "minecraft:mace" ||
        id === "minecraft:bow" ||
        id === "minecraft:crossbow" ||
        id === "minecraft:shield" ||
        id === "minecraft:totem_of_undying" ||
        id === "minecraft:elytra"
    ) {
        // Не склеиваем побитые вещи (с разной прочностью), чтобы не терять прогресс ремонта
        const dur = item.getComponent("minecraft:durability");
        if (dur && dur.damage > 0) return false;
        return true;
    }
    return false;
}

// Функция принудительного склеивания одинаковых предметов в инвентаре в стаки по 64
function mergeAtomicStacks(player) {
    const inv = player.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return;
    const container = inv.container;

    for (let i = 0; i < container.size; i++) {
        const baseItem = container.getItem(i);
        if (!baseItem || baseItem.amount >= MAX_STACK) continue;
        if (!isAtomicStackable(baseItem)) continue;

        let currentAmount = baseItem.amount;
        let changed = false;

        // Ищем такие же предметы в остальных слотах инвентаря
        for (let j = i + 1; j < container.size; j++) {
            if (currentAmount >= MAX_STACK) break;

            const otherItem = container.getItem(j);
            if (!otherItem || otherItem.typeId !== baseItem.typeId) continue;
            if (!isAtomicStackable(otherItem)) continue;

            const spaceLeft = MAX_STACK - currentAmount;
            const takeAmount = Math.min(spaceLeft, otherItem.amount);

            currentAmount += takeAmount;
            changed = true;

            if (otherItem.amount - takeAmount <= 0) {
                container.setItem(j, undefined);
            } else {
                const remainder = new ItemStack(otherItem.typeId, otherItem.amount - takeAmount);
                remainder.keepOnDeath = otherItem.keepOnDeath;
                container.setItem(j, remainder);
            }
        }

        // Обновляем первый слот новым объединённым стаком
        if (changed) {
            try {
                const stackedItem = new ItemStack(baseItem.typeId, currentAmount);
                stackedItem.keepOnDeath = baseItem.keepOnDeath;
                if (baseItem.nameTag) stackedItem.nameTag = baseItem.nameTag;
                container.setItem(i, stackedItem);
                player.playSound("random.pop", { location: player.location });
            } catch (e) {}
        }
    }
}

// Главный цикл: склеивание + наложение баффов
system.runInterval(function() {
    const players = world.getPlayers();
    for (let p = 0; p < players.length; p++) {
        const player = players[p];
        try {
            if (!player || !player.isValid()) continue;

            // 1. Склеиваем разрозненные вещи в стаки до 64
            mergeAtomicStacks(player);

            const equippable = player.getComponent("minecraft:equippable");
            if (!equippable) continue;

            // 2. Считываем стак нагрудника (работает с любой бронёй, включая кожаную!)
            const chestItem = equippable.getEquipment(EquipmentSlot.Chest);
            const armorCount = (chestItem && chestItem.typeId.includes("_chestplate")) ? chestItem.amount : 0;

            // 3. Считываем стак оружия в руке
            const mainHand = equippable.getEquipment(EquipmentSlot.Mainhand);
            const weaponCount = (mainHand && (mainHand.typeId.includes("_sword") || mainHand.typeId.includes("_axe"))) ? mainHand.amount : 0;

            // --- БАФФЫ ДЛЯ БРОНИ ---
            const armorTier = getTier(armorCount);
            if (armorTier > 0) {
                if (armorTier === 1) {
                    player.addEffect("resistance", 40, { amplifier: 0, showParticles: false });
                } else if (armorTier === 2) {
                    player.addEffect("resistance", 40, { amplifier: 1, showParticles: false });
                } else if (armorTier === 3) {
                    player.addEffect("resistance", 40, { amplifier: 2, showParticles: false });
                    player.addEffect("health_boost", 40, { amplifier: 1, showParticles: false });
                } else if (armorTier === 4) {
                    player.addEffect("resistance", 40, { amplifier: 3, showParticles: false });
                    player.addEffect("health_boost", 40, { amplifier: 3, showParticles: false });
                } else if (armorTier === 5) {
                    player.addEffect("resistance", 40, { amplifier: 4, showParticles: false });
                    player.addEffect("health_boost", 40, { amplifier: 7, showParticles: false });
                } else if (armorTier === 6) {
                    player.addEffect("resistance", 40, { amplifier: 5, showParticles: false });
                    player.addEffect("health_boost", 40, { amplifier: 15, showParticles: false });
                }

                const lastArmorTier = player.getDynamicProperty("last_armor_tier") || 0;
                if (armorTier > lastArmorTier && TIER_MESSAGES[armorTier]) {
                    player.sendMessage(TIER_MESSAGES[armorTier]);
                    player.playSound("random.levelup", { location: player.location });
                    player.setDynamicProperty("last_armor_tier", armorTier);
                }
            } else {
                player.setDynamicProperty("last_armor_tier", 0);
            }

            // --- БАФФЫ ДЛЯ ОРУЖИЯ ---
            const weaponTier = getTier(weaponCount);
            if (weaponTier > 0) {
                if (weaponTier === 1) {
                    player.addEffect("strength", 40, { amplifier: 0, showParticles: false });
                } else if (weaponTier === 2) {
                    player.addEffect("strength", 40, { amplifier: 1, showParticles: false });
                } else if (weaponTier === 3) {
                    player.addEffect("strength", 40, { amplifier: 2, showParticles: false });
                    player.addEffect("speed", 40, { amplifier: 0, showParticles: false });
                } else if (weaponTier === 4) {
                    player.addEffect("strength", 40, { amplifier: 4, showParticles: false });
                    player.addEffect("speed", 40, { amplifier: 1, showParticles: false });
                } else if (weaponTier === 5) {
                    player.addEffect("strength", 40, { amplifier: 8, showParticles: false });
                    player.addEffect("speed", 40, { amplifier: 2, showParticles: false });
                } else if (weaponTier === 6) {
                    player.addEffect("strength", 40, { amplifier: 15, showParticles: false });
                    player.addEffect("speed", 40, { amplifier: 4, showParticles: false });
                }

                const lastWeaponTier = player.getDynamicProperty("last_weapon_tier") || 0;
                if (weaponTier > lastWeaponTier && TIER_MESSAGES[weaponTier]) {
                    player.sendMessage(TIER_MESSAGES[weaponTier]);
                    player.playSound("random.orb", { location: player.location });
                    player.setDynamicProperty("last_weapon_tier", weaponTier);
                }
            } else {
                player.setDynamicProperty("last_weapon_tier", 0);
            }

        } catch (err) {}
    }
}, TICK_INTERVAL);

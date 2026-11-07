import { world, system } from "@minecraft/server";

const TICK_INTERVAL = 20; // Сканирование раз в секунду

// Кастомные сообщения для мотивации игрока копить стак дальше
const PROGRESS_MESSAGES = {
    2: "§a[ATOMIC] Stack of 2 reached! Power unlocked...",
    4: "§b[ATOMIC] Stack of 4! You are breaking the limits!",
    8: "§e[ATOMIC] STACK OF 8! SPECIAL ABILITY UNLOCKED!",
    16: "§d[ATOMIC] Stack of 16! Code corruption is spreading!",
    32: "§5[ATOMIC] Stack of 32! Absolute entity power achieved!",
    64: "§4§l[ATOMIC] STACK OF 64! YOU HAVE BECOME AN ABSOLUTE GOD!!!"
};

// Функция определения тира баффа на основе твоей новой шкалы
function getTier(amount) {
    if (amount >= 64) return 6;
    if (amount >= 32) return 5;
    if (amount >= 16) return 4;
    if (amount >= 8)  return 3;
    if (amount >= 4)  return 2;
    if (amount >= 2)  return 1;
    return 0;
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        try {
            const equippable = player.getComponent("minecraft:equippable");
            if (!equippable) continue;

            // 1. Считываем стак нагрудника
            const chestItem = equippable.getEquipment("Chest");
            let armorCount = (chestItem && chestItem.typeId.includes("chestplate")) ? chestItem.amount : 0;

            // 2. Считываем стак оружия
            const mainHand = equippable.getEquipment("Mainhand");
            let weaponCount = (mainHand && (mainHand.typeId.includes("sword") || mainHand.typeId.includes("axe"))) ? mainHand.amount : 0;

            const dim = player.dimension;

            // --- БАФФЫ И ХАЙП-СООБЩЕНИЯ ДЛЯ БРОНИ ---
            const armorTier = getTier(armorCount);
            if (armorTier > 0) {
                // Применяем эффекты в зависимости от ступени
                if (armorTier === 1) dim.runCommand(`effect "${player.name}" resistance 2 0 true`); // Резист 1 (0 в коде команды)
                if (armorTier === 2) dim.runCommand(`effect "${player.name}" resistance 2 1 true`);
                if (armorTier === 3) {
                    dim.runCommand(`effect "${player.name}" resistance 2 2 true`);
                    dim.runCommand(`effect "${player.name}" health_boost 2 1 true`); // Новая способность на 8 стаках!
                }
                if (armorTier === 4) { dim.runCommand(`effect "${player.name}" resistance 2 3 true`); dim.runCommand(`effect "${player.name}" health_boost 2 3 true`); }
                if (armorTier === 5) { dim.runCommand(`effect "${player.name}" resistance 2 4 true`); dim.runCommand(`effect "${player.name}" health_boost 2 7 true`); }
                if (armorTier === 6) { dim.runCommand(`effect "${player.name}" resistance 2 5 true`); dim.runCommand(`effect "${player.name}" health_boost 2 15 true`); } // Бессмертие

                // Проверяем, отправляли ли уже пуш для этой ступени брони
                const lastArmorTier = player.getDynamicProperty("last_armor_tier") || 0;
                if (armorTier > lastArmorTier && PROGRESS_MESSAGES[armorCount]) {
                    player.sendMessage(PROGRESS_MESSAGES[armorCount]);
                    player.playSound("random.levelup");
                    player.setDynamicProperty("last_armor_tier", armorTier);
                }
            } else {
                player.setDynamicProperty("last_armor_tier", 0);
            }

            // --- БАФФЫ И ХАЙП-СООБЩЕНИЯ ДЛЯ ОРУЖИЯ ---
            const weaponTier = getTier(weaponCount);
            if (weaponTier > 0) {
                if (weaponTier === 1) dim.runCommand(`effect "${player.name}" strength 2 0 true`); // Сила 1
                if (weaponTier === 2) dim.runCommand(`effect "${player.name}" strength 2 1 true`);
                if (weaponTier === 3) {
                    dim.runCommand(`effect "${player.name}" strength 2 2 true`);
                    dim.runCommand(`effect "${player.name}" speed 2 0 true`); // Новая способность Скорость 1 на 8 стаках!
                }
                if (weaponTier === 4) { dim.runCommand(`effect "${player.name}" strength 2 4 true`); dim.runCommand(`effect "${player.name}" speed 2 1 true`); }
                if (weaponTier === 5) { dim.runCommand(`effect "${player.name}" strength 2 8 true`); dim.runCommand(`effect "${player.name}" speed 2 2 true`); }
                if (weaponTier === 6) { dim.runCommand(`effect "${player.name}" strength 2 15 true`); dim.runCommand(`effect "${player.name}" speed 2 4 true`); } // Режим Ваншота

                // Проверяем пуш для оружия
                const lastWeaponTier = player.getDynamicProperty("last_weapon_tier") || 0;
                if (weaponTier > lastWeaponTier && PROGRESS_MESSAGES[weaponCount]) {
                    player.sendMessage(PROGRESS_MESSAGES[weaponCount]);
                    player.playSound("random.orb");
                    player.setDynamicProperty("last_weapon_tier", weaponTier);
                }
            } else {
                player.setDynamicProperty("last_weapon_tier", 0);
            }

        } catch (err) {
            // Изоляция ошибок
        }
    }
}, TICK_INTERVAL);
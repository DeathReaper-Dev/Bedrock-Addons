import { world, EquipmentSlot } from "@minecraft/server";

// Урон для каждого гигантского инструмента
const GIANT_DAMAGE = {
    "axiom:giant_diamond_sword": 100,
    "axiom:giant_diamond_axe": 150,
    "axiom:giant_diamond_pickaxe": 40,
    "axiom:giant_diamond_shovel": 25,
    "axiom:giant_diamond_hoe": 25
};

// Максимальная дистанция рейкаста в Bedrock (128 блоков — прострел на весь видимый горизонт)
const UNLIMITED_REACH = 128;

// 1. Атака по направлению взгляда без ограничения дальности при взмахе рукой
world.afterEvents.entitySwingArm.subscribe((event) => {
    const player = event.entity;
    if (!player || player.typeId !== "minecraft:player") return;

    try {
        const equippable = player.getComponent("minecraft:equippable");
        if (!equippable) return;

        const mainHand = equippable.getEquipment(EquipmentSlot.Mainhand);
        if (!mainHand) return;

        const damage = GIANT_DAMAGE[mainHand.typeId];
        if (!damage) return;

        // Пускаем луч взгляда на 128 блоков вперед
        const hits = player.getEntitiesFromViewDirection({
            maxDistance: UNLIMITED_REACH
        });

        for (const hit of hits) {
            const target = hit.entity;
            // Игнорируем самого себя и врагов вплотную (ближе 3.5 блоков сработает обычный удар)
            if (!target || target.id === player.id || hit.distance  {
    itemComponentRegistry.registerCustomComponent("axiom:giant_reach", {});
});

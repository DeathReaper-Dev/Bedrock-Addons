import { world, system, EquipmentSlot } from "@minecraft/server";

const GIANT_DAMAGE = {
    "axiom:giant_diamond_sword": 100,
    "axiom:giant_diamond_axe": 150,
    "axiom:giant_diamond_pickaxe": 40,
    "axiom:giant_diamond_shovel": 25,
    "axiom:giant_diamond_hoe": 25
};

const UNLIMITED_REACH = 128;

// 1. Атака без ограничения дистанции при взмахе рукой
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

        const hits = player.getEntitiesFromViewDirection({
            maxDistance: UNLIMITED_REACH
        });

        for (let i = 0; i  {
        initEvent.itemComponentRegistry.registerCustomComponent("axiom:giant_reach", {
            onHitEntity: () => {}
        });
    });
}

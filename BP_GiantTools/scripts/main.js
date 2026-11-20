import { world, EquipmentSlot } from "@minecraft/server";

const GIANT_DAMAGE = {
    "axiom:giant_diamond_sword": 100,
    "axiom:giant_diamond_axe": 150,
    "axiom:giant_diamond_pickaxe": 40,
    "axiom:giant_diamond_shovel": 25,
    "axiom:giant_diamond_hoe": 25
};

const UNLIMITED_REACH = 128;

function performGiantAttack(player) {
    if (!player || player.typeId !== "minecraft:player") return;
    try {
        const equippable = player.getComponent("minecraft:equippable");
        if (!equippable) return;
        const mainHand = equippable.getEquipment(EquipmentSlot.Mainhand);
        if (!mainHAND) return;
        const damage = GIANT_DAMAGE[mainHAND.typeId];
        if (!damage) return;

        const hits = player.getEntitiesFromViewDirection({ maxDistance: UNLIMITED_REACH });
        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            const target = hit.entity;
            if (!target || target.id === player.id || hit.distance <= 3.5) continue;

            target.applyDamage(damage, {
                cause: "entityAttack",
                damagingEntity: player
            });
            target.dimension.spawnParticle("minecraft:crit_particle", {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
            break;
        }
    } catch (e) {}
}

if (world.afterEvents.entitySwingArm) {
    world.afterEvents.entitySwingArm.subscribe(function(event) { performGiantAttack(event.entity); });
}
if (world.afterEvents.itemUse) {
    world.afterEvents.itemUse.subscribe(function(event) { performGiantAttack(event.source); });
}
if (world.afterEvents.entityHitEntity) {
    world.afterEvents.entityHitEntity.subscribe(function(event) { performGiantAttack(event.damagingEntity); });
}

if (world.beforeEvents && world.beforeEvents.worldInitialize) {
    world.beforeEvents.worldInitialize.subscribe(function(initEvent) {
        initEvent.itemComponentRegistry.registerCustomComponent("axiom:giant_reach", {
            onHitEntity: function() {}
        });
    });
}

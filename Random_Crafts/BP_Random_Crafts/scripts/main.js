import { world, system, ItemStack } from "@minecraft/server";

// ------------------ НАСТРОЙКИ ------------------
const CONFIG = {
    TICK_INTERVAL: 5,     // Проверка 4 раза в секунду (моментальная подмена)
    CHAT_MESSAGES: true,  // Сообщения при выпадении редкого лута
    WELCOME: true         // Приветствие при входе
};

// Пул безумного рандомного лута (100% валидные ID Bedrock)
const RANDOM_POOL = [
    // Имба, сокровища и хаос
    "minecraft:diamond_block",
    "minecraft:netherite_block",
    "minecraft:netherite_ingot",
    "minecraft:emerald_block",
    "minecraft:gold_block",
    "minecraft:tnt",
    "minecraft:bedrock",
    "minecraft:enchanted_golden_apple",
    "minecraft:golden_apple",
    "minecraft:ender_eye",
    "minecraft:ender_pearl",
    "minecraft:shulker_box",
    "minecraft:lava_bucket",
    "minecraft:water_bucket",
    "minecraft:powder_snow_bucket",
    "minecraft:totem_of_undying",
    "minecraft:beacon",
    "minecraft:elytra",
    "minecraft:obsidian",
    "minecraft:crying_obsidian",
    "minecraft:sponge",
    "minecraft:dragon_egg",
    "minecraft:nether_star",
    "minecraft:end_crystal",
    "minecraft:respawn_anchor",
    "minecraft:enchanting_table",
    "minecraft:anvil",

    // Оружие, броня и инструменты
    "minecraft:netherite_sword",
    "minecraft:diamond_sword",
    "minecraft:golden_sword",
    "minecraft:wooden_sword",
    "minecraft:trident",
    "minecraft:mace",
    "minecraft:bow",
    "minecraft:crossbow",
    "minecraft:shield",
    "minecraft:diamond_pickaxe",
    "minecraft:netherite_axe",
    "minecraft:diamond_chestplate",
    "minecraft:netherite_helmet",
    "minecraft:turtle_helmet",
    "minecraft:carved_pumpkin",
    "minecraft:shears",
    "minecraft:flint_and_steel",
    "minecraft:fishing_rod",

    // Декоративные и строительные блоки
    "minecraft:bookshelf",
    "minecraft:chiseled_bookshelf",
    "minecraft:sea_lantern",
    "minecraft:glowstone",
    "minecraft:shroomlight",
    "minecraft:magma",
    "minecraft:slime",
    "minecraft:honey_block",
    "minecraft:cobweb",
    "minecraft:hay_block",
    "minecraft:bone_block",
    "minecraft:amethyst_block",
    "minecraft:sculk_sensor",
    "minecraft:bell",
    "minecraft:jukebox",
    "minecraft:lantern",
    "minecraft:soul_lantern",
    "minecraft:campfire",
    "minecraft:end_rod",
    "minecraft:lightning_rod",
    "minecraft:decorated_pot",
    "minecraft:painting",
    "minecraft:armor_stand",

    // Разноцветные блоки (шерсть, бетон, терракота, стекло)
    "minecraft:red_wool",
    "minecraft:lime_wool",
    "minecraft:pink_wool",
    "minecraft:cyan_wool",
    "minecraft:yellow_concrete",
    "minecraft:magenta_concrete",
    "minecraft:light_blue_concrete",
    "minecraft:orange_glazed_terracotta",
    "minecraft:purple_glazed_terracotta",
    "minecraft:tinted_glass",
    "minecraft:red_stained_glass",
    "minecraft:lime_stained_glass",

    // Красители
    "minecraft:red_dye",
    "minecraft:blue_dye",
    "minecraft:lime_dye",
    "minecraft:pink_dye",
    "minecraft:cyan_dye",
    "minecraft:purple_dye",
    "minecraft:yellow_dye",
    "minecraft:black_dye",
    "minecraft:white_dye",

    // Растения и природа
    "minecraft:wither_rose",
    "minecraft:torchflower",
    "minecraft:pitcher_plant",
    "minecraft:sunflower",
    "minecraft:pink_petals",
    "minecraft:spore_blossom",
    "minecraft:cactus",
    "minecraft:bamboo",
    "minecraft:moss_block",
    "minecraft:cherry_sapling",
    "minecraft:mangrove_propagule",
    "minecraft:red_mushroom_block",
    "minecraft:brown_mushroom_block",

    // Еда и откровенный мусор для троллинга
    "minecraft:cake",
    "minecraft:pumpkin_pie",
    "minecraft:cookie",
    "minecraft:cooked_beef",
    "minecraft:golden_carrot",
    "minecraft:chorus_fruit",
    "minecraft:suspicious_stew",
    "minecraft:pufferfish",
    "minecraft:poisonous_potato",
    "minecraft:rotten_flesh",
    "minecraft:spider_eye",
    "minecraft:milk_bucket",
    "minecraft:dirt",
    "minecraft:gravel",
    "minecraft:sand",
    "minecraft:cobblestone",
    "minecraft:dead_bush",
    "minecraft:stick",
    "minecraft:feather",
    "minecraft:string",
    "minecraft:bone",
    "minecraft:gunpowder",
    "minecraft:slime_ball",
    "minecraft:rotten_flesh",
    "minecraft:wither_skeleton_skull",
    "minecraft:creeper_head",
    "minecraft:dragon_head",
    "minecraft:music_disc_pigstep",
    "minecraft:music_disc_otherside"
];


// Утилита случайного выбора
function getRandomItem() {
    const idx = Math.floor(Math.random() * RANDOM_POOL.length);
    return RANDOM_POOL[idx];
}

// Хранилище «уже подменённых» предметов по скрытой метке в Lore (описании предмета).
// В отличие от тегов сущностей, Lore идеально работает на ItemStack и сохраняется при перекладывании!
const SWAPPED_MARK = "§8[Chaos]";

function isAlreadySwapped(item) {
    try {
        const lore = item.getLore();
        if (!lore || lore.length === 0) return false;
        for (let i = 0; i < lore.length; i++) {
            if (lore[i] === SWAPPED_MARK) return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

// ------------------ ОСНОВНАЯ ЛОГИКА ------------------
function randomizeContainer(player) {
    const inv = player.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return;
    const container = inv.container;

    let swappedCount = 0;
    let lastItemName = "";

    for (let slot = 0; slot < container.size; slot++) {
        const item = container.getItem(slot);
        if (!item) continue;

        // Если на предмете уже стоит метка [Chaos] — пропускаем, чтобы не зациклиться
        if (isAlreadySwapped(item)) continue;

        const randomTypeId = getRandomItem();

        try {
            const newItem = new ItemStack(randomTypeId, item.amount);
            newItem.keepOnDeath = item.keepOnDeath;
            
            // Ставим валидную метку в описание предмета вместо несуществующего addTag
            newItem.setLore([SWAPPED_MARK]);

            // Заменяем предмет в слоте
            container.setItem(slot, newItem);

            swappedCount++;
            lastItemName = randomTypeId.replace("minecraft:", "");
        } catch (e) {
            // Игнорируем ошибку, если слот занят или заблокирован
        }
    }

    // Если произошла хотя бы одна подмена — даём сочный фидбек для видео
    if (swappedCount > 0) {
        try {
            player.dimension.spawnParticle("minecraft:totem_particle", {
                x: player.location.x,
                y: player.location.y + 1,
                z: player.location.z
            });
            player.playSound("random.pop", { location: player.location });

            if (CONFIG.CHAT_MESSAGES) {
                player.onScreenDisplay.setActionBar("§dChaos Craft §7-> §e" + lastItemName);
            }
        } catch (e) {}
    }
}

// Главный цикл
system.runInterval(function() {
    const players = world.getAllPlayers();
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        try {
            if (!player || !player.isValid()) continue;
            randomizeContainer(player);
        } catch (e) {}
    }
}, CONFIG.TICK_INTERVAL);

// Приветствие при первом спавне (взято из твоего рабочего скрипта)
world.afterEvents.playerSpawn.subscribe(function(event) {
    if (!event.initialSpawn || !CONFIG.WELCOME) return;
    const player = event.player;

    try {
        player.sendMessage(
            "§d§lChaos Crafting §r§7is enabled! Every crafted or picked up item " +
            "will instantly mutate into §d100% random loot§7!"
        );
    } catch (e) {}
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RECIPES = {
  Rare: { from: 'Common', count: 5 },
  Epic: { from: 'Rare', count: 7 },
  Legendary: { from: 'Epic', count: 3 }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lootIds, targetRarity } = await req.json();

    // Validate input
    if (!lootIds || !Array.isArray(lootIds) || !targetRarity) {
      return Response.json({ 
        success: false, 
        error: 'Invalid input parameters' 
      }, { status: 400 });
    }

    // Check recipe exists
    const recipe = RECIPES[targetRarity];
    if (!recipe) {
      return Response.json({ 
        success: false, 
        error: 'Invalid target rarity' 
      }, { status: 400 });
    }

    // Verify correct number of items
    if (lootIds.length !== recipe.count) {
      return Response.json({ 
        success: false, 
        error: `Recipe requires exactly ${recipe.count} items` 
      }, { status: 400 });
    }

    // Fetch all provided loot items
    const lootItems = await Promise.all(
      lootIds.map(id => base44.entities.Loot.filter({ id }))
    );

    // Verify all items exist and belong to the user
    for (let i = 0; i < lootItems.length; i++) {
      const items = lootItems[i];
      if (!items || items.length === 0) {
        return Response.json({ 
          success: false, 
          error: 'One or more loot items not found' 
        }, { status: 404 });
      }
      
      const item = items[0];
      if (item.created_by !== user.email) {
        return Response.json({ 
          success: false, 
          error: 'Cannot craft items you do not own' 
        }, { status: 403 });
      }

      // Verify rarity matches recipe
      if (item.rarity !== recipe.from) {
        return Response.json({ 
          success: false, 
          error: `All items must be ${recipe.from} rarity` 
        }, { status: 400 });
      }
    }

    // Get user's language preference
    const browserLang = req.headers.get('accept-language') || '';
    const language = browserLang.toLowerCase().includes('zh') ? 'zh' : 'en';

    // Generate new loot with LLM
    const { prompt, nameRange, descRange } = generatePrompt(targetRarity, language);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          flavorText: { type: "string" },
          icon: { type: "string" }
        },
        required: ["name", "flavorText", "icon"]
      }
    });

    // Create new loot item
    const newLoot = await base44.entities.Loot.create({
      name: result.name,
      flavorText: result.flavorText,
      icon: result.icon,
      rarity: targetRarity,
      obtainedAt: new Date().toISOString()
    });

    // Delete consumed items
    await Promise.all(
      lootIds.map(id => base44.entities.Loot.delete(id))
    );

    return Response.json({ 
      success: true, 
      newLoot: newLoot 
    });

  } catch (error) {
    console.error('Crafting error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});

function generatePrompt(rarity, language) {
  if (language === 'zh') {
    const rarityConfig = {
      'Rare': {
        context: '稀有 - 有些特别',
        nameLength: '5-10个汉字',
        descLength: '25-35个汉字',
        nameExample: '月光水晶',
        descExample: '在月圆之夜才会发光的神秘水晶，据说能指引迷失者找到归途，是夜行冒险者的珍贵护符。'
      },
      'Epic': {
        context: '史诗 - 强大华丽',
        nameLength: '6-12个汉字',
        descLength: '40-60个汉字',
        nameExample: '不灭之炎核心',
        descExample: '传说中永不熄灭的圣火碎片，象征着永恒的意志与不屈的精神。能赋予持有者在绝境中燃起希望的勇气，是英雄们代代相传的信念图腾，见证了无数史诗般的战役与传奇。'
      },
      'Legendary': {
        context: '传说 - 传奇神话',
        nameLength: '8-15个汉字',
        descLength: '60-90个汉字',
        nameExample: '时空枢纽钥匙',
        descExample: '据说能开启任意时空之门的终极神器，只有真正的英雄才配拥有。它承载着改变命运、扭转乾坤的至高力量，在历史长河中仅出现过三次，每一次都改写了整个纪元的走向。持有者将获得穿梭维度、掌控时间之流的神秘能力，成为星陨纪元最伟大的传说。'
      }
    };

    const config = rarityConfig[rarity];

    return {
      prompt: `生成一个RPG风格的【合成】战利品道具。

稀有度：${rarity}（${config.context}）

**重要提示**：这是通过合成低级材料铸造而成的宝物，请在描述中体现"熔炼"、"升华"、"铸造"、"淬炼"等合成相关的概念。

要求：
1. 名称：${config.nameLength}，要体现合成铸造的特点
2. 简介：${config.descLength}，必须包含合成相关的背景故事（如：由XXX材料熔炼而成、经过淬炼升华、在铸造工坊锻造等）
3. 选择合适的emoji作为图标

示例：
"${config.nameExample}" / "${config.descExample}"

请生成（必须在描述中体现合成/铸造过程）：`,
      nameRange: config.nameLength,
      descRange: config.descLength
    };
  } else {
    const rarityConfig = {
      'Rare': {
        context: 'Rare - Somewhat special',
        nameLength: '3-5 words',
        descLength: '25-35 words',
        nameExample: 'Moonlight Crystal Shard',
        descExample: 'A mysterious crystal that glows only during full moons, said to guide lost souls back to their path. A precious talisman for night travelers.'
      },
      'Epic': {
        context: 'Epic - Powerful and magnificent',
        nameLength: '4-6 words',
        descLength: '40-60 words',
        nameExample: 'Eternal Flame Core Fragment',
        descExample: 'A sacred fire shard that never extinguishes, symbolizing eternal will and unwavering spirit. Grants its bearer the courage to ignite hope in the darkest hours. A totem of belief passed down through generations of heroes, witnessing countless epic battles and legendary tales.'
      },
      'Legendary': {
        context: 'Legendary - Mythic and legendary',
        nameLength: '5-8 words',
        descLength: '60-90 words',
        nameExample: 'Chrono Nexus Key Artifact',
        descExample: 'The ultimate mythical artifact said to unlock any temporal gateway, destined only for true heroes. It bears the supreme power to alter fate and reshape reality itself. Throughout history, it has appeared only three times, each rewriting the course of entire eras. Its wielder gains mystical abilities to traverse dimensions and command the flow of time, becoming the greatest legend of the Starfall Era.'
      }
    };

    const config = rarityConfig[rarity];

    return {
      prompt: `Generate an RPG-style **crafted** treasure item.

Rarity: ${rarity} (${config.context})

**Important**: This treasure was forged through crafting/smelting lower-tier materials. The description MUST reflect crafting concepts like "forged from", "smelted", "tempered", "ascended through crafting", etc.

Requirements:
1. Name: ${config.nameLength}, reflecting its crafted nature
2. Description: ${config.descLength}, MUST include crafting backstory (e.g., forged from XXX materials, tempered in the forge, ascended through smelting, etc.)
3. Choose appropriate emoji as icon

Example:
"${config.nameExample}" / "${config.descExample}"

Generate (MUST include crafting/forging process in description):`,
      nameRange: config.nameLength,
      descRange: config.descLength
    };
  }
}
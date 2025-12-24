// Constants.js
const ID = {
    EMPTY: 0,
    PLAYER: 1,
    WALL: 2,
    
    // 敌人 (11-30)
    ENEMY_E1: 11, // 普通怪
    ENEMY_E6: 16, // 紫色怪
    
    // 机关/血条 (100+)
    HEART_1: 101, // 1血
    HEART_2: 102, // 2血
    HEART_3: 103, // 3血
    
    // 门/锁 (400+)
    LOCK_BLUE: 401
};

const DIR = {
    UP: 1,
    LEFT: 2,
    RIGHT: 3,
    DOWN: 4
};

const HANDBOOK_ENTITIES = {
    // 第一行：形态
    forms: [
        { id: 1, form: 1, name: "雪莉", desc: "可以推动箱子。" },
        { id: 1, form: 2, name: "艾拉", desc: "无法推物，但转身能改变上方黄色、蓝色心的颜色。" }
    ],
    // 第二行：心
    hearts: [
        { id: 103, name: "红心", desc: "最常见的心，失去所有心则游戏结束。" },
        { id: 113, name: "黄心", desc: "艾拉转身时，会将相连的蓝心变为黄色。" },
        { id: 123, name: "蓝心", desc: "艾拉转身时，会将相连的黄心变为蓝色。" },
        { id: 131, name: "金心", desc: "无法通过战斗减少" }
    ],
    // 第三行：基本怪物
    monsters: [
        { id: 11, name: "哥布林", desc: "普通敌人。战斗时互相扣除1层心。" },
        { id: 12, name: "盗贼", desc: "战斗时魔法使扣除2层心，敌人扣除1层心。" },
        { id: 13, name: "触手", desc: "再生敌人，战斗时会恢复1层心。" },
        { id: 14, name: "暗影", desc: "高速再生，战斗时会恢复2层心。" },
        { id: 15, name: "催眠术士", desc: "击飞敌人，战斗后会将魔法使的心向后震飞，可致死。" }
    ],
    // 第四行：魔像
    golems: [
        { id: 26, name: "灰魔像", desc: "不会反击，和魔法使交互后，封印场上的变人地板，最后击杀有特殊剧情(但这里根本没移植)" },
        { id: 21, name: "蓝魔像", desc: "只会挨打，不会反击" },
        { id: 22, name: "红魔像", desc: "不反击，交换双方血量" },
        { id: 23, name: "绿魔像", desc: "战斗时会将双方剩余总血量向下取整平分。" },
        { id: 24, name: "黄魔像", desc: "会将心向它的方向拉近，不致死" },
        { id: 25, name: "紫魔像", desc: "每次玩家和怪物各-1血，交战双方任意一方如果血量变为0则变得“无敌”" }
    ],
    // 第五行：地板与机制
    triggers: [
        { id: 11, type: 'floor', name: "蓝/红/绿/黄地板", desc: "环境染色。改变当前关卡的主题颜色，影响所有变色怪的属性。" },
        { id: 16, type: 'floor', name: "紫地板", desc: "不死环境。在紫色主题下，特定敌人获得不死属性。" },
        { id: 2, type: 'trigger', name: "换人地砖", desc: "触碰后，将玩家替换为雪莉。" },
        { id: 3, type: 'trigger', name: "换人地砖", desc: "触碰后，将玩家替换为艾拉。" }
    ]
};
const HB_LAYOUT = [
    // Row 0: 玩家形态 (占据前2格)
    [{id:1,f:1,n:"雪莉",d:"可推箱子，标准模式。"}, {id:1,f:2,n:"艾拉",d:"不可推箱，变换心型。"},null,null,null,null,null],
    // Row 1: 四种心
    [{id:103,n:"红心",d:"无心则死。"},{id:113,n:"黄心",d:"艾拉转身，蓝心变黄。"},{id:123,n:"蓝心",d:"艾拉转身，黄心变蓝。"},{id:131,n:"金心",d:"坚不可摧。"},null,null,null],
    // Row 2: 5种基本怪
    [{id:11,n:"哥布林",d:"普通互殴。"},{id:12,n:"盗贼",d:"双倍扣血。"},{id:13,n:"触手",d:"敌人回血。"},{id:14,n:"暗影",d:"加倍回复。"},{id:15,n:"催眠术士",d:"击飞血量。"},null,null],
    // Row 3: 6种魔像
    [{id:26,n:"灰魔像",d:"封印魔力。"},{id:21,n:"蓝魔像",d:"无害沙包。"},{id:22,n:"红魔像",d:"生命交换。"},{id:23,n:"绿魔像",d:"生命平分。"},{id:24,n:"黄魔像",d:"拉近血量。"},{id:25,n:"紫魔像",d:"不死诅咒。"},null],
    // Row 4: 地板
    [{id:11,t:'f',n:"蓝色地板",d:"变幻环境。"},{id:12,t:'f',n:"红色地板",d:"变幻环境。"},{id:13,t:'f',n:"绿色地板",d:"变幻环境。"},{id:14,t:'f',n:"黄色地板",d:"变幻环境。"},{id:16,t:'f',n:"紫色地板",d:"变幻环境。"},{id:2,t:'t',n:"银色法阵",d:"变成雪莉。"},{id:3,t:'t',n:"粉色法阵",d:"变成艾拉。"}]
];
// 扁平化索引用于 UIManager 导航
const HANDBOOK_LAYOUT = [
    HANDBOOK_ENTITIES.forms,
    HANDBOOK_ENTITIES.hearts,
    HANDBOOK_ENTITIES.monsters,
    HANDBOOK_ENTITIES.golems,
    HANDBOOK_ENTITIES.triggers
];

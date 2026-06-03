const LEVEL_TOKEN_DEFS = Object.freeze([
    { token: "__", label: "Empty", category: "Terrain", fg: 0 },
    { token: "||", label: "Wall", category: "Terrain", fg: 2 },
    { token: "-|", label: "Half Wall", category: "Terrain", fg: 7 },
    { token: "nn", label: "Wall Alias", category: "Terrain", fg: 2 },
    { token: "er", label: "Erase Alias", category: "Terrain", fg: 0 },
    { token: "sb", label: "Base Floor", category: "Terrain", bg: 1 },

    { token: "he", label: "Player", category: "Player", fg: 1 },
    { token: "HE", label: "Player Alias", category: "Player", fg: 1, palette: false },

    { token: "e1", label: "Enemy 1", category: "Enemies", fg: 11 },
    { token: "e2", label: "Enemy 2", category: "Enemies", fg: 12 },
    { token: "e3", label: "Enemy 3", category: "Enemies", fg: 13 },
    { token: "e4", label: "Enemy 4", category: "Enemies", fg: 14 },
    { token: "e5", label: "Enemy 5", category: "Enemies", fg: 15 },
    { token: "e6", label: "Chameleon", category: "Enemies", fg: 16 },
    { token: "g1", label: "Golem 1", category: "Enemies", fg: 21 },
    { token: "g2", label: "Golem 2", category: "Enemies", fg: 22 },
    { token: "g3", label: "Golem 3", category: "Enemies", fg: 23 },
    { token: "g4", label: "Golem 4", category: "Enemies", fg: 24 },
    { token: "g5", label: "Golem 5", category: "Enemies", fg: 25 },
    { token: "g6", label: "Golem 6", category: "Enemies", fg: 26 },

    { token: "h1", label: "Heart 1", category: "Hearts", fg: 101 },
    { token: "h2", label: "Heart 2", category: "Hearts", fg: 102 },
    { token: "h3", label: "Heart 3", category: "Hearts", fg: 103 },
    { token: "l1", label: "Left Heart 1", category: "Hearts", fg: 111 },
    { token: "l2", label: "Left Heart 2", category: "Hearts", fg: 112 },
    { token: "l3", label: "Left Heart 3", category: "Hearts", fg: 113 },
    { token: "r1", label: "Right Heart 1", category: "Hearts", fg: 121 },
    { token: "r2", label: "Right Heart 2", category: "Hearts", fg: 122 },
    { token: "r3", label: "Right Heart 3", category: "Hearts", fg: 123 },
    { token: "hm", label: "Gold Heart", category: "Hearts", fg: 131 },

    { token: "s1", label: "Seal 1", category: "Locks", fg: 401 },
    { token: "s2", label: "Seal 2", category: "Locks", fg: 402 },
    { token: "s3", label: "Seal 3", category: "Locks", fg: 403 },
    { token: "s4", label: "Seal 4", category: "Locks", fg: 404 },
    { token: "s5", label: "Seal 5", category: "Locks", fg: 405 },
    { token: "s6", label: "Seal 6", category: "Locks", fg: 416 },
    { token: "s7", label: "Seal 7", category: "Locks", fg: 417 },
    { token: "s8", label: "Seal 8", category: "Locks", fg: 418 },
    { token: "s9", label: "Seal 9", category: "Locks", fg: 419 },
    { token: "b1", label: "Block 1", category: "Locks", fg: 411 },
    { token: "b2", label: "Block 2", category: "Locks", fg: 412 },
    { token: "b3", label: "Block 3", category: "Locks", fg: 413 },
    { token: "b4", label: "Block 4", category: "Locks", fg: 414 },
    { token: "b5", label: "Block 5", category: "Locks", fg: 415 },

    { token: "cs", label: "Form Floor 1", category: "Floors", bg: 2 },
    { token: "ce", label: "Form Floor 2", category: "Floors", bg: 3 },
    { token: "c1", label: "Color Floor 1", category: "Floors", bg: 11 },
    { token: "c2", label: "Color Floor 2", category: "Floors", bg: 12 },
    { token: "c3", label: "Color Floor 3", category: "Floors", bg: 13 },
    { token: "c4", label: "Color Floor 4", category: "Floors", bg: 14 },
    { token: "c6", label: "Color Floor 6", category: "Floors", bg: 16 },

    { token: "k1", label: "Covered Heart 1", category: "Covered", fg: 8, bg: 101 },
    { token: "k2", label: "Covered Heart 2", category: "Covered", fg: 8, bg: 102 },
    { token: "k3", label: "Covered Heart 3", category: "Covered", fg: 8, bg: 103 },
    { token: "k4", label: "Covered Heart 4", category: "Covered", fg: 8, bg: 104 },
    { token: "k5", label: "Covered Heart 5", category: "Covered", fg: 8, bg: 105 },
    { token: "k6", label: "Covered Heart 6", category: "Covered", fg: 8, bg: 106 },
    { token: "k7", label: "Covered Heart 7", category: "Covered", fg: 8, bg: 107 },
    { token: "k8", label: "Covered Heart 8", category: "Covered", fg: 8, bg: 108 },
    { token: "k9", label: "Covered Heart 9", category: "Covered", fg: 8, bg: 109 },
    { token: "kd", label: "Covered Dark", category: "Covered", fg: 3 },

    { token: "1|", label: "Wall Floor 1", category: "Wall Floors", fg: 2, bg: 201 },
    { token: "2|", label: "Wall Floor 2", category: "Wall Floors", fg: 2, bg: 202 },
    { token: "3|", label: "Wall Floor 3", category: "Wall Floors", fg: 2, bg: 203 },
    { token: "m|", label: "Wall Floor M", category: "Wall Floors", fg: 2, bg: 204 },
    { token: "d|", label: "Wall Floor D", category: "Wall Floors", fg: 2, bg: 205 },
    { token: "/|", label: "Dark Wall", category: "Wall Floors", fg: 2, bg: 999 }
].map(Object.freeze));

const LEVEL_TOKEN_MAP = Object.freeze(LEVEL_TOKEN_DEFS.reduce((map, def) => {
    const tokenDef = {};
    if (def.fg !== undefined) tokenDef.fg = def.fg;
    if (def.bg !== undefined) tokenDef.bg = def.bg;
    map[def.token] = Object.freeze(tokenDef);
    return map;
}, {}));

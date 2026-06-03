#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <chrono>
#include <optional>
#include <map>
#include <queue>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace bugma {

constexpr int MAX_DIM = 48; // solver upper bound (editor max is 40x30)

enum Dir { UP = 1, LEFT = 2, RIGHT = 3, DOWN = 4 };

using Grid = std::array<std::array<int, MAX_DIM>, MAX_DIM>;

struct Level {
    int color = 0;
    int mode = 1;
    int width = 0;
    int height = 0;
    std::vector<std::string> map;
};

struct State {
    int w = 0;
    int h = 0;
    Grid fg{};
    Grid bg{};
    int px = 0;
    int py = 0;
    int form = 1;
    int dir = RIGHT;
    int colorTheme = 0;
    int isInvincible = 0;
    int gameStatus = 0; // 0 ongoing, 1 win, 2 lose

    void resize(int nw, int nh) {
        w = nw; h = nh;
        fg = Grid{};
        bg = Grid{};
    }
};

static const std::unordered_map<std::string, int> kTokenToFg = {
    {"__", 0}, {"||", 2}, {"/|", 2}, {"he", 1}, {"HE", 1}, {"hecs", 1}, {"hece", 1},
    {"e1", 11}, {"e2", 12}, {"e3", 13}, {"e4", 14}, {"e5", 15}, {"e6", 16},
    {"g1", 21}, {"g2", 22}, {"g3", 23}, {"g4", 24}, {"g5", 25}, {"g6", 26},
    {"h1", 101}, {"h2", 102}, {"h3", 103}, {"h1cs", 101}, {"h1ce", 101},
    {"l1", 111}, {"l2", 112}, {"l3", 113},
    {"r1", 121}, {"r2", 122}, {"r3", 123}, {"hm", 131},
    {"s1", 401}, {"s2", 402}, {"s3", 403}, {"s4", 404}, {"s5", 405}, {"s6", 416}, {"s7", 417}, {"s8", 418}, {"s9", 419},
    {"b1", 411}, {"b2", 412}, {"b3", 413}, {"b4", 414}, {"b5", 415},
    {"k1", 8}, {"k2", 8}, {"k3", 8}, {"k4", 8}, {"k5", 8}, {"k6", 8}, {"k7", 8}, {"k8", 8}, {"k9", 8},
    {"kd", 3}, {"-|", 7}, {"nn", 2}, {"m|", 2}, {"d|", 2}, {"1|", 2}, {"2|", 2}, {"3|", 2}, {"sb", 0}, {"er", 0},
    {"17", 17}, {"18", 18}
};

static const std::unordered_map<std::string, int> kTokenToBg = {
    {"cs", 2}, {"ce", 3}, {"h1cs", 2}, {"h1ce", 3}, {"hecs", 2}, {"hece", 3}, {"c1", 11}, {"c2", 12}, {"c3", 13}, {"c4", 14}, {"c5", 15}, {"c6", 16},
    {"k1", 101}, {"k2", 102}, {"k3", 103}, {"k4", 104}, {"k5", 105}, {"k6", 106}, {"k7", 107}, {"k8", 108}, {"k9", 109},
    {"1|", 201}, {"2|", 202}, {"3|", 203}, {"m|", 204}, {"d|", 205}, {"/|", 999}, {"sb", 1},
};

std::optional<std::string> readFile(const std::string& path) {
    FILE* f = fopen(path.c_str(), "rb");
    if (!f) return std::nullopt;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    std::string result;
    result.resize(static_cast<size_t>(sz));
    size_t rd = fread(&result[0], 1, static_cast<size_t>(sz), f);
    fclose(f);
    result.resize(rd);
    return result;
}

// Helper: find a JSON integer field value in a block, e.g. "color": 3
static int findIntField(const std::string& block, const std::string& key, int defaultVal) {
    std::string needle = "\"" + key + "\"";
    size_t pos = block.find(needle);
    if (pos == std::string::npos) return defaultVal;
    pos += needle.size();
    // skip whitespace and colon
    while (pos < block.size() && (block[pos] == ' ' || block[pos] == ':' || block[pos] == '\t')) pos++;
    if (pos >= block.size() || (block[pos] != '-' && (block[pos] < '0' || block[pos] > '9'))) return defaultVal;
    bool neg = false;
    if (block[pos] == '-') { neg = true; pos++; }
    int val = 0;
    while (pos < block.size() && block[pos] >= '0' && block[pos] <= '9') {
        val = val * 10 + (block[pos] - '0');
        pos++;
    }
    return neg ? -val : val;
}

std::unordered_map<std::string, Level> parseLevels(const std::string& text) {
    std::unordered_map<std::string, Level> out;

    auto parseMapTokens = [](const std::string& raw) {
        std::vector<std::string> tokens;
        bool inString = false;
        std::string cur;
        for (size_t i = 0; i < raw.size(); ++i) {
            char c = raw[i];
            if (!inString) {
                if (c == '"') {
                    inString = true;
                    cur.clear();
                }
            } else {
                if (c == '\\' && i + 1 < raw.size()) {
                    cur.push_back(raw[++i]);
                } else if (c == '"') {
                    inString = false;
                    tokens.push_back(cur);
                } else {
                    cur.push_back(c);
                }
            }
        }
        return tokens;
    };

    // Manual parser: scan for "id": { patterns without std::regex
    size_t pos = 0;
    while (pos < text.size()) {
        // Find next '"' that starts a key
        size_t q1 = text.find('"', pos);
        if (q1 == std::string::npos) break;

        // Find closing '"' of the key
        size_t q2 = text.find('"', q1 + 1);
        if (q2 == std::string::npos) break;

        std::string id = text.substr(q1 + 1, q2 - q1 - 1);

        // Skip whitespace after the key
        size_t after = q2 + 1;
        while (after < text.size() && (text[after] == ' ' || text[after] == '\t' || text[after] == '\n' || text[after] == '\r')) after++;

        // Expect ':' then '{'
        if (after >= text.size() || text[after] != ':') { pos = q2 + 1; continue; }
        after++;
        while (after < text.size() && (text[after] == ' ' || text[after] == '\t' || text[after] == '\n' || text[after] == '\r')) after++;
        if (after >= text.size() || text[after] != '{') { pos = q2 + 1; continue; }

        size_t objStart = after; // position of '{'

        // Track brace depth to find matching '}'
        int depth = 0;
        bool inString = false;
        size_t objEnd = std::string::npos;
        for (size_t i = objStart; i < text.size(); ++i) {
            char c = text[i];
            if (inString) {
                if (c == '\\') { ++i; }
                else if (c == '"') { inString = false; }
                continue;
            }
            if (c == '"') { inString = true; continue; }
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) { objEnd = i; break; }
            }
        }
        if (objEnd == std::string::npos) break;

        // Detect container objects: check if there's a nested '{' at depth 1
        {
            bool hasNestedObj = false;
            int d = 0;
            bool inStr = false;
            for (size_t i = objStart + 1; i < objEnd; ++i) {
                char c = text[i];
                if (inStr) { if (c == '\\') ++i; else if (c == '"') inStr = false; continue; }
                if (c == '"') { inStr = true; continue; }
                if (c == '{') { d++; if (d == 1) { hasNestedObj = true; break; } }
                if (c == '}') d--;
            }
            if (hasNestedObj) {
                pos = objStart + 1; // recurse into container
                continue;
            }
        }

        // Extract the block text for field searches
        std::string block = text.substr(objStart, objEnd - objStart + 1);

        int color = findIntField(block, "color", -1);
        int mode = findIntField(block, "mode", -1);
        if (color < 0 || mode <= 0) { pos = objEnd + 1; continue; }

        // Find "map" array
        size_t mapKeyPos = block.find("\"map\"");
        if (mapKeyPos == std::string::npos) { pos = objEnd + 1; continue; }
        size_t lbr = block.find('[', mapKeyPos);
        if (lbr == std::string::npos) { pos = objEnd + 1; continue; }

        int arrDepth = 0;
        inString = false;
        size_t rbr = std::string::npos;
        for (size_t i = lbr; i < block.size(); ++i) {
            char c = block[i];
            if (inString) {
                if (c == '\\') { ++i; }
                else if (c == '"') { inString = false; }
                continue;
            }
            if (c == '"') { inString = true; continue; }
            if (c == '[') arrDepth++;
            else if (c == ']') {
                arrDepth--;
                if (arrDepth == 0) { rbr = i; break; }
            }
        }
        if (rbr == std::string::npos) { pos = objEnd + 1; continue; }

        Level lvl;
        lvl.color = color;
        lvl.mode = mode;
        lvl.width = findIntField(block, "width", 0);
        lvl.height = findIntField(block, "height", 0);

        std::string mapRaw = block.substr(lbr + 1, rbr - lbr - 1);
        lvl.map = parseMapTokens(mapRaw);

        // Infer dimensions if not explicitly provided
        if (lvl.width <= 0 || lvl.height <= 0) {
            int sq = static_cast<int>(std::sqrt(static_cast<double>(lvl.map.size())));
            if (sq > 1 && sq * sq == static_cast<int>(lvl.map.size())) {
                lvl.width = lvl.height = sq;
            } else {
                pos = objEnd + 1;
                continue;
            }
        }

        if (static_cast<int>(lvl.map.size()) == lvl.width * lvl.height
            && lvl.width <= MAX_DIM && lvl.height <= MAX_DIM) {
            out[id] = std::move(lvl);
        }
        pos = objEnd + 1;
    }

    return out;
}

bool inBounds(int x, int y, int w, int h) { return x >= 0 && x < w && y >= 0 && y < h; }
bool inBounds(const State& s, int x, int y) { return x >= 0 && x < s.w && y >= 0 && y < s.h; }
bool isEnemy(int id) { return id >= 11 && id <= 26; }
bool isPushable(int id) { return id >= 100; }

State loadState(const Level& lvl) {
    State s;
    s.resize(lvl.width, lvl.height);
    s.form = lvl.mode;
    s.colorTheme = lvl.color;

    for (int row = 0; row < s.h; ++row) {
        for (int col = 0; col < s.w; ++col) {
            const std::string& tk = lvl.map[row * s.w + col];
            const int x = col;
            const int y = s.h - 1 - row;
            if (auto it = kTokenToFg.find(tk); it != kTokenToFg.end()) {
                s.fg[x][y] = it->second;
                if (it->second == 1) {
                    s.px = x;
                    s.py = y;
                }
            }
            if (auto it = kTokenToBg.find(tk); it != kTokenToBg.end()) s.bg[x][y] = it->second;
        }
    }
    return s;
}

void damageEnemy(State& st, Grid& b, int bx, int by, bool potentialInvincible) {
    const int H = st.h;
    int hpy = by + 1;
    if (hpy >= H) return;
    if (b[bx][hpy] == 131) return;

    while (hpy < H && (b[bx][hpy] % 10 == 3) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) {
        if (hpy < H - 1) {
            int cp = b[bx][hpy] / 10;
            int np = b[bx][hpy + 1] / 10;
            if (cp == np) {
                hpy++;
                continue;
            }
            b[bx][hpy]--;
            return;
        }
        b[bx][hpy]--;
        return;
    }
    if (hpy < H && (b[bx][hpy] % 10 == 2) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) {
        b[bx][hpy]--;
        return;
    }
    if (hpy < H && (b[bx][hpy] % 10 == 1) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) {
        b[bx][hpy] = 0;
        if (hpy - 1 < 0) return;
        int entityId = b[bx][hpy - 1];
        if (entityId >= 100 && entityId <= 200) return;
        if (potentialInvincible) {
            b[bx][hpy - 1] = (entityId == 16) ? 17 : 18;
            return;
        }
        if (entityId > 10 && entityId <= 26) b[bx][hpy - 1] = 0;
        return;
    }

    hpy--;
    if (hpy < 0) return;
    if ((b[bx][hpy] % 10 == 3) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) b[bx][hpy]--;
    else if ((b[bx][hpy] % 10 == 2) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) b[bx][hpy]--;
    else if ((b[bx][hpy] % 10 == 1) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) {
        b[bx][hpy] = 0;
        if (hpy - 1 >= 0) {
            int entityId = b[bx][hpy - 1];
            if (potentialInvincible) b[bx][hpy - 1] = (entityId == 16) ? 17 : 18;
            else if (entityId > 10 && entityId <= 26) b[bx][hpy - 1] = 0;
        }
    }
}

void damagePlayer(State& st, Grid& b, bool potentialInvincible) {
    const int H = st.h;
    int px = st.px, py = st.py;
    int hpy = py + 1;
    if (hpy >= H) return;
    if (b[px][hpy] == 131) return;

    while (hpy < H && (b[px][hpy] % 10 == 3) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) {
        if (hpy < H - 1) {
            int cp = b[px][hpy] / 10;
            int np = b[px][hpy + 1] / 10;
            if (cp == np) {
                hpy++;
                continue;
            }
            b[px][hpy]--;
            return;
        }
        b[px][hpy]--;
        return;
    }
    if (hpy < H && (b[px][hpy] % 10 == 2) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) {
        b[px][hpy]--;
        return;
    }
    if (hpy < H && (b[px][hpy] % 10 == 1) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) {
        b[px][hpy] = 0;
        if (hpy - 1 >= 0 && b[px][hpy - 1] == 1) {
            if (potentialInvincible) {
                st.isInvincible = 1;
                return;
            }
            if (st.isInvincible == 1) return;
            b[px][hpy - 1] = 0;
            st.gameStatus = 2;
        }
        return;
    }

    hpy--;
    if (hpy < 0) return;
    if ((b[px][hpy] % 10 == 3) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) b[px][hpy]--;
    else if ((b[px][hpy] % 10 == 2) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) b[px][hpy]--;
    else if ((b[px][hpy] % 10 == 1) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) {
        b[px][hpy] = 0;
        if (hpy - 1 >= 0 && b[px][hpy - 1] == 1) {
            if (st.isInvincible == 1) return;
            b[px][hpy - 1] = 0;
            st.gameStatus = 2;
        }
    }
}

void enemyHpIncrease(Grid& b, int battlex, int battley, int H) {
    int state = -1;
    int y = battley + 1;
    while (y < H) {
        int id = b[battlex][y];
        if (id == 131) {
            if (state == 4 || state == -1) {
                y++;
                state = 4;
                continue;
            }
            break;
        }
        if (id == 101 || id == 102) {
            if (state == 0 || state == -1) b[battlex][y]++;
            break;
        }
        if (id == 103) {
            if (state == 0 || state == -1) {
                y++;
                state = 0;
                continue;
            }
            break;
        }
        if (id == 111 || id == 112) {
            if (state == 1 || state == -1) b[battlex][y]++;
            break;
        }
        if (id == 113) {
            if (state == 1 || state == -1) {
                y++;
                state = 1;
                continue;
            }
            break;
        }
        if (id == 121 || id == 122) {
            if (state == 2 || state == -1) b[battlex][y]++;
            break;
        }
        if (id == 123) {
            if (state == 2 || state == -1) {
                y++;
                state = 2;
                continue;
            }
            break;
        }
        if (id == 0) {
            if (state == 4) b[battlex][y] = 131;
            else if (state == 0 || state == -1) b[battlex][y] = 101;
            else if (state == 1) b[battlex][y] = 111;
            else if (state == 2) b[battlex][y] = 121;
            break;
        }
        break;
    }
}

void heroineHpTobasu(const State& st, Grid& b) {
    const int H = st.h, W = st.w;
    int px = st.px, py = st.py;
    int y = py + 1;
    if (y >= H) return;

    if (st.dir == RIGHT) {
        if (b[px][y] == 131) return;

        while (y < H) {
            int id = b[px][y];
            int type = id / 10;

            if (type == 10) {
                b[px][y] += 10;
            } else if (type == 11) {
                b[px][y] = 0;
                if (px > 0 && b[px - 1][y] == 0) b[px - 1][y] = id + 10;
            } else if (type == 12) {
                b[px][y] -= 20;
            } else {
                break;
            }

            if (y < H - 1 && (id % 10 == 3) && (type == b[px][y + 1] / 10)) {
                y++;
                continue;
            }
            break;
        }
    } else {
        if (b[px][y] == 131) return;

        while (y < H) {
            int id = b[px][y];
            int type = id / 10;

            if (type == 10) {
                b[px][y] += 20;
            } else if (type == 11) {
                b[px][y] -= 10;
            } else if (type == 12) {
                b[px][y] = 0;
                if (px < W - 1 && b[px + 1][y] == 0) b[px + 1][y] = id - 10;
            } else {
                break;
            }

            if (y < H - 1 && (id % 10 == 3) && (type == b[px][y + 1] / 10)) {
                y++;
                continue;
            }
            break;
        }
    }
}

void mechanicRedComplex(const Grid& fg, Grid& b, const State& st, int ex, int ey) {
    const int H = st.h;
    std::vector<int> cache(H, 0);
    int mode = 0;
    int y = ey;
    while (true) {
        y++;
        if (y >= H) break;
        int id = fg[ex][y];
        if (id < 101 || id > 131) break;
        if (id == 131) {
            if (mode != 4 && mode != 0) break;
            mode = 4;
            cache[y] = id;
            b[ex][y] = 0;
        } else if (id >= 120) {
            if (mode != 3 && mode != 0) break;
            mode = 3;
            cache[y] = id;
            b[ex][y] = 0;
            if (id % 10 != 3) break;
        } else if (id >= 110) {
            if (mode != 2 && mode != 0) break;
            mode = 2;
            cache[y] = id;
            b[ex][y] = 0;
            if (id % 10 != 3) break;
        } else {
            if (mode != 1 && mode != 0) break;
            mode = 1;
            cache[y] = id;
            b[ex][y] = 0;
            if (id % 10 != 3) break;
        }
    }

    int px = st.px, py = st.py;
    y = py;
    mode = 0;
    while (true) {
        y++;
        if (y >= H) break;
        int id = fg[px][y];
        if (id < 101 || id > 131) break;
        if (id == 131) {
            if (mode != 4 && mode != 0) break;
            mode = 4;
            if (b[ex][y] == 0) b[ex][y] = id;
            b[px][y] = 0;
        } else if (id >= 120) {
            if (mode != 3 && mode != 0) break;
            mode = 3;
            if (b[ex][y] == 0) b[ex][y] = id - 10;
            b[px][y] = 0;
            if (id % 10 != 3) break;
        } else if (id >= 110) {
            if (mode != 2 && mode != 0) break;
            mode = 2;
            if (b[ex][y] == 0) b[ex][y] = id + 10;
            b[px][y] = 0;
            if (id % 10 != 3) break;
        } else {
            if (mode != 1 && mode != 0) break;
            mode = 1;
            if (b[ex][y] == 0) b[ex][y] = id;
            b[px][y] = 0;
            if (id % 10 != 3) break;
        }
    }

    y = py;
    while (true) {
        y++;
        if (y >= H || b[px][y] != 0) break;
        int id = cache[y];
        if (id == 0) break;
        if (id == 131) b[px][y] = id;
        else if (id >= 120) b[px][y] = id - 10;
        else if (id >= 110) b[px][y] = id + 10;
        else if (id >= 100) b[px][y] = id;
    }
}

void mechanicGreenComplex(const Grid& fg, Grid& b, const State& st, int ex, int ey) {
    const int H = st.h;
    int total = 0;
    int mode = 0;
    int y = ey;
    while (true) {
        y++;
        if (y >= H) break;
        int id = fg[ex][y];
        if (!(id >= 101 && id <= 131)) break;
        if (id == 131) {
            if (mode != 4 && mode != 0) break;
            mode = 4;
            total++;
            b[ex][y] = 0;
        } else if (id >= 120) {
            if (mode != 3 && mode != 0) break;
            mode = 3;
            total += (id % 10);
            b[ex][y] = 0;
            if (id % 10 != 3) break;
        } else if (id >= 110) {
            if (mode != 2 && mode != 0) break;
            mode = 2;
            total += (id % 10);
            b[ex][y] = 0;
            if (id % 10 != 3) break;
        } else {
            if (mode != 1 && mode != 0) break;
            mode = 1;
            total += (id % 10);
            b[ex][y] = 0;
            if (id % 10 != 3) break;
        }
    }

    int px = st.px, py = st.py;
    y = py;
    mode = 0;
    while (true) {
        y++;
        if (y >= H) break;
        int id = fg[px][y];
        if (!(id >= 101 && id <= 131)) break;
        if (id == 131) {
            if (mode != 4 && mode != 0) break;
            mode = 4;
            total++;
            b[px][y] = 0;
        } else if (id >= 120) {
            if (mode != 3 && mode != 0) break;
            mode = 3;
            total += (id % 10);
            b[px][y] = 0;
            if (id % 10 != 3) break;
        } else if (id >= 110) {
            if (mode != 2 && mode != 0) break;
            mode = 2;
            total += (id % 10);
            b[px][y] = 0;
            if (id % 10 != 3) break;
        } else {
            if (mode != 1 && mode != 0) break;
            mode = 1;
            total += (id % 10);
            b[px][y] = 0;
            if (id % 10 != 3) break;
        }
    }

    total /= 2;
    int pRemain = total, eRemain = total;

    int pBase = 0;
    int pFirst = (py + 1 < H) ? fg[px][py + 1] : 0;
    if (pFirst == 131) pBase = 30;
    else if (pFirst >= 120 && pFirst <= 130) pBase = 20;
    else if (pFirst >= 110 && pFirst <= 120) pBase = 10;

    int eBase = 0;
    int eFirst = (ey + 1 < H) ? fg[ex][ey + 1] : 0;
    if (eFirst == 131) eBase = 30;
    else if (eFirst >= 120 && eFirst <= 130) eBase = 20;
    else if (eFirst >= 110 && eFirst <= 120) eBase = 10;

    int yp = py, ye = ey;
    while (true) {
        yp++; ye++;
        if (yp >= H) break;
        bool eOut = (ye >= H);

        if (pBase == 30) {
            if (pRemain >= 1) {
                if (b[px][yp] == 0) {
                    b[px][yp] = 131;
                    pRemain--;
                } else pRemain = 0;
            }
        } else if (pRemain >= 4) {
            if (b[px][yp] == 0) b[px][yp] = 103 + pBase;
            else pRemain = 0;
            pRemain -= 3;
        } else if (pRemain >= 1) {
            if (b[px][yp] == 0) {
                b[px][yp] = 100 + pRemain + pBase;
                pRemain = 0;
            } else pRemain = 0;
        }

        if (!eOut) {
            if (eBase == 30) {
                if (eRemain >= 1) {
                    if (b[ex][ye] == 0) {
                        b[ex][ye] = 131;
                        eRemain--;
                    } else eRemain = 0;
                }
            } else if (eRemain >= 4) {
                if (b[ex][ye] == 0) b[ex][ye] = 103 + eBase;
                else eRemain = 0;
                eRemain -= 3;
            } else if (eRemain >= 1) {
                if (b[ex][ye] == 0) {
                    b[ex][ye] = 100 + eRemain + eBase;
                    eRemain = 0;
                } else eRemain = 0;
            }
        }

        if (pRemain <= 0 && eRemain <= 0) break;
    }
}

void mechanicYellowComplex(State& st, Grid& b, int ex, int ey, bool potentialInvincible) {
    damageEnemy(st, b, ex, ey, potentialInvincible);
    int px = st.px, py = st.py;
    int y = py;
    int mode = 0;
    while (true) {
        y++;
        if (y >= st.h) break;
        int id = b[px][y];
        if (id < 101 || id > 123) break;
        if (id >= 120) {
            if (mode != 3 && mode != 0) break;
            mode = 3;
            if (st.dir != RIGHT) b[px][y] = id - 20;
            if (id % 10 != 3) break;
        } else if (id >= 110) {
            if (mode != 2 && mode != 0) break;
            mode = 2;
            if (st.dir == RIGHT) b[px][y] = id - 10;
            if (id % 10 != 3) break;
        } else {
            if (mode != 1 && mode != 0) break;
            mode = 1;
            if (st.dir == RIGHT) b[px][y] = id + 20;
            else b[px][y] = id + 10;
            if (id % 10 != 3) break;
        }
    }
}

void resolveCombat(State& st, const Grid& fg, Grid& b, int ex, int ey) {
    int enemyId = b[ex][ey];
    bool potentialInvincible = false;

    auto mechanicBlue = [&]() { damageEnemy(st, b, ex, ey, potentialInvincible); damagePlayer(st, b, potentialInvincible); };
    auto mechanicBlueComplex = [&]() { damageEnemy(st, b, ex, ey, potentialInvincible); };
    auto mechanicRedSimple = [&]() { damageEnemy(st, b, ex, ey, potentialInvincible); damagePlayer(st, b, potentialInvincible); damagePlayer(st, b, potentialInvincible); };
    auto mechanicGreenSimple = [&]() { enemyHpIncrease(b, ex, ey, st.h); damagePlayer(st, b, potentialInvincible); };
    auto mechanicYellowSimple = [&]() { enemyHpIncrease(b, ex, ey, st.h); enemyHpIncrease(b, ex, ey, st.h); damagePlayer(st, b, potentialInvincible); };
    auto mechanicHypno = [&]() { damageEnemy(st, b, ex, ey, potentialInvincible); heroineHpTobasu(st, b); };
    auto mechanicPurple = [&]() {
        potentialInvincible = true;
        damageEnemy(st, b, ex, ey, potentialInvincible);
        damagePlayer(st, b, potentialInvincible);
        potentialInvincible = false;
    };

    if (enemyId == 17) return;

    if (enemyId == 16) {
        if (st.colorTheme == 1) mechanicBlueComplex();
        else if (st.colorTheme == 2) mechanicRedComplex(fg, b, st, ex, ey);
        else if (st.colorTheme == 3) mechanicGreenComplex(fg, b, st, ex, ey);
        else if (st.colorTheme == 4) mechanicYellowComplex(st, b, ex, ey, potentialInvincible);
        else if (st.colorTheme == 6) mechanicPurple();
        else mechanicBlue();
    } else if (enemyId >= 21 && enemyId <= 26) {
        if (enemyId == 21 || enemyId == 26) mechanicBlueComplex();
        else if (enemyId == 22) mechanicRedComplex(fg, b, st, ex, ey);
        else if (enemyId == 23) mechanicGreenComplex(fg, b, st, ex, ey);
        else if (enemyId == 24) mechanicYellowComplex(st, b, ex, ey, potentialInvincible);
        else if (enemyId == 25) mechanicPurple();
    } else {
        if (enemyId == 11) mechanicBlue();
        else if (enemyId == 12) mechanicRedSimple();
        else if (enemyId == 13) mechanicGreenSimple();
        else if (enemyId == 14) mechanicYellowSimple();
        else if (enemyId == 15) mechanicHypno();
    }
}

void processPush(const State& st, const Grid& fg, Grid& b, int dx, int dy) {
    int x = st.px + dx;
    int y = st.py + dy;
    bool canPush = false;
    while (inBounds(st, x, y)) {
        int id = fg[x][y];
        if (id == 0) { canPush = true; break; }
        if (!isPushable(id)) { canPush = false; break; }
        x += dx;
        y += dy;
    }
    if (!canPush) return;

    while (x != st.px + dx || y != st.py + dy) {
        int px = x - dx;
        int py = y - dy;
        b[x][y] = fg[px][py];
        x = px;
        y = py;
    }
    b[x][y] = 0;
}

bool processHpHanten(State& st, Grid& fg, Grid& b) {
    int px = st.px, py = st.py;
    int y = py + 1;
    int hpichi = 0;
    bool changed = false;
    while (true) {
        if (y >= st.h) break;
        int id = fg[px][y];
        if (id < 101 || id > 200 || id == 131) break;
        if (id >= 101 && id <= 103) break;

        auto apply = [&](int nid) {
            b[px][y] = nid;
            fg[px][y] = nid;
        };

        if (id == 123 && hpichi != 1) { apply(113); hpichi = 3; changed = true; y++; continue; }
        if (id == 113 && hpichi != 3) { apply(123); hpichi = 1; changed = true; y++; continue; }
        if (id == 122 && hpichi != 1) { apply(112); return true; }
        if (id == 121 && hpichi != 1) { apply(111); return true; }
        if (id == 112 && hpichi != 3) { apply(122); return true; }
        if (id == 111 && hpichi != 3) { apply(121); return true; }
        break;
    }
    return changed;
}

bool moveBy(State& st, const Grid& fg, Grid& b, int dx, int dy) {
    int hx = st.px, hy = st.py;
    int tx = hx + dx, ty = hy + dy;
    if (!inBounds(st, tx, ty)) return false;
    int targetId = b[tx][ty];

    if (targetId == 0) {
        b[tx][ty] = 1;
        b[hx][hy] = 0;
        st.px = tx; st.py = ty;

        int stackY = hy + 1;
        int hpichi = 0;
        while (stackY < st.h) {
            int id = fg[hx][stackY];
            if (id < 101 || id > 200) break;
            int type = id / 10;
            if (hpichi == 2 && type != 10) break;
            if (hpichi == 1 && type != 11) break;
            if (hpichi == 3 && type != 12) break;
            if (hpichi == 4 && id != 131) break;

            int ny = stackY + dy;
            if (ny < 0 || ny >= st.h) break;
            if (b[tx][ny] == 0) {
                b[tx][ny] = id;
                b[hx][stackY] = 0;
            } else break;

            if (id == 103) hpichi = 2;
            else if (id == 113) hpichi = 1;
            else if (id == 123) hpichi = 3;
            else if (id == 131) hpichi = 4;
            else break;
            stackY++;
        }
        return true;
    }

    if (isEnemy(targetId)) {
        resolveCombat(st, fg, b, tx, ty);
        return true;
    }

    return false;
}

void checkFloorTrigger(State& st, const Grid& b) {
    int floorId = st.bg[st.px][st.py];
    if (floorId == 2) st.form = 1;
    else if (floorId == 3) st.form = 2;
}

void checkWinLoss(State& st, Grid& b) {
    if (st.gameStatus != 0) return;

    bool playerFound = false;
    bool enemyExists = false;
    int px = -1, py = -1;

    for (int x = 0; x < st.w; ++x) {
        for (int y = 0; y < st.h; ++y) {
            int id = b[x][y];
            if (id == 1) { playerFound = true; px = x; py = y; }

            if (id >= 11 && id <= 26) {
                bool hasHeart = false;
                if (y < st.h - 1) {
                    int hId = b[x][y + 1];
                    if (hId >= 101 && hId <= 200) hasHeart = true;
                }

                if (id == 17 || id == 18) {
                    enemyExists = true;
                    if (hasHeart) {
                        if (id == 18) b[x][y] = 25;
                        else if (id == 17) b[x][y] = 16;
                    }
                } else {
                    if (hasHeart) enemyExists = true;
                    else b[x][y] = 0;
                }
            }
        }
    }

    if (playerFound) {
        int check = (st.isInvincible == 1) ? 2 : 1;
        bool hasHeart = false;
        if (py < st.h - 1) {
            int h = b[px][py + 1];
            if (h >= 101 && h <= 200) hasHeart = true;
        }

        if (check == 2) {
            if (hasHeart) st.isInvincible = 0;
        } else {
            if (!hasHeart) {
                b[px][py] = 0;
                st.gameStatus = 2;
            }
        }
    } else {
        st.gameStatus = 2;
    }

    if (st.gameStatus == 0 && !enemyExists) st.gameStatus = 1;
}

bool applyAction(const State& in, char mv, State& out) {
    if (in.gameStatus != 0) return false;
    out = in;

    Grid fg = in.fg;
    Grid b = in.fg;

    int oldDir = out.dir;
    int newDir = oldDir;
    int dx = 0, dy = 0;
    if (mv == 'U') { newDir = RIGHT; dy = 1; }
    else if (mv == 'D') { newDir = LEFT; dy = -1; }
    else if (mv == 'L') { newDir = LEFT; dx = -1; }
    else if (mv == 'R') { newDir = RIGHT; dx = 1; }
    else return false;
    out.dir = newDir;

    bool transformed = false;
    if (out.form == 2 && oldDir != newDir) transformed = processHpHanten(out, fg, b);

    if (out.form == 1) processPush(out, fg, b, dx, dy);

    bool moved = moveBy(out, fg, b, dx, dy);
    if (!(moved || transformed)) return false;

    if (moved) {
        int floorId = out.bg[out.px][out.py];
        if (floorId >= 11 && floorId <= 16) out.colorTheme = floorId - 10;
        checkFloorTrigger(out, b);
    }

    checkWinLoss(out, b);
    out.fg = b;
    return true;
}

bool isSolved(const State& s) {
    if (s.gameStatus == 2) return false;
    if (s.gameStatus == 1) return true;
    for (int x = 0; x < s.w; ++x) for (int y = 0; y < s.h; ++y) if (isEnemy(s.fg[x][y])) return false;
    return true;
}

std::string encode(const State& s) {
    std::string key;
    key.reserve(s.w * s.h * 4 + 32);
    key += std::to_string(s.w) + "," + std::to_string(s.h) + "|"
         + std::to_string(s.form) + "|" + std::to_string(s.dir) + "|" + std::to_string(s.colorTheme) + "|" + std::to_string(s.isInvincible) + "|" + std::to_string(s.gameStatus) + "|";
    for (int y = 0; y < s.h; ++y) for (int x = 0; x < s.w; ++x) {
        key += std::to_string(s.fg[x][y]);
        key.push_back(',');
    }
    return key;
}

State makeAuditState(int px = 2, int py = 2, int form = 1, int w = 14, int h = 14) {
    State s;
    s.resize(w, h);
    s.px = px;
    s.py = py;
    s.form = form;
    s.dir = RIGHT;
    s.fg[px][py] = 1;
    return s;
}

int runRuleAudit() {
    struct Case {
        std::string name;
        bool pass = false;
    };
    std::vector<Case> cases;

    {
        State s = makeAuditState(2, 2, 2);
        s.fg[2][3] = 101;
        State out;
        bool moved = applyAction(s, 'U', out);
        cases.push_back({"pink_up_with_own_heart_blocked", !moved});
    }
    {
        State s = makeAuditState(2, 2, 1);
        s.fg[2][3] = 101;
        State out;
        bool moved = applyAction(s, 'U', out);
        cases.push_back({"silver_up_push_own_heart", moved && out.px == 2 && out.py == 3 && out.fg[2][4] == 101});
    }
    {
        State s = makeAuditState(2, 2, 1);
        s.fg[2][3] = 101;
        s.fg[2][4] = 101;
        State out;
        bool moved = applyAction(s, 'U', out);
        cases.push_back({"silver_up_pushes_vertical_stack", moved && out.px == 2 && out.py == 3 && out.fg[2][4] == 101 && out.fg[2][5] == 101});
    }
    {
        State s = makeAuditState(2, 2, 1);
        s.fg[2][3] = 101;
        s.fg[2][4] = 101;
        s.fg[2][5] = 2;
        State out;
        bool moved = applyAction(s, 'U', out);
        cases.push_back({"silver_up_capped_stack_blocked", !moved});
    }
    {
        State s = makeAuditState(2, 2, 1);
        s.fg[2][3] = 101;
        s.bg[3][2] = 3;
        State out;
        bool moved = applyAction(s, 'R', out);
        cases.push_back({"body_pink_floor_triggers", moved && out.form == 2 && out.px == 3 && out.py == 2});
    }
    {
        State s = makeAuditState(2, 2, 1);
        s.fg[2][3] = 101;
        s.bg[3][3] = 3;
        State out;
        bool moved = applyAction(s, 'R', out);
        cases.push_back({"heart_on_pink_floor_no_trigger", moved && out.form == 1 && out.fg[3][3] == 101});
    }
    {
        State s = makeAuditState(2, 2, 1);
        s.fg[2][3] = 101;
        s.fg[3][3] = 101;
        State out;
        bool moved = applyAction(s, 'R', out);
        cases.push_back({"horizontal_head_target_heart_does_not_block_original", moved && out.px == 3 && out.py == 2 && out.fg[2][3] == 101 && out.fg[3][3] == 101});
    }
    {
        State s = makeAuditState(2, 2, 1);
        s.fg[2][3] = 101;
        s.fg[3][2] = 101;
        State out;
        bool moved = applyAction(s, 'R', out);
        cases.push_back({"silver_pushes_body_target_heart", moved && out.px == 3 && out.py == 2 && out.fg[4][2] == 101});
    }
    {
        State s = makeAuditState(2, 2, 2);
        s.fg[2][3] = 101;
        s.fg[3][2] = 101;
        State out;
        bool moved = applyAction(s, 'R', out);
        cases.push_back({"pink_cannot_push_body_target_heart", !moved && s.fg[3][2] == 101});
    }

    int failed = 0;
    for (const auto& c : cases) {
        std::cout << (c.pass ? "PASS " : "FAIL ") << c.name << "\n";
        if (!c.pass) failed++;
    }
    std::cout << "rule_audit " << (failed == 0 ? "PASS" : "FAIL") << " passed=" << (cases.size() - failed) << "/" << cases.size() << "\n";
    return failed == 0 ? 0 : 1;
}

int runHeadpathOriginalTest() {
    State s;
    s.resize(14, 14);
    s.px = 0;
    s.py = 0;
    s.form = 1;
    s.dir = RIGHT;
    s.fg[0][0] = 1;
    s.fg[0][1] = 101; // original carried heart
    s.fg[1][1] = 101; // Y in the horizontal head target
    s.fg[5][0] = 11;  // keep the game ongoing after the test move
    s.fg[5][1] = 101;

    State out;
    bool moved = applyAction(s, 'R', out);
    std::cout << "headpath_original move=R moved=" << (moved ? 1 : 0) << "\n";
    if (!moved) return 0;

    auto findNext = [&]() {
        const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
        std::string ok;
        for (char mv : moves) {
            State nxt;
            if (applyAction(out, mv, nxt)) ok.push_back(mv);
        }
        return ok;
    };
    std::string next = findNext();

    std::cout << "player=(" << out.px << "," << out.py << ")"
              << " form=" << out.form
              << " gameStatus=" << out.gameStatus << "\n";
    std::cout << "original_own_heart=(0,1) id=" << out.fg[0][1] << "\n";
    std::cout << "Y=(1,1) id=" << out.fg[1][1] << "\n";
    std::cout << "heart_above_player=(1,1) id=" << out.fg[1][1] << "\n";
    std::cout << "next_actions=" << (next.empty() ? "NONE" : next) << "\n";
    if (out.gameStatus == 0 && !next.empty()) {
        std::cout << "headpath_original_result=LIVE_CONTINUES\n";
    } else if (out.gameStatus == 2 || next.empty()) {
        std::cout << "headpath_original_result=FAIL_OR_DEAD_END\n";
    } else {
        std::cout << "headpath_original_result=TERMINAL_STATUS_" << out.gameStatus << "\n";
    }
    return 0;
}

int runBodyTargetLatchSearch() {
    struct Pt {
        int x = 0;
        int y = 0;
        bool operator==(const Pt& other) const { return x == other.x && y == other.y; }
    };
    struct Candidate {
        std::string name;
        Pt u;
        Pt g;
        Pt p;
        Pt o;
        Pt r;
        Pt s;
        Pt c;
        std::vector<Pt> open;
        std::vector<Pt> pink;
        std::vector<Pt> silver;
    };
    auto isHeart = [](int id) { return id >= 101 && id <= 200; };
    auto contains = [](const std::vector<Pt>& pts, Pt p) {
        return std::find_if(pts.begin(), pts.end(), [&](const Pt& q) { return q == p; }) != pts.end();
    };
    auto addUnique = [&](std::vector<Pt>& pts, Pt p) {
        if (!contains(pts, p)) pts.push_back(p);
    };
    auto makeState = [&](const Candidate& cand, Pt player, Pt yPos, int form) {
        State s;
        s.resize(14, 14);
        for (int x = 0; x < s.w; ++x) {
            for (int y = 0; y < s.h; ++y) {
                s.fg[x][y] = 2;
            }
        }
        for (Pt p : cand.open) {
            if (inBounds(s, p.x, p.y)) s.fg[p.x][p.y] = 0;
        }
        for (Pt p : cand.pink) {
            if (inBounds(s, p.x, p.y)) {
                s.bg[p.x][p.y] = 3;
                if (s.fg[p.x][p.y] == 2) s.fg[p.x][p.y] = 0;
            }
        }
        for (Pt p : cand.silver) {
            if (inBounds(s, p.x, p.y)) {
                s.bg[p.x][p.y] = 2;
                if (s.fg[p.x][p.y] == 2) s.fg[p.x][p.y] = 0;
            }
        }
        s.px = player.x;
        s.py = player.y;
        s.form = form;
        s.dir = RIGHT;
        s.fg[player.x][player.y] = 1;
        if (inBounds(s, player.x, player.y + 1)) {
            if (s.fg[player.x][player.y + 1] == 2) s.fg[player.x][player.y + 1] = 0;
            s.fg[player.x][player.y + 1] = 101;
        }
        s.fg[yPos.x][yPos.y] = 101;
        s.fg[12][1] = 11;
        s.fg[12][2] = 101;
        return s;
    };
    auto latchAt = [&](const State& s, Pt p) {
        if (s.px == p.x && s.py + 1 == p.y) return false;
        return isHeart(s.fg[p.x][p.y]);
    };
    auto bfs = [&](const State& start, int maxDepth, const auto& visit) {
        struct Node { State s; std::string path; };
        std::queue<Node> q;
        std::unordered_set<std::string> seen;
        q.push({start, ""});
        seen.insert(encode(start));
        const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
        while (!q.empty()) {
            Node cur = std::move(q.front());
            q.pop();
            if (visit(cur.s, cur.path)) return cur.path;
            if (static_cast<int>(cur.path.size()) >= maxDepth) continue;
            for (char mv : moves) {
                State nxt;
                if (!applyAction(cur.s, mv, nxt)) continue;
                if (nxt.gameStatus != 0) continue;
                std::string key = encode(nxt);
                if (seen.count(key)) continue;
                seen.insert(std::move(key));
                q.push({std::move(nxt), cur.path + mv});
            }
        }
        return std::string();
    };
    auto canReach = [&](const State& start, int maxDepth, const auto& pred) {
        std::string path = bfs(start, maxDepth, pred);
        return std::make_pair(!path.empty(), path);
    };

    std::vector<Candidate> candidates;
    for (int pocketDy : {-1, 1}) {
        Candidate c;
        c.name = pocketDy > 0 ? "pocket-above-ring" : "pocket-below-ring";
        c.u = {3, 4};
        c.g = {4, 4};
        c.p = {4, 4 + pocketDy};
        c.o = {4, 4 - pocketDy};
        c.r = {4, 4 + 2 * pocketDy};
        c.s = c.g;
        c.c = c.p;
        for (Pt p : {c.u, c.g, c.p, c.o, c.r, c.s, c.c}) addUnique(c.open, p);
        for (int x = 2; x <= 6; ++x) {
            for (int y = 2; y <= 6; ++y) {
                if (x == 5 && y == 4) continue; // closed use-side push backing wall
                if (x == 4 && y == 4 + pocketDy) continue; // latch pocket occupied
                addUnique(c.open, {x, y});
            }
        }
        c.pink.push_back(c.g);
        c.silver.push_back({2, 4});
        candidates.push_back(c);
    }

    int found = 0;
    for (const auto& cand : candidates) {
        State closedUse = makeState(cand, cand.u, cand.g, 1);
        auto closedPass = canReach(closedUse, 12, [&](const State& s, const std::string&) {
            return s.px == cand.c.x && s.py == cand.c.y;
        });

        State closedOpen = makeState(cand, cand.o, cand.g, 1);
        auto openOk = canReach(closedOpen, 12, [&](const State& s, const std::string&) {
            return latchAt(s, cand.p) && s.px == cand.s.x && s.py == cand.s.y;
        });
        auto openLeaksCarry = canReach(closedOpen, 12, [&](const State& s, const std::string&) {
            return s.px == cand.c.x && s.py == cand.c.y && !latchAt(s, cand.g);
        });

        State openUse = makeState(cand, cand.u, cand.p, 1);
        auto resetOk = canReach(openUse, 16, [&](const State& s, const std::string&) {
            return latchAt(s, cand.g) && s.px == cand.c.x && s.py == cand.c.y;
        });

        bool pass = !closedPass.first && openOk.first && !openLeaksCarry.first && resetOk.first;
        std::cout << "body_latch_candidate " << cand.name << " " << (pass ? "PASS" : "FAIL") << "\n"
                  << "  closed_use_reaches_carry=" << (closedPass.first ? 1 : 0)
                  << (closedPass.first ? " path=" + closedPass.second : "") << "\n"
                  << "  open_side_opens=" << (openOk.first ? 1 : 0)
                  << (openOk.first ? " path=" + openOk.second : "") << "\n"
                  << "  open_side_leaks_carry=" << (openLeaksCarry.first ? 1 : 0)
                  << (openLeaksCarry.first ? " path=" + openLeaksCarry.second : "") << "\n"
                  << "  open_use_resets=" << (resetOk.first ? 1 : 0)
                  << (resetOk.first ? " path=" + resetOk.second : "") << "\n";
        if (pass) found++;
    }
    std::cout << "body_latch_search found=" << found << "/" << candidates.size() << "\n";
    return found > 0 ? 0 : 1;
}

int runParkingHoleLExitSearch() {
    struct Pt {
        int x = 0;
        int y = 0;
        bool operator==(const Pt& other) const { return x == other.x && y == other.y; }
    };
    auto isHeart = [](int id) { return id >= 101 && id <= 200; };

    const Pt G{5, 5};
    const Pt P{5, 6};
    const Pt H{6, 5};
    const Pt L{6, 4};
    const Pt E{6, 3};
    const Pt S{7, 4};
    const Pt M{7, 5};
    const Pt S2{8, 4};
    const Pt C{5, 7};

    auto putOpen = [](State& s, Pt p) {
        if (inBounds(s, p.x, p.y) && s.fg[p.x][p.y] == 2) s.fg[p.x][p.y] = 0;
    };
    auto makeBase = [&](bool openInput) {
        State s;
        s.resize(14, 14);
        for (int x = 0; x < s.w; ++x) {
            for (int y = 0; y < s.h; ++y) s.fg[x][y] = 2;
        }

        const std::vector<Pt> openCells{
            G, P, H, L, E, S, M, S2,
            {7, 3}, {8, 3}, {8, 5}, {8, 6}, {8, 7},
            {7, 6}, {7, 7}, {6, 6}, {6, 7}, C, {5, 8}
        };
        for (Pt p : openCells) putOpen(s, p);

        s.bg[7][3] = 2; // Once the carry branch is entered, allow vertical climbing.

        s.px = L.x;
        s.py = L.y;
        s.dir = RIGHT;
        s.form = openInput ? 1 : 2; // open branch is silver; reset branch is still pink at L.
        s.fg[L.x][L.y] = 1;
        s.fg[H.x][H.y] = 101;
        if (openInput) {
            s.fg[P.x][P.y] = 101;
            s.fg[G.x][G.y] = 0;
        } else {
            s.fg[P.x][P.y] = 0;
            s.fg[G.x][G.y] = 101;
        }

        s.fg[M.x][M.y] = 101;   // roof-heart blocker for stop.
        s.fg[S.x][S.y] = 101;   // body-target gate: silver can push it, pink cannot.
        s.fg[S2.x][S2.y] = 0;   // room for the stop gate heart to be pushed.
        s.fg[4][6] = 2;         // cap P from the left; occupied P blocks silver too.

        s.fg[11][1] = 11;       // keep the game ongoing.
        s.fg[11][2] = 101;
        return s;
    };

    auto heartAt = [&](const State& s, Pt p) {
        return isHeart(s.fg[p.x][p.y]);
    };
    auto latch = [&](const State& s) {
        std::ostringstream os;
        os << "P=" << (heartAt(s, P) ? 1 : 0)
           << " G=" << (heartAt(s, G) ? 1 : 0)
           << " H=" << (heartAt(s, H) ? 1 : 0)
           << " player=(" << s.px << "," << s.py << ")"
           << " form=" << s.form
           << " status=" << s.gameStatus;
        return os.str();
    };
    auto isAStop = [&](const State& s) {
        return s.gameStatus == 0 && s.px == S.x && s.py == S.y &&
               heartAt(s, P) && !heartAt(s, G) && heartAt(s, H);
    };
    auto isBCarry = [&](const State& s) {
        return s.gameStatus == 0 && s.px == C.x && s.py == C.y &&
               !heartAt(s, P) && heartAt(s, G) && !heartAt(s, H);
    };
    auto isACorrupt = [&](const State& s) {
        if (s.gameStatus != 0) return false;
        const bool aLatch = heartAt(s, P) && !heartAt(s, G) && heartAt(s, H);
        return !aLatch && !isAStop(s);
    };
    auto stepPath = [&](State s, const std::string& path) {
        bool ok = true;
        for (char mv : path) {
            State next;
            if (!applyAction(s, mv, next)) {
                ok = false;
                break;
            }
            s = next;
            if (s.gameStatus != 0) break;
        }
        return std::make_pair(ok, s);
    };
    auto bfs = [&](const State& start, int maxDepth, const auto& pred) {
        struct Node { State s; std::string path; };
        std::queue<Node> q;
        std::unordered_set<std::string> seen;
        q.push({start, ""});
        seen.insert(encode(start));
        const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
        while (!q.empty()) {
            Node cur = std::move(q.front());
            q.pop();
            if (pred(cur.s, cur.path)) return std::make_pair(true, cur.path);
            if (static_cast<int>(cur.path.size()) >= maxDepth) continue;
            for (char mv : moves) {
                State nxt;
                if (!applyAction(cur.s, mv, nxt)) continue;
                if (nxt.gameStatus != 0) continue;
                std::string key = encode(nxt);
                if (seen.count(key)) continue;
                seen.insert(std::move(key));
                q.push({std::move(nxt), cur.path + mv});
            }
        }
        return std::make_pair(false, std::string());
    };

    const State a0 = makeBase(true);
    const State b0 = makeBase(false);

    auto aStop = stepPath(a0, "R");
    auto bStop = stepPath(b0, "R");
    const std::string carryPath = "DRRUUULLLU";
    auto bCarry = stepPath(b0, carryPath);
    auto aCarryAttempt = stepPath(a0, carryPath);

    auto aValidStop = bfs(a0, 12, [&](const State& s, const std::string&) { return isAStop(s); });
    auto bValidCarry = bfs(b0, 14, [&](const State& s, const std::string&) { return isBCarry(s); });
    auto aValidCarryLeak = bfs(a0, 14, [&](const State& s, const std::string&) { return isBCarry(s); });
    auto aFirstCorrupt = bfs(a0, 4, [&](const State& s, const std::string& path) {
        return !path.empty() && isACorrupt(s);
    });
    auto bAnyStop = bfs(b0, 10, [&](const State& s, const std::string&) {
        return s.px == S.x && s.py == S.y;
    });

    std::cout << "parking_l_exit_candidate p-gate-carry\n"
              << "  A_direct_stop path=R ok=" << (aStop.first ? 1 : 0)
              << " valid=" << (isAStop(aStop.second) ? 1 : 0)
              << " " << latch(aStop.second) << "\n"
              << "  B_direct_stop path=R moved=" << (bStop.first ? 1 : 0)
              << " " << latch(bStop.second) << "\n"
              << "  B_direct_carry path=" << carryPath
              << " ok=" << (bCarry.first ? 1 : 0)
              << " valid=" << (isBCarry(bCarry.second) ? 1 : 0)
              << " " << latch(bCarry.second) << "\n"
              << "  A_same_carry_path path=" << carryPath
              << " ok=" << (aCarryAttempt.first ? 1 : 0)
              << " valid_carry=" << (isBCarry(aCarryAttempt.second) ? 1 : 0)
              << " " << latch(aCarryAttempt.second) << "\n"
              << "  bfs_A_valid_stop=" << (aValidStop.first ? 1 : 0)
              << (aValidStop.first ? " path=" + aValidStop.second : "") << "\n"
              << "  bfs_B_valid_carry=" << (bValidCarry.first ? 1 : 0)
              << (bValidCarry.first ? " path=" + bValidCarry.second : "") << "\n"
              << "  bfs_A_valid_carry_leak=" << (aValidCarryLeak.first ? 1 : 0)
              << (aValidCarryLeak.first ? " path=" + aValidCarryLeak.second : "") << "\n"
              << "  bfs_A_first_live_corruption=" << (aFirstCorrupt.first ? 1 : 0)
              << (aFirstCorrupt.first ? " path=" + aFirstCorrupt.second : "") << "\n"
              << "  bfs_B_reaches_stop_cell=" << (bAnyStop.first ? 1 : 0)
              << (bAnyStop.first ? " path=" + bAnyStop.second : "") << "\n";

    struct EVariant {
        std::string name;
        int eId = 0;
        int belowId = 2;
    };
    const std::vector<EVariant> eVariants{
        {"empty", 0, 2},
        {"wall", 2, 2},
        {"heart_with_space", 101, 0},
        {"heart_capped", 101, 2},
    };
    std::cout << "  e_target_polarity\n";
    for (const auto& v : eVariants) {
        State a = makeBase(true);
        State b = makeBase(false);
        a.fg[E.x][E.y] = v.eId;
        b.fg[E.x][E.y] = v.eId;
        a.fg[E.x][E.y - 1] = v.belowId;
        b.fg[E.x][E.y - 1] = v.belowId;
        State an, bn;
        bool am = applyAction(a, 'D', an);
        bool bm = applyAction(b, 'D', bn);
        std::cout << "    " << v.name
                  << " A_D=" << (am && an.gameStatus == 0 ? 1 : 0)
                  << " B_D=" << (bm && bn.gameStatus == 0 ? 1 : 0)
                  << "\n";
    }

    const bool passRightGate = aStop.first && isAStop(aStop.second) &&
                      !bStop.first &&
                      bCarry.first && isBCarry(bCarry.second) &&
                      !aValidCarryLeak.first &&
                      !aFirstCorrupt.first &&
                      !bAnyStop.first;

    const Pt C2 = P;
    auto makeLeftRoofGate = [&](bool openInput) {
        State s;
        s.resize(14, 14);
        for (int x = 0; x < s.w; ++x) {
            for (int y = 0; y < s.h; ++y) s.fg[x][y] = 2;
        }

        const std::vector<Pt> openCells{
            G, P, H, L, E, S, M, S2,
            {5, 3}, {5, 4},
            {4, 3}, {4, 4}, {4, 6}, {4, 7},
            {3, 3}, {3, 4}, {3, 5}, {3, 6}, {3, 7},
            {5, 7}
        };
        for (Pt p : openCells) putOpen(s, p);

        s.bg[E.x][E.y] = 3;
        s.bg[5][3] = 3;
        s.bg[4][3] = 3;
        s.bg[3][3] = 2; // Delay silver until after the forced left turns, blocking E->U backflow.

        s.px = L.x;
        s.py = L.y;
        s.dir = RIGHT;
        s.form = openInput ? 1 : 2;
        s.fg[L.x][L.y] = 1;
        s.fg[H.x][H.y] = 101;
        if (openInput) {
            s.fg[P.x][P.y] = 101;
            s.fg[G.x][G.y] = 0;
        } else {
            s.fg[P.x][P.y] = 0;
            s.fg[G.x][G.y] = 101;
        }

        s.fg[M.x][M.y] = 101;
        s.fg[S.x][S.y] = 101;
        s.fg[S2.x][S2.y] = 0;
        s.fg[5][4] = 101;
        s.fg[4][4] = 101;
        s.fg[3][4] = 101;
        // (6,6) intentionally remains a wall: it caps P for A and blocks A's immediate U.

        s.fg[11][1] = 11;
        s.fg[11][2] = 101;
        return s;
    };
    auto isBCarry2 = [&](const State& s) {
        return s.gameStatus == 0 && s.px == C2.x && s.py == C2.y &&
               !heartAt(s, P) && heartAt(s, G) && !heartAt(s, H);
    };
    auto isAStop2 = [&](const State& s) {
        return s.gameStatus == 0 && s.px == S.x && s.py == S.y &&
               heartAt(s, P) && !heartAt(s, G) && heartAt(s, H);
    };
    auto isAExitLeak2 = [&](const State& s) {
        if (s.gameStatus != 0) return false;
        if (isAStop2(s)) return false;
        return (s.px == S.x && s.py == S.y) || (s.px == C2.x && s.py == C2.y);
    };

    const State a2 = makeLeftRoofGate(true);
    const State b2 = makeLeftRoofGate(false);
    const std::string carryPath2 = "DLLLUUURR";
    auto a2Stop = stepPath(a2, "R");
    auto b2Stop = stepPath(b2, "R");
    auto b2Carry = stepPath(b2, carryPath2);
    auto a2CarryAttempt = stepPath(a2, carryPath2);
    auto a2ValidStop = bfs(a2, 24, [&](const State& s, const std::string&) { return isAStop2(s); });
    auto b2ValidCarry = bfs(b2, 24, [&](const State& s, const std::string&) { return isBCarry2(s); });
    auto a2ExitLeak = bfs(a2, 30, [&](const State& s, const std::string& path) {
        return !path.empty() && isAExitLeak2(s);
    });
    auto b2StopLeak = bfs(b2, 30, [&](const State& s, const std::string&) {
        return s.px == S.x && s.py == S.y;
    });
    auto a2FirstCorrupt = bfs(a2, 4, [&](const State& s, const std::string& path) {
        return !path.empty() && isACorrupt(s);
    });

    std::cout << "parking_l_exit_candidate left-roof-p-gate\n"
              << "  A_direct_stop path=R ok=" << (a2Stop.first ? 1 : 0)
              << " valid=" << (isAStop2(a2Stop.second) ? 1 : 0)
              << " " << latch(a2Stop.second) << "\n"
              << "  B_direct_stop path=R moved=" << (b2Stop.first ? 1 : 0)
              << " " << latch(b2Stop.second) << "\n"
              << "  B_direct_carry path=" << carryPath2
              << " ok=" << (b2Carry.first ? 1 : 0)
              << " valid=" << (isBCarry2(b2Carry.second) ? 1 : 0)
              << " " << latch(b2Carry.second) << "\n"
              << "  A_same_carry_path path=" << carryPath2
              << " ok=" << (a2CarryAttempt.first ? 1 : 0)
              << " valid_carry=" << (isBCarry2(a2CarryAttempt.second) ? 1 : 0)
              << " " << latch(a2CarryAttempt.second) << "\n"
              << "  bfs_A_valid_stop=" << (a2ValidStop.first ? 1 : 0)
              << (a2ValidStop.first ? " path=" + a2ValidStop.second : "") << "\n"
              << "  bfs_B_valid_carry=" << (b2ValidCarry.first ? 1 : 0)
              << (b2ValidCarry.first ? " path=" + b2ValidCarry.second : "") << "\n"
              << "  bfs_A_exit_leak=" << (a2ExitLeak.first ? 1 : 0)
              << (a2ExitLeak.first ? " path=" + a2ExitLeak.second : "") << "\n"
              << "  bfs_B_reaches_stop_cell=" << (b2StopLeak.first ? 1 : 0)
              << (b2StopLeak.first ? " path=" + b2StopLeak.second : "") << "\n"
              << "  bfs_A_first_live_corruption=" << (a2FirstCorrupt.first ? 1 : 0)
              << (a2FirstCorrupt.first ? " path=" + a2FirstCorrupt.second : "") << "\n";

    const bool passLeftRoofGate = a2Stop.first && isAStop2(a2Stop.second) &&
                                  !b2Stop.first &&
                                  b2Carry.first && isBCarry2(b2Carry.second) &&
                                  !a2ExitLeak.first &&
                                  !b2StopLeak.first;
    const bool pass = passRightGate || passLeftRoofGate;
    std::cout << "parking_l_exit_discriminator " << (pass ? "PASS" : "FAIL") << "\n";
    return pass ? 0 : 1;
}

int runTerminalDiodeAudit() {
    struct Pt { int x = 0; int y = 0; };
    const int sx = 3;
    const int sy = 4;
    const Pt source{sx, sy};
    const Pt target{sx + 5, sy - 2};
    const std::vector<Pt> relOpen{
        {0,0},
        {1,0},{1,1},{1,2},
        {2,1},{2,2},
        {3,1},{3,2},
        {4,1},{4,2},
        {5,1},{5,2},{5,0},{5,-1},{5,-2}
    };
    auto makeState = [&](Pt player, int form) {
        State s;
        s.resize(14, 14);
        for (int x = 0; x < s.w; ++x) {
            for (int y = 0; y < s.h; ++y) s.fg[x][y] = 2;
        }
        for (Pt r : relOpen) {
            int x = sx + r.x;
            int y = sy + r.y;
            if (inBounds(s, x, y)) s.fg[x][y] = 0;
        }
        s.bg[sx + 1][sy] = 2;
        s.bg[sx + 5][sy - 2] = 2;
        s.bg[sx + 5][sy - 1] = 3;
        s.px = player.x;
        s.py = player.y;
        s.form = form;
        s.dir = RIGHT;
        s.fg[player.x][player.y] = 1;
        if (inBounds(s, player.x, player.y + 1)) {
            if (s.fg[player.x][player.y + 1] == 2) s.fg[player.x][player.y + 1] = 0;
            s.fg[player.x][player.y + 1] = 101;
        }
        s.fg[12][1] = 11;
        s.fg[12][2] = 101;
        return s;
    };
    auto bfsReach = [&](const State& start, Pt goal, int maxDepth) {
        struct Node { State s; std::string path; };
        std::queue<Node> q;
        std::unordered_set<std::string> seen;
        q.push({start, ""});
        seen.insert(encode(start));
        const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
        while (!q.empty()) {
            Node cur = std::move(q.front());
            q.pop();
            if (cur.s.px == goal.x && cur.s.py == goal.y) return std::make_pair(true, cur.path);
            if (static_cast<int>(cur.path.size()) >= maxDepth) continue;
            for (char mv : moves) {
                State nxt;
                if (!applyAction(cur.s, mv, nxt)) continue;
                if (nxt.gameStatus != 0) continue;
                std::string key = encode(nxt);
                if (seen.count(key)) continue;
                seen.insert(std::move(key));
                q.push({std::move(nxt), cur.path + mv});
            }
        }
        return std::make_pair(false, std::string());
    };

    auto forward = bfsReach(makeState(source, 2), target, 20);
    auto reverseSilver = bfsReach(makeState(target, 1), source, 20);
    auto reversePink = bfsReach(makeState(target, 2), source, 20);
    auto reverseGateSilver = bfsReach(makeState({sx + 5, sy - 1}, 1), source, 20);
    State direct = makeState(source, 2);
    bool directOk = true;
    std::string directPath = "RURRRRDDD";
    for (char mv : directPath) {
        State next;
        if (!applyAction(direct, mv, next)) {
            directOk = false;
            break;
        }
        direct = next;
        if (direct.gameStatus != 0) break;
    }

    bool pass = forward.first && !reverseSilver.first && !reversePink.first && !reverseGateSilver.first;
    std::cout << "terminal_diode_audit " << (pass ? "PASS" : "FAIL") << "\n"
              << "  direct_reference path=" << directPath
              << " ok=" << (directOk ? 1 : 0)
              << " player=(" << direct.px << "," << direct.py << ")"
              << " form=" << direct.form
              << " gameStatus=" << direct.gameStatus << "\n"
              << "  forward_from_source_pink reaches_target=" << (forward.first ? 1 : 0)
              << (forward.first ? " dist=" + std::to_string(forward.second.size()) + " path=" + forward.second : "") << "\n"
              << "  reverse_from_target_silver reaches_source=" << (reverseSilver.first ? 1 : 0)
              << (reverseSilver.first ? " path=" + reverseSilver.second : "") << "\n"
              << "  reverse_from_target_pink reaches_source=" << (reversePink.first ? 1 : 0)
              << (reversePink.first ? " path=" + reversePink.second : "") << "\n"
              << "  reverse_from_pink_gate_silver reaches_source=" << (reverseGateSilver.first ? 1 : 0)
              << (reverseGateSilver.first ? " path=" + reverseGateSilver.second : "") << "\n";
    return pass ? 0 : 1;
}

// Helper: find a quoted string field value in a block
static std::string findStrField(const std::string& block, const std::string& key) {
    std::string needle = "\"" + key + "\"";
    size_t pos = block.find(needle);
    if (pos == std::string::npos) return "";
    pos = block.find('"', pos + needle.size());
    if (pos == std::string::npos) return "";
    size_t end = block.find('"', pos + 1);
    if (end == std::string::npos) return "";
    return block.substr(pos + 1, end - pos - 1);
}

// Helper: find a boolean field value in a block
static bool findBoolField(const std::string& block, const std::string& key, bool defaultVal) {
    std::string needle = "\"" + key + "\"";
    size_t pos = block.find(needle);
    if (pos == std::string::npos) return defaultVal;
    pos += needle.size();
    while (pos < block.size() && (block[pos] == ' ' || block[pos] == ':' || block[pos] == '\t')) pos++;
    if (pos + 4 <= block.size() && block.substr(pos, 4) == "true") return true;
    if (pos + 5 <= block.size() && block.substr(pos, 5) == "false") return false;
    return defaultVal;
}

} // namespace bugma

#include "search_algorithms.hpp"

struct ReplayRecord {
    bool cleared = true;
    int bestSteps = 0;
    std::string replay;
    std::string solverAlgorithm;
    int expanded = 0;
    long long elapsedMs = 0;
    long long updatedAt = 0;
    std::string source;
};

struct OfficialEntry {
    int label = 0;               // UI label 1..101
    std::string id;              // base id in ALL_LEVELS
    int colorOverride = 0;       // 0 means no override
    std::string saveKey;         // id or id_cX
};

static std::string levelKey(const std::string& id, int colorOverride) {
    return colorOverride > 0 ? id + "_c" + std::to_string(colorOverride) : id;
}

static std::vector<OfficialEntry> buildOfficialManifest(const std::unordered_map<std::string, bugma::Level>& officialLevels) {
    std::vector<OfficialEntry> out;
    for (int i = 1; i <= 52; ++i) {
        OfficialEntry e;
        e.label = i;
        e.id = std::to_string(i);
        auto it = officialLevels.find(e.id);
        if (it != officialLevels.end()) e.colorOverride = it->second.color;
        e.saveKey = levelKey(e.id, e.colorOverride);
        out.push_back(std::move(e));
    }

    OfficialEntry egg;
    egg.label = 53;
    egg.id = "53";
    egg.saveKey = "53";
    out.push_back(std::move(egg));

    const std::array<int, 7> baseIds{{61, 62, 63, 64, 65, 66, 67}};
    const std::array<int, 5> colors{{1, 2, 3, 4, 6}};
    int label = 54;
    for (int c : colors) {
        for (int bid : baseIds) {
            OfficialEntry e;
            e.label = label++;
            e.id = std::to_string(bid);
            e.colorOverride = c;
            e.saveKey = levelKey(e.id, c);
            out.push_back(std::move(e));
        }
    }

    for (int i = 81; i <= 93; ++i) {
        OfficialEntry e;
        e.label = label++;
        e.id = std::to_string(i);
        e.saveKey = e.id;
        out.push_back(std::move(e));
    }

    return out;
}

static std::vector<int> parseNumericSelector(const std::string& input) {
    std::vector<int> out;
    if (input.empty() || input == "all" || input == "ALL" || input == "unsolved" || input == "UNSOLVED" || input == "ALL_UNSOLVED") return out;

    std::stringstream ss(input);
    std::string token;
    while (std::getline(ss, token, ',')) {
        if (token.empty()) continue;
        auto dash = token.find('-');
        if (dash == std::string::npos) {
            out.push_back(std::stoi(token));
        } else {
            int l = std::stoi(token.substr(0, dash));
            int r = std::stoi(token.substr(dash + 1));
            if (l > r) std::swap(l, r);
            for (int x = l; x <= r; ++x) out.push_back(x);
        }
    }
    return out;
}

static std::string mergeIntervals(const std::vector<int>& nums) {
    if (nums.empty()) return "(none)";
    std::vector<int> a = nums;
    std::sort(a.begin(), a.end());
    a.erase(std::unique(a.begin(), a.end()), a.end());

    std::ostringstream os;
    int st = a[0], ed = a[0];
    bool first = true;
    for (size_t i = 1; i < a.size(); ++i) {
        if (a[i] == ed + 1) {
            ed = a[i];
        } else {
            if (!first) os << ",";
            if (st == ed) os << st;
            else os << st << "-" << ed;
            first = false;
            st = ed = a[i];
        }
    }
    if (!first) os << ",";
    if (st == ed) os << st;
    else os << st << "-" << ed;
    return os.str();
}


static size_t findMatchingBrace(const std::string& s, size_t openPos) {
    int depth = 0;
    bool inString = false;
    for (size_t i = openPos; i < s.size(); ++i) {
        char c = s[i];
        if (inString) {
            if (c == '\\') ++i;
            else if (c == '"') inString = false;
            continue;
        }
        if (c == '"') {
            inString = true;
            continue;
        }
        if (c == '{') depth++;
        else if (c == '}') {
            depth--;
            if (depth == 0) return i;
        }
    }
    return std::string::npos;
}

static std::map<std::string, ReplayRecord> parseExistingSave(const std::string& text) {
    std::map<std::string, ReplayRecord> out;
    if (text.empty()) return out;

    size_t levelsKey = text.find("\"levels\"");
    if (levelsKey == std::string::npos) return out;
    size_t objStart = text.find('{', levelsKey);
    if (objStart == std::string::npos) return out;
    size_t objEnd = findMatchingBrace(text, objStart);
    if (objEnd == std::string::npos || objEnd <= objStart) return out;

    std::string body = text.substr(objStart + 1, objEnd - objStart - 1);

    // Manual parser: iterate through "key": { ... } entries
    size_t pos = 0;
    while (pos < body.size()) {
        size_t q1 = body.find('"', pos);
        if (q1 == std::string::npos) break;
        size_t q2 = body.find('"', q1 + 1);
        if (q2 == std::string::npos) break;
        std::string key = body.substr(q1 + 1, q2 - q1 - 1);

        size_t after = q2 + 1;
        while (after < body.size() && (body[after] == ' ' || body[after] == ':' || body[after] == '\t' || body[after] == '\n' || body[after] == '\r')) after++;
        if (after >= body.size() || body[after] != '{') { pos = q2 + 1; continue; }

        size_t entryStart = after;
        size_t entryEnd = findMatchingBrace(body, entryStart);
        if (entryEnd == std::string::npos) break;

        std::string obj = body.substr(entryStart, entryEnd - entryStart + 1);

        ReplayRecord rec;
        rec.replay = bugma::findStrField(obj, "replay");
        rec.bestSteps = bugma::findIntField(obj, "bestSteps", 0);
        rec.cleared = bugma::findBoolField(obj, "cleared", true);
        rec.solverAlgorithm = bugma::findStrField(obj, "solverAlgorithm");
        rec.expanded = bugma::findIntField(obj, "expanded", 0);
        rec.elapsedMs = static_cast<long long>(bugma::findIntField(obj, "elapsedMs", 0));
        rec.updatedAt = static_cast<long long>(bugma::findIntField(obj, "updatedAt", 0));
        rec.source = bugma::findStrField(obj, "source");

        if (!rec.replay.empty()) {
            std::transform(rec.replay.begin(), rec.replay.end(), rec.replay.begin(), [](unsigned char c) {
                return static_cast<char>(std::toupper(c));
            });
        }
        out[key] = rec;
        pos = entryEnd + 1;
    }
    return out;
}

static void writeSolverSaveJson(const std::string& path, const std::map<std::string, ReplayRecord>& recs) {
    std::ofstream ofs(path, std::ios::binary);
    const auto now = std::chrono::time_point_cast<std::chrono::milliseconds>(
                         std::chrono::system_clock::now())
                         .time_since_epoch()
                         .count();

    ofs << "{\n"
        << "  \"version\": 1,\n"
        << "  \"timestamp\": " << now << ",\n"
        << "  \"game\": \"BanmenHTML5\",\n"
        << "  \"content\": {\n"
        << "    \"levels\": {\n";

    bool first = true;
    for (const auto& kv : recs) {
        if (!first) ofs << ",\n";
        first = false;
        ofs << "      \"" << kv.first << "\": {\n"
            << "        \"cleared\": " << (kv.second.cleared ? "true" : "false") << ",\n"
            << "        \"bestSteps\": " << kv.second.bestSteps << ",\n"
            << "        \"replay\": \"" << kv.second.replay << "\",\n"
            << "        \"solverAlgorithm\": \"" << kv.second.solverAlgorithm << "\",\n"
            << "        \"expanded\": " << kv.second.expanded << ",\n"
            << "        \"elapsedMs\": " << kv.second.elapsedMs << ",\n"
            << "        \"updatedAt\": " << kv.second.updatedAt << ",\n"
            << "        \"source\": \"" << kv.second.source << "\"\n"
            << "      }";
    }
    ofs << "\n    }\n  }\n}\n";
}

static void writeSolverSaveJs(const std::string& path, const std::map<std::string, ReplayRecord>& recs) {
    std::ofstream ofs(path, std::ios::binary);
    ofs << "// Auto-generated by cpp/build/bugma_solver interactive mode\n"
        << "const SOLVER_SAVE = {\n"
        << "  \"version\": 1,\n"
        << "  \"game\": \"BanmenHTML5\",\n"
        << "  \"content\": {\n"
        << "    \"levels\": {\n";
    bool first = true;
    for (const auto& kv : recs) {
        if (!first) ofs << ",\n";
        first = false;
        ofs << "      \"" << kv.first << "\": {\"cleared\": " << (kv.second.cleared ? "true" : "false")
            << ", \"bestSteps\": " << kv.second.bestSteps
            << ", \"replay\": \"" << kv.second.replay << "\""
            << ", \"solverAlgorithm\": \"" << kv.second.solverAlgorithm << "\""
            << ", \"expanded\": " << kv.second.expanded
            << ", \"elapsedMs\": " << kv.second.elapsedMs
            << ", \"updatedAt\": " << kv.second.updatedAt
            << ", \"source\": \"" << kv.second.source << "\"}";
    }
    ofs << "\n    }\n  }\n};\n";
}

struct LevelPacks {
    std::unordered_map<std::string, bugma::Level> official;
    std::unordered_map<std::string, bugma::Level> random;
    std::unordered_map<std::string, bugma::Level> custom;
};

static LevelPacks loadLevelPacks() {
    LevelPacks packs;

    if (auto textOpt = bugma::readFile("js/levels.js"); textOpt) {
        packs.official = bugma::parseLevels(*textOpt);
    } else {
        throw std::runtime_error("Cannot read js/levels.js");
    }

    if (auto randomOpt = bugma::readFile("js/generated_levels.js"); randomOpt) {
        packs.random = bugma::parseLevels(*randomOpt);
    } else {
        throw std::runtime_error("Cannot read js/generated_levels.js");
    }

    if (auto customOpt = bugma::readFile("js/custom_levels.js"); customOpt) {
        packs.custom = bugma::parseLevels(*customOpt);
    }

    if (auto experimentalOpt = bugma::readFile("cpp/generated/counter_test_levels.js"); experimentalOpt) {
        auto experimental = bugma::parseLevels(*experimentalOpt);
        for (auto& kv : experimental) packs.custom[kv.first] = std::move(kv.second);
    }

    return packs;
}

static std::unordered_map<std::string, bugma::Level> mergeAllLevels(const LevelPacks& packs) {
    auto merged = packs.random;
    for (const auto& kv : packs.official) merged[kv.first] = kv.second;
    for (const auto& kv : packs.custom) merged[kv.first] = kv.second;
    return merged;
}

static void printAlgorithmIntro() {
    std::cout
        << "\n[Algorithm] Solver supports BFS / A* / Beam / MHA* / ARA* / RR-A* over full game state.\n"
        << "- State includes grid, form, direction, color theme, invincible flag, status.\n"
        << "- Each node expands 4 actions (U/D/L/R) via full turn-resolution mechanics.\n"
        << "- BFS guarantees shortest-step solution under current rules when found; heuristic methods are faster on large spaces but not always shortest.\n"
        << "- maxNodes controls search budget (expanded nodes cap).\n\n";
}

static int runCounterAudit(const std::string& levelId, int maxNodes, int activeBits) {
    auto levels = mergeAllLevels(loadLevelPacks());
    auto it = levels.find(levelId);
    if (it == levels.end()) {
        std::cerr << "Level not found: " << levelId << "\n";
        return 2;
    }

    struct BitPos { int qx = 0; int px = 0; int y = 0; };
    const std::array<BitPos, 2> bits{{{12, 13, 14}, {64, 65, 14}}};
    activeBits = std::max(1, std::min(activeBits, static_cast<int>(bits.size())));
    std::vector<std::pair<int, int>> forbiddenBodyCells;
    for (int i = 0; i < activeBits; ++i) {
        forbiddenBodyCells.push_back({bits[i].qx, bits[i].y - 1});
        forbiddenBodyCells.push_back({bits[i].qx, bits[i].y - 2});
    }
    auto isHeart = [](int id) { return id >= 101 && id <= 200; };
    auto isPlayerHead = [&](const bugma::State& s, int x, int y) {
        return x == s.px && y == s.py + 1;
    };
    auto maskOf = [&](const bugma::State& s) {
        int mask = 0;
        for (int i = 0; i < activeBits; ++i) {
            bool q = isHeart(s.fg[bits[i].qx][bits[i].y]) && !isPlayerHead(s, bits[i].qx, bits[i].y);
            bool p = isHeart(s.fg[bits[i].px][bits[i].y]) && !isPlayerHead(s, bits[i].px, bits[i].y);
            if (q == p) return -1;
            if (p) mask |= (1 << i);
        }
        return mask;
    };
    auto coord = [](int x, int y) {
        return "(" + std::to_string(x) + "," + std::to_string(y) + ")";
    };
    auto bitSummary = [&](const bugma::State& s, int bit) {
        const auto& b = bits[bit];
        std::vector<std::string> parts;
        if (isHeart(s.fg[b.qx][b.y]) && !isPlayerHead(s, b.qx, b.y)) parts.push_back("Q" + coord(b.qx, b.y));
        if (isHeart(s.fg[b.px][b.y]) && !isPlayerHead(s, b.px, b.y)) parts.push_back("P" + coord(b.px, b.y));

        int x1 = bit == 0 ? 8 : 60;
        int x2 = bit == 0 ? 30 : 82;
        int y1 = 8;
        int y2 = 20;
        for (int x = x1; x <= x2 && x < s.w; ++x) {
            for (int y = y1; y <= y2 && y < s.h; ++y) {
                if (!isHeart(s.fg[x][y])) continue;
                if ((x == b.qx || x == b.px) && y == b.y) continue;
                if (x == s.px && y == s.py + 1) continue;
                parts.push_back(coord(x, y) + ":" + std::to_string(s.fg[x][y]));
            }
        }
        if (parts.empty()) return std::string("missing-in-window");
        std::string out;
        for (size_t i = 0; i < parts.size(); ++i) {
            if (i) out += ",";
            out += parts[i];
        }
        return out;
    };
    auto stateSummary = [&](const bugma::State& s) {
        std::string out = "player=" + coord(s.px, s.py)
                        + " form=" + std::to_string(s.form)
                        + " dir=" + std::to_string(s.dir);
        for (int i = 0; i < activeBits; ++i) {
            out += " Y" + std::to_string(i) + "=" + bitSummary(s, i);
        }
        return out;
    };

    struct Node {
        bugma::State s;
        std::string path;
    };
    std::queue<Node> q;
    std::unordered_set<std::string> seen;
    const int maskCount = 1 << activeBits;
    std::vector<int> firstDist(maskCount, -1);
    std::vector<std::string> firstPath(maskCount);
    std::vector<bugma::State> firstState(maskCount);
    bool haveFirstInvalid = false;
    std::string firstInvalidPath;
    bugma::State firstInvalidState;
    bool haveFirstForbidden = false;
    std::string firstForbiddenPath;
    bugma::State firstForbiddenState;
    const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};

    bugma::State start = bugma::loadState(it->second);
    q.push({start, ""});
    seen.insert(bugma::encode(start));

    int expanded = 0;
    int invalidLatchStates = 0;
    while (!q.empty() && expanded < maxNodes) {
        Node cur = std::move(q.front());
        q.pop();
        ++expanded;

        int mask = maskOf(cur.s);
        if (mask >= 0 && firstDist[mask] < 0) {
            firstDist[mask] = static_cast<int>(cur.path.size());
            firstPath[mask] = cur.path;
            firstState[mask] = cur.s;
        } else if (mask < 0) {
            invalidLatchStates++;
            if (!haveFirstInvalid) {
                haveFirstInvalid = true;
                firstInvalidPath = cur.path;
                firstInvalidState = cur.s;
            }
        }
        if (!haveFirstForbidden) {
            for (const auto& cell : forbiddenBodyCells) {
                if (cur.s.px == cell.first && cur.s.py == cell.second) {
                    haveFirstForbidden = true;
                    firstForbiddenPath = cur.path;
                    firstForbiddenState = cur.s;
                    break;
                }
            }
        }

        for (char mv : moves) {
            bugma::State nxt;
            if (!bugma::applyAction(cur.s, mv, nxt)) continue;
            if (nxt.gameStatus != 0) continue;
            std::string key = bugma::encode(nxt);
            if (seen.count(key)) continue;
            seen.insert(std::move(key));
            q.push({std::move(nxt), cur.path + mv});
        }
    }

    std::cout << "counter_audit level=" << levelId
              << " active_bits=" << activeBits
              << " visited=" << seen.size()
              << " expanded=" << expanded
              << " invalid_latch_states=" << invalidLatchStates << "\n";
    if (haveFirstInvalid) {
        std::cout << "first invalid dist=" << firstInvalidPath.size()
                  << " path=" << firstInvalidPath
                  << " " << stateSummary(firstInvalidState) << "\n";
    }
    if (haveFirstForbidden) {
        std::cout << "first forbidden_body dist=" << firstForbiddenPath.size()
                  << " path=" << firstForbiddenPath
                  << " " << stateSummary(firstForbiddenState) << "\n";
    }
    for (int mask = 0; mask < maskCount; ++mask) {
        std::cout << "first mask ";
        for (int bit = activeBits - 1; bit >= 0; --bit) std::cout << ((mask & (1 << bit)) ? '1' : '0');
        if (firstDist[mask] < 0) {
            std::cout << " dist=NA\n";
        } else {
            std::cout << " dist=" << firstDist[mask]
                      << " path=" << firstPath[mask]
                      << " " << stateSummary(firstState[mask]) << "\n";
        }
    }
    if (activeBits >= 2 && firstDist[3] >= 0) {
        std::cout << "first mask 11 detail dist=" << firstDist[3]
                  << " path=" << firstPath[3]
                  << " " << stateSummary(firstState[3]) << "\n";
        if (firstDist[3] < 70) {
            std::cout << "WARNING mask 11 reached before local-verifier reference distance 70\n";
        }
    }
    return 0;
}

static int runInteractive() {
    auto packs = loadLevelPacks();
    auto levels = mergeAllLevels(packs);
    auto official = buildOfficialManifest(packs.official);

    auto isAllDigits = [](const std::string& s) {
        if (s.empty()) return false;
        for (char c : s) if (c < '0' || c > '9') return false;
        return true;
    };
    auto isDigitDashDigit = [](const std::string& s) {
        size_t dash = s.find('-');
        if (dash == std::string::npos || dash == 0 || dash == s.size() - 1) return false;
        for (size_t i = 0; i < dash; ++i) if (s[i] < '0' || s[i] > '9') return false;
        for (size_t i = dash + 1; i < s.size(); ++i) if (s[i] < '0' || s[i] > '9') return false;
        return true;
    };

    std::vector<int> randomIds;
    for (const auto& kv : packs.random) {
        if (isAllDigits(kv.first)) {
            int n = std::stoi(kv.first);
            if (n >= 0 && n < 1000) randomIds.push_back(n);
        }
    }
    std::sort(randomIds.begin(), randomIds.end());
    randomIds.erase(std::unique(randomIds.begin(), randomIds.end()), randomIds.end());

    std::vector<std::string> customIds;
    for (const auto& kv : packs.custom) {
        if (isDigitDashDigit(kv.first)) customIds.push_back(kv.first);
    }
    std::sort(customIds.begin(), customIds.end());

    std::cout << "Loaded levels: official(UI)=" << official.size()
              << ", random(base-ids<1000)=" << randomIds.size()
              << ", custom=" << customIds.size() << "\n";
    printAlgorithmIntro();

    std::string savePath = "cpp/banmen_save_import.json";
    auto records = parseExistingSave(bugma::readFile(savePath).value_or(""));

    std::vector<int> unresolvedOfficial;
    for (const auto& e : official) {
        auto it = records.find(e.saveKey);
        if (it == records.end() || it->second.replay.empty()) unresolvedOfficial.push_back(e.label);
    }

    std::vector<int> unresolvedRandom;
    for (int rid : randomIds) {
        std::string key = "gen_" + std::to_string(rid);
        auto it = records.find(key);
        if (it == records.end() || it->second.replay.empty()) unresolvedRandom.push_back(rid);
    }

    int unresolvedCustom = 0;
    for (const auto& cid : customIds) {
        std::string key = "custom_" + cid;
        auto it = records.find(key);
        if (it == records.end() || it->second.replay.empty()) unresolvedCustom++;
    }

    std::cout << "Unsolved from existing save:\n";
    std::cout << "- official(labels): " << mergeIntervals(unresolvedOfficial) << "\n";
    std::cout << "- random(gen ids) : " << mergeIntervals(unresolvedRandom) << "\n";
    std::cout << "- custom(count)   : " << unresolvedCustom << "/" << customIds.size() << "\n";

    while (true) {
        std::cout << "\nMode: 1=official 2=random 3=custom 0=exit > ";
        int mode = 0;
        if (!(std::cin >> mode)) return 0;
        if (mode == 0) break;

        int maxNodes = 120000;
        std::cout << "maxNodes (default 120000) > ";
        std::cin >> maxNodes;

        std::string algoInput = "bfs";
        std::cout << "algo (bfs/astar/beam/mha/ara/rrastar, default bfs) > ";
        std::cin >> algoInput;
        bugma::SearchAlgo algo = bugma::parseAlgo(algoInput);

        bugma::SearchConfig cfg;
        if (algo == bugma::SearchAlgo::ASTAR) {
            std::cout << "astarWeight (default 1.0) > ";
            std::cin >> cfg.astarWeight;
        } else if (algo == bugma::SearchAlgo::BEAM) {
            std::cout << "beamWidth (default 128) > ";
            std::cin >> cfg.beamWidth;
        } else if (algo == bugma::SearchAlgo::MHA) {
            std::cout << "mhaAuxWeight (default 1.8) > ";
            std::cin >> cfg.mhaAuxWeight;
        } else if (algo == bugma::SearchAlgo::ARA) {
            std::cout << "araStartWeight (default 3.0) > ";
            std::cin >> cfg.araStartWeight;
            std::cout << "araEndWeight (default 1.0) > ";
            std::cin >> cfg.araEndWeight;
            std::cout << "araStep (default 0.5) > ";
            std::cin >> cfg.araStep;
        } else if (algo == bugma::SearchAlgo::RRASTAR) {
            std::cout << "astarWeight (default 1.0) > ";
            std::cin >> cfg.astarWeight;
            std::cout << "randomRestarts (default 12) > ";
            std::cin >> cfg.randomRestarts;
            std::cout << "randomPrefixSteps (default 4) > ";
            std::cin >> cfg.randomPrefixSteps;
            std::cout << "randomJitter (default 0.5) > ";
            std::cin >> cfg.randomJitter;
            std::cout << "randomSeed (0=time-based, default 0) > ";
            std::cin >> cfg.randomSeed;
        }

        int hpHeuristic = 0;
        std::cout << "useHpHeuristic? (0/1, default 0) > ";
        std::cin >> hpHeuristic;
        cfg.useHpHeuristic = (hpHeuristic != 0);
        if (cfg.useHpHeuristic) {
            std::cout << "hpHeuristicWeight (default 1.0) > ";
            std::cin >> cfg.hpHeuristicWeight;
        }
        int purpleSafe = 1;
        std::cout << "safePurpleMode? (0/1, default 1) > ";
        std::cin >> purpleSafe;
        cfg.safePurpleMode = (purpleSafe != 0);
        if (cfg.safePurpleMode) {
            std::cout << "purpleRiskWeight (default 6.0) > ";
            std::cin >> cfg.purpleRiskWeight;
        }

        std::string selector;
        std::cout << "range/list (e.g. 11-22 or 1,3,5; all=ALL; unsolved=UNSOLVED) > ";
        std::cin >> selector;
        bool onlyUnsolved = (selector == "UNSOLVED" || selector == "unsolved" || selector == "ALL_UNSOLVED");

        struct Task { std::string id; int color = 0; int label = 0; std::string saveKey; };
        std::vector<Task> tasks;

        if (mode == 1) {
            auto labels = parseNumericSelector(selector);
            std::set<int> labelSet(labels.begin(), labels.end());
            for (const auto& e : official) {
                if (!labelSet.empty() && !labelSet.count(e.label)) continue;
                if (onlyUnsolved) {
                    auto rit = records.find(e.saveKey);
                    if (rit != records.end() && !rit->second.replay.empty()) continue;
                }
                tasks.push_back({e.id, e.colorOverride, e.label, e.saveKey});
            }
        } else if (mode == 2) {
            auto ids = parseNumericSelector(selector);
            std::set<int> idSet(ids.begin(), ids.end());
            for (int x : randomIds) {
                if (!idSet.empty() && !idSet.count(x)) continue;
                std::string sid = std::to_string(x);
                std::string sk = "gen_" + sid;
                if (onlyUnsolved) {
                    auto rit = records.find(sk);
                    if (rit != records.end() && !rit->second.replay.empty()) continue;
                }
                tasks.push_back({sid, 0, x, sk});
            }
        } else if (mode == 3) {
            if (selector == "ALL" || selector == "all" || onlyUnsolved) {
                for (const auto& cid : customIds) {
                    std::string sk = "custom_" + cid;
                    if (onlyUnsolved) {
                        auto rit = records.find(sk);
                        if (rit != records.end() && !rit->second.replay.empty()) continue;
                    }
                    tasks.push_back({cid, 0, 0, sk});
                }
            } else {
                std::stringstream ss(selector);
                std::string t;
                while (std::getline(ss, t, ',')) {
                    if (levels.count(t)) tasks.push_back({t, 0, 0, "custom_" + t});
                }
            }
        } else {
            std::cout << "Invalid mode\n";
            continue;
        }

        std::cout << "Selected " << tasks.size() << " levels\n";
        int solvedNow = 0;
        const auto* activeSet = &levels;
        if (mode == 1) activeSet = &packs.official;
        else if (mode == 2) activeSet = &packs.random;
        else if (mode == 3) activeSet = &packs.custom;

        for (size_t i = 0; i < tasks.size(); ++i) {
            const auto& t = tasks[i];
            auto it = activeSet->find(t.id);
            if (it == activeSet->end()) {
                std::cout << "[" << (i + 1) << "/" << tasks.size() << "] skip missing " << t.id << "\n";
                continue;
            }

            bugma::State st = bugma::loadState(it->second);
            if (t.color > 0) st.colorTheme = t.color;

            auto t0 = std::chrono::steady_clock::now();
            auto res = bugma::solveWithAlgo(st, maxNodes, algo, cfg);
            auto t1 = std::chrono::steady_clock::now();
            long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();

            std::cout << "[" << (i + 1) << "/" << tasks.size() << "] "
                      << t.id << (t.color > 0 ? ("_c" + std::to_string(t.color)) : "")
                      << " algo=" << res.algorithm << " nodes=" << res.expanded << " time=" << ms << "ms ";

            if (res.solved) {
                std::cout << "SOLVED steps=" << res.path.size() << "\n";
                solvedNow++;
                ReplayRecord rec;
                rec.cleared = true;
                rec.bestSteps = static_cast<int>(res.path.size());
                rec.replay = res.path;
                rec.solverAlgorithm = res.algorithm;
                rec.expanded = res.expanded;
                rec.elapsedMs = ms;
                rec.updatedAt = std::chrono::time_point_cast<std::chrono::milliseconds>(
                                    std::chrono::system_clock::now()).time_since_epoch().count();
                rec.source = "bugma_solver";

                auto rit = records.find(t.saveKey);
                if (rit == records.end() || rit->second.bestSteps <= 0 || rec.bestSteps < rit->second.bestSteps || rit->second.replay.empty()) {
                    records[t.saveKey] = rec;
                }
            } else {
                std::cout << "UNSOLVED\n";
            }
        }

        writeSolverSaveJson("cpp/banmen_save_import.json", records);
        writeSolverSaveJs("cpp/banmen_save_import.js", records);
        std::cout << "Round done. solved=" << solvedNow << "/" << tasks.size()
                  << ", saved to cpp/banmen_save_import.json and cpp/banmen_save_import.js\n";
    }

    return 0;
}

int main(int argc, char** argv) {
    if (argc >= 2) {
        std::string a1 = argv[1];
        if (a1 == "--audit-rules") {
            return bugma::runRuleAudit();
        }
        if (a1 == "--test-headpath-original") {
            return bugma::runHeadpathOriginalTest();
        }
        if (a1 == "--search-body-latch") {
            return bugma::runBodyTargetLatchSearch();
        }
        if (a1 == "--search-l-exit-discriminator") {
            return bugma::runParkingHoleLExitSearch();
        }
        if (a1 == "--audit-diode") {
            return bugma::runTerminalDiodeAudit();
        }
        if (a1 == "--counter-audit") {
            std::string auditLevel = (argc >= 3) ? argv[2] : "counter-test-2";
            int auditMaxNodes = (argc >= 4) ? std::stoi(argv[3]) : 1000000;
            int auditBits = (argc >= 5) ? std::stoi(argv[4]) : 2;
            return runCounterAudit(auditLevel, auditMaxNodes, auditBits);
        }
        if (a1 == "--interactive" || a1 == "-i") {
            return runInteractive();
        }
    }

    std::string levelId;
    int maxNodes = 120000;
    int colorOverride = 0;
    bugma::SearchAlgo algo = bugma::SearchAlgo::BFS;
    bugma::SearchConfig cfg;

    int positional = 0;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--algo" && i + 1 < argc) {
            algo = bugma::parseAlgo(argv[++i]);
            continue;
        }
        if (arg == "--beam" && i + 1 < argc) {
            cfg.beamWidth = std::stoi(argv[++i]);
            continue;
        }
        if (arg == "--astar-w" && i + 1 < argc) {
            cfg.astarWeight = std::stod(argv[++i]);
            continue;
        }
        if (arg == "--mha-aux-w" && i + 1 < argc) {
            cfg.mhaAuxWeight = std::stod(argv[++i]);
            continue;
        }
        if (arg == "--ara-start-w" && i + 1 < argc) {
            cfg.araStartWeight = std::stod(argv[++i]);
            continue;
        }
        if (arg == "--ara-end-w" && i + 1 < argc) {
            cfg.araEndWeight = std::stod(argv[++i]);
            continue;
        }
        if (arg == "--ara-step" && i + 1 < argc) {
            cfg.araStep = std::stod(argv[++i]);
            continue;
        }
        if (arg == "--random-restarts" && i + 1 < argc) {
            cfg.randomRestarts = std::stoi(argv[++i]);
            continue;
        }
        if (arg == "--random-prefix" && i + 1 < argc) {
            cfg.randomPrefixSteps = std::stoi(argv[++i]);
            continue;
        }
        if (arg == "--random-jitter" && i + 1 < argc) {
            cfg.randomJitter = std::stod(argv[++i]);
            continue;
        }
        if (arg == "--random-seed" && i + 1 < argc) {
            cfg.randomSeed = static_cast<std::uint64_t>(std::stoull(argv[++i]));
            continue;
        }
        if (arg == "--hp-heuristic") {
            cfg.useHpHeuristic = true;
            continue;
        }
        if (arg == "--hp-w" && i + 1 < argc) {
            cfg.useHpHeuristic = true;
            cfg.hpHeuristicWeight = std::stod(argv[++i]);
            continue;
        }
        if (arg == "--safe-purple") {
            cfg.safePurpleMode = true;
            continue;
        }
        if (arg == "--no-safe-purple") {
            cfg.safePurpleMode = false;
            continue;
        }
        if (arg == "--purple-risk-w" && i + 1 < argc) {
            cfg.purpleRiskWeight = std::stod(argv[++i]);
            continue;
        }
        if ((arg == "--max-nodes" || arg == "-n") && i + 1 < argc) {
            maxNodes = std::stoi(argv[++i]);
            continue;
        }
        if ((arg == "--color" || arg == "-c") && i + 1 < argc) {
            colorOverride = std::stoi(argv[++i]);
            continue;
        }
        if (!arg.empty() && arg[0] == '-') continue;

        if (positional == 0) levelId = arg;
        else if (positional == 1) maxNodes = std::stoi(arg);
        else if (positional == 2) colorOverride = std::stoi(arg);
        positional++;
    }

    if (levelId.empty()) {
        std::cerr << "Usage: ./cpp/build/bugma_solver <levelId> [maxNodes] [colorOverride] "
                     "[--algo bfs|astar|beam|mha|ara|rrastar] [--beam N] [--astar-w W] [--mha-aux-w W] "
                     "[--ara-start-w W] [--ara-end-w W] [--ara-step S] "
                     "[--random-restarts N] [--random-prefix N] [--random-jitter J] [--random-seed S] "
                     "[--hp-heuristic] [--hp-w W] [--safe-purple|--no-safe-purple] [--purple-risk-w W]\n";
        return 2;
    }

    auto levels = mergeAllLevels(loadLevelPacks());
    auto it = levels.find(levelId);
    if (it == levels.end()) {
        std::cerr << "Level not found: " << levelId << "\n";
        return 2;
    }

    bugma::State start = bugma::loadState(it->second);
    if (colorOverride > 0) start.colorTheme = colorOverride;
    auto res = bugma::solveWithAlgo(start, maxNodes, algo, cfg);

    int realColor = colorOverride > 0 ? colorOverride : it->second.color;
    std::cout << "Level " << levelId << ", mode=" << it->second.mode << ", color=" << realColor
              << ", algo=" << res.algorithm << "\n";
    if (!res.solved) {
        std::cout << "No solution found under current model (node limit: " << maxNodes << ", expanded: " << res.expanded << ")\n";
        return 0;
    }
    std::cout << "Solution(" << res.path.size() << " steps, expanded: " << res.expanded << "): " << res.path << "\n";
    return 0;
}

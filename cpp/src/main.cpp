#include <array>
#include <fstream>
#include <iostream>
#include <optional>
#include <queue>
#include <regex>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace bugma {

constexpr int N = 14;

enum Dir { UP = 1, LEFT = 2, RIGHT = 3, DOWN = 4 };

struct Level {
    int color = 0;
    int mode = 1;
    std::vector<std::string> map;
};

struct State {
    std::array<std::array<int, N>, N> fg{};
    std::array<std::array<int, N>, N> bg{};
    int px = 0;
    int py = 0;
    int form = 1;
    int dir = RIGHT;
    int colorTheme = 0;
    int isInvincible = 0;
    int gameStatus = 0; // 0 ongoing, 1 win, 2 lose
};

using Grid = std::array<std::array<int, N>, N>;

static const std::unordered_map<std::string, int> kTokenToFg = {
    {"__", 0}, {"||", 2}, {"/|", 2}, {"he", 1}, {"HE", 1},
    {"e1", 11}, {"e2", 12}, {"e3", 13}, {"e4", 14}, {"e5", 15}, {"e6", 16},
    {"g1", 21}, {"g2", 22}, {"g3", 23}, {"g4", 24}, {"g5", 25}, {"g6", 26},
    {"h1", 101}, {"h2", 102}, {"h3", 103},
    {"l1", 111}, {"l2", 112}, {"l3", 113},
    {"r1", 121}, {"r2", 122}, {"r3", 123}, {"hm", 131},
    {"s1", 401}, {"s2", 402}, {"s3", 403}, {"s4", 404}, {"s5", 405}, {"s6", 416}, {"s7", 417}, {"s8", 418}, {"s9", 419},
    {"b1", 411}, {"b2", 412}, {"b3", 413}, {"b4", 414}, {"b5", 415},
    {"k1", 8}, {"k2", 8}, {"k3", 8}, {"k4", 8}, {"k5", 8}, {"k6", 8}, {"k7", 8}, {"k8", 8}, {"k9", 8},
    {"kd", 3}, {"-|", 7}, {"nn", 2}, {"m|", 2}, {"d|", 2}, {"1|", 2}, {"2|", 2}, {"3|", 2}, {"sb", 0}, {"er", 0},
    {"17", 17}, {"18", 18}
};

static const std::unordered_map<std::string, int> kTokenToBg = {
    {"cs", 2}, {"ce", 3}, {"c1", 11}, {"c2", 12}, {"c3", 13}, {"c4", 14}, {"c5", 15}, {"c6", 16},
    {"k1", 101}, {"k2", 102}, {"k3", 103}, {"k4", 104}, {"k5", 105}, {"k6", 106}, {"k7", 107}, {"k8", 108}, {"k9", 109},
    {"1|", 201}, {"2|", 202}, {"3|", 203}, {"m|", 204}, {"d|", 205}, {"/|", 999}, {"sb", 1},
};

std::optional<std::string> readFile(const std::string& path) {
    std::ifstream ifs(path);
    if (!ifs) return std::nullopt;
    return std::string((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
}

std::unordered_map<std::string, Level> parseLevels(const std::string& text) {
    std::unordered_map<std::string, Level> out;

    std::regex idRe("\\\"([0-9]+)\\\"\\s*:\\s*\\{");
    std::regex colorRe("\\\"color\\\"\\s*:\\s*([0-9]+)");
    std::regex modeRe("\\\"mode\\\"\\s*:\\s*([0-9]+)");

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

    size_t searchPos = 0;
    while (searchPos < text.size()) {
        std::smatch idm;
        std::string tail = text.substr(searchPos);
        if (!std::regex_search(tail, idm, idRe)) break;

        const std::string id = idm[1].str();
        const size_t objStart = searchPos + static_cast<size_t>(idm.position()) + static_cast<size_t>(idm.length()) - 1; // '{'

        int depth = 0;
        bool inString = false;
        size_t objEnd = std::string::npos;
        for (size_t i = objStart; i < text.size(); ++i) {
            char c = text[i];
            if (inString) {
                if (c == '\\') {
                    ++i;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }
            if (c == '"') {
                inString = true;
                continue;
            }
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) {
                    objEnd = i;
                    break;
                }
            }
        }

        if (objEnd == std::string::npos) break;
        const std::string block = text.substr(objStart, objEnd - objStart + 1);

        std::smatch cm, mm;
        if (!std::regex_search(block, cm, colorRe) || !std::regex_search(block, mm, modeRe)) {
            searchPos = objEnd + 1;
            continue;
        }

        size_t mapKeyPos = block.find("\"map\"");
        if (mapKeyPos == std::string::npos) {
            searchPos = objEnd + 1;
            continue;
        }

        size_t lbr = block.find('[', mapKeyPos);
        if (lbr == std::string::npos) {
            searchPos = objEnd + 1;
            continue;
        }

        int arrDepth = 0;
        inString = false;
        size_t rbr = std::string::npos;
        for (size_t i = lbr; i < block.size(); ++i) {
            char c = block[i];
            if (inString) {
                if (c == '\\') {
                    ++i;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }
            if (c == '"') {
                inString = true;
                continue;
            }
            if (c == '[') arrDepth++;
            else if (c == ']') {
                arrDepth--;
                if (arrDepth == 0) {
                    rbr = i;
                    break;
                }
            }
        }

        if (rbr == std::string::npos) {
            searchPos = objEnd + 1;
            continue;
        }

        Level lvl;
        lvl.color = std::stoi(cm[1].str());
        lvl.mode = std::stoi(mm[1].str());
        std::string mapRaw = block.substr(lbr + 1, rbr - lbr - 1);
        lvl.map = parseMapTokens(mapRaw);

        if (lvl.map.size() == N * N) out[id] = std::move(lvl);
        searchPos = objEnd + 1;
    }

    return out;
}

bool inBounds(int x, int y) { return x >= 0 && x < N && y >= 0 && y < N; }
bool isEnemy(int id) { return id >= 11 && id <= 26; }
bool isPushable(int id) { return id >= 100; }

State loadState(const Level& lvl) {
    State s;
    s.form = lvl.mode;
    s.colorTheme = lvl.color;

    for (int row = 0; row < N; ++row) {
        for (int col = 0; col < N; ++col) {
            const std::string& tk = lvl.map[row * N + col];
            const int x = col;
            const int y = N - 1 - row;
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
    int hpy = by + 1;
    if (hpy >= N) return;
    if (b[bx][hpy] == 131) return;

    while (hpy < N && (b[bx][hpy] % 10 == 3) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) {
        if (hpy < 13) {
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
    if (hpy < N && (b[bx][hpy] % 10 == 2) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) {
        b[bx][hpy]--;
        return;
    }
    if (hpy < N && (b[bx][hpy] % 10 == 1) && (b[bx][hpy] > 100) && (b[bx][hpy] < 200)) {
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
    int px = st.px, py = st.py;
    int hpy = py + 1;
    if (hpy >= N) return;
    if (b[px][hpy] == 131) return;

    while (hpy < N && (b[px][hpy] % 10 == 3) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) {
        if (hpy < 13) {
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
    if (hpy < N && (b[px][hpy] % 10 == 2) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) {
        b[px][hpy]--;
        return;
    }
    if (hpy < N && (b[px][hpy] % 10 == 1) && (b[px][hpy] > 100) && (b[px][hpy] < 200)) {
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

void enemyHpIncrease(Grid& b, int battlex, int battley) {
    int state = -1;
    int y = battley + 1;
    while (y <= 13) {
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
    int px = st.px, py = st.py;
    int y = py + 1;
    if (y >= N) return;
    if (st.dir == RIGHT) {
        while (y < N) {
            int id = b[px][y];
            int type = id / 10;
            if (!((type == 10 || type == 11 || type == 12) && id % 10 >= 1 && id % 10 <= 3)) break;
            if (id % 10 == 1) {
                b[px][y] = 0;
                if (px < 13 && b[px + 1][y] == 0) b[px + 1][y] = id + 10;
            }
            if (y < 13 && (id % 10 == 3) && (type == b[px][y + 1] / 10)) {
                y++;
                continue;
            }
            break;
        }
    } else {
        while (y < N) {
            int id = b[px][y];
            int type = id / 10;
            if (!((type == 10 || type == 11 || type == 12) && id % 10 >= 1 && id % 10 <= 3)) break;
            if (id % 10 == 1) {
                b[px][y] = 0;
                if (px < 13 && b[px + 1][y] == 0) b[px + 1][y] = id - 10;
            }
            if (y < 13 && (id % 10 == 3) && (type == b[px][y + 1] / 10)) {
                y++;
                continue;
            }
            break;
        }
    }
}

void mechanicRedComplex(const Grid& fg, Grid& b, const State& st, int ex, int ey) {
    std::array<int, N> cache{};
    int mode = 0;
    int y = ey;
    while (true) {
        y++;
        if (y >= N) break;
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
        if (y >= N) break;
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
        if (y >= N || b[px][y] != 0) break;
        int id = cache[y];
        if (id == 0) break;
        if (id == 131) b[px][y] = id;
        else if (id >= 120) b[px][y] = id - 10;
        else if (id >= 110) b[px][y] = id + 10;
        else if (id >= 100) b[px][y] = id;
    }
}

void mechanicGreenComplex(const Grid& fg, Grid& b, const State& st, int ex, int ey) {
    int total = 0;
    int mode = 0;
    int y = ey;
    while (true) {
        y++;
        if (y >= N) break;
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
        if (y >= N) break;
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
    int pFirst = (py + 1 < N) ? fg[px][py + 1] : 0;
    if (pFirst == 131) pBase = 30;
    else if (pFirst >= 120 && pFirst <= 130) pBase = 20;
    else if (pFirst >= 110 && pFirst <= 120) pBase = 10;

    int eBase = 0;
    int eFirst = (ey + 1 < N) ? fg[ex][ey + 1] : 0;
    if (eFirst == 131) eBase = 30;
    else if (eFirst >= 120 && eFirst <= 130) eBase = 20;
    else if (eFirst >= 110 && eFirst <= 120) eBase = 10;

    int yp = py, ye = ey;
    while (true) {
        yp++; ye++;
        if (yp >= N) break;
        bool eOut = (ye >= N);

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
        if (y >= N) break;
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
    auto mechanicGreenSimple = [&]() { enemyHpIncrease(b, ex, ey); damagePlayer(st, b, potentialInvincible); };
    auto mechanicYellowSimple = [&]() { enemyHpIncrease(b, ex, ey); enemyHpIncrease(b, ex, ey); damagePlayer(st, b, potentialInvincible); };
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
    while (inBounds(x, y)) {
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
        if (y >= N) break;
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
    if (!inBounds(tx, ty)) return false;
    int targetId = b[tx][ty];

    if (targetId == 0) {
        b[tx][ty] = 1;
        b[hx][hy] = 0;
        st.px = tx; st.py = ty;

        int stackY = hy + 1;
        int hpichi = 0;
        while (stackY < N) {
            int id = fg[hx][stackY];
            if (id < 101 || id > 200) break;
            int type = id / 10;
            if (hpichi == 2 && type != 10) break;
            if (hpichi == 1 && type != 11) break;
            if (hpichi == 3 && type != 12) break;
            if (hpichi == 4 && id != 131) break;

            int ny = stackY + dy;
            if (ny < 0 || ny >= N) break;
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

    for (int x = 0; x < N; ++x) {
        for (int y = 0; y < N; ++y) {
            int id = b[x][y];
            if (id == 1) { playerFound = true; px = x; py = y; }

            if (id >= 11 && id <= 26) {
                bool hasHeart = false;
                if (y < 13) {
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
        if (py < 13) {
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
    for (int x = 0; x < N; ++x) for (int y = 0; y < N; ++y) if (isEnemy(s.fg[x][y])) return false;
    return true;
}

std::string encode(const State& s) {
    std::string key;
    key.reserve(N * N * 4 + 32);
    key += std::to_string(s.form) + "|" + std::to_string(s.dir) + "|" + std::to_string(s.colorTheme) + "|" + std::to_string(s.isInvincible) + "|" + std::to_string(s.gameStatus) + "|";
    for (int y = 0; y < N; ++y) for (int x = 0; x < N; ++x) {
        key += std::to_string(s.fg[x][y]);
        key.push_back(',');
    }
    return key;
}

std::optional<std::string> bfsSolve(const State& start, int maxNodes) {
    if (isSolved(start)) return std::string();

    struct Node { State s; std::string path; };
    std::queue<Node> q;
    std::unordered_set<std::string> vis;

    q.push({start, ""});
    vis.insert(encode(start));

    const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};

    int expanded = 0;
    while (!q.empty() && expanded < maxNodes) {
        Node cur = std::move(q.front()); q.pop();
        ++expanded;

        for (char mv : moves) {
            State nxt;
            if (!applyAction(cur.s, mv, nxt)) continue;
            auto k = encode(nxt);
            if (vis.count(k)) continue;
            std::string np = cur.path + mv;
            if (isSolved(nxt)) return np;
            vis.insert(std::move(k));
            q.push({std::move(nxt), std::move(np)});
        }
    }
    return std::nullopt;
}

} // namespace bugma

int main(int argc, char** argv) {
    std::string levelId = argc >= 2 ? argv[1] : "0";
    int maxNodes = argc >= 3 ? std::stoi(argv[2]) : 120000;

    auto textOpt = bugma::readFile("js/generated_levels.js");
    if (!textOpt) {
        std::cerr << "Cannot read js/generated_levels.js\n";
        return 1;
    }

    auto levels = bugma::parseLevels(*textOpt);

    auto extraOpt = bugma::readFile("js/levels.js");
    if (extraOpt) {
        auto extra = bugma::parseLevels(*extraOpt);
        for (auto& kv : extra) levels[kv.first] = std::move(kv.second);
    }
    auto it = levels.find(levelId);
    if (it == levels.end()) {
        std::cerr << "Level not found: " << levelId << "\n";
        return 2;
    }

    bugma::State start = bugma::loadState(it->second);
    auto answer = bugma::bfsSolve(start, maxNodes);

    std::cout << "Level " << levelId << ", mode=" << it->second.mode << ", color=" << it->second.color << "\n";
    if (!answer.has_value()) {
        std::cout << "No solution found under current model (node limit: " << maxNodes << ")\n";
        return 0;
    }
    std::cout << "Solution(" << answer->size() << " steps): " << *answer << "\n";
    return 0;
}

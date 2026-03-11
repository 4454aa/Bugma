#include <array>
#include <fstream>
#include <iostream>
#include <chrono>
#include <optional>
#include <queue>
#include <regex>
#include <set>
#include <sstream>
#include <stdexcept>
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

    std::regex idRe(R"rx("([0-9]+(?:-[0-9]+)?)"\s*:\s*\{)rx");
    std::regex colorRe(R"rx("color"\s*:\s*([0-9]+))rx");
    std::regex modeRe(R"rx("mode"\s*:\s*([0-9]+))rx");

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
        if (b[px][y] == 131) return;

        while (y < N) {
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

            if (y < 13 && (id % 10 == 3) && (type == b[px][y + 1] / 10)) {
                y++;
                continue;
            }
            break;
        }
    } else {
        if (b[px][y] == 131) return;

        while (y < N) {
            int id = b[px][y];
            int type = id / 10;

            if (type == 10) {
                b[px][y] += 20;
            } else if (type == 11) {
                b[px][y] -= 10;
            } else if (type == 12) {
                b[px][y] = 0;
                if (px < 13 && b[px + 1][y] == 0) b[px + 1][y] = id - 10;
            } else {
                break;
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

} // namespace bugma

#include "search_algorithms.hpp"

struct ReplayRecord {
    bool cleared = true;
    int bestSteps = 0;
    std::string replay;
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
    if (input.empty() || input == "all" || input == "ALL") return out;

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

    std::regex entryRe(R"rx("([^"]+)"\s*:\s*\{([\s\S]*?)\})rx");
    std::regex replayRe(R"rx("replay"\s*:\s*"([UDLRudlr]*)")rx");
    std::regex stepsRe(R"rx("bestSteps"\s*:\s*([0-9]+))rx");
    std::regex clearedRe(R"rx("cleared"\s*:\s*(true|false))rx");

    for (auto it = std::sregex_iterator(body.begin(), body.end(), entryRe); it != std::sregex_iterator(); ++it) {
        ReplayRecord rec;
        rec.bestSteps = 0;
        rec.cleared = true;
        std::string key = (*it)[1].str();
        std::string obj = (*it)[2].str();

        std::smatch m;
        if (std::regex_search(obj, m, replayRe)) rec.replay = m[1].str();
        if (std::regex_search(obj, m, stepsRe)) rec.bestSteps = std::stoi(m[1].str());
        if (std::regex_search(obj, m, clearedRe)) rec.cleared = (m[1].str() == "true");

        if (!rec.replay.empty()) {
            std::transform(rec.replay.begin(), rec.replay.end(), rec.replay.begin(), [](unsigned char c) {
                return static_cast<char>(std::toupper(c));
            });
        }
        out[key] = rec;
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
            << "        \"replay\": \"" << kv.second.replay << "\"\n"
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
            << ", \"replay\": \"" << kv.second.replay << "\"}";
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
        << "\n[Algorithm] Solver supports BFS / A* / Beam / MHA* / ARA* over full game state.\n"
        << "- State includes grid, form, direction, color theme, invincible flag, status.\n"
        << "- Each node expands 4 actions (U/D/L/R) via full turn-resolution mechanics.\n"
        << "- BFS guarantees shortest-step solution under current rules when found; heuristic methods are faster on large spaces but not always shortest.\n"
        << "- maxNodes controls search budget (expanded nodes cap).\n\n";
}

static int runInteractive() {
    auto packs = loadLevelPacks();
    auto levels = mergeAllLevels(packs);
    auto official = buildOfficialManifest(packs.official);

    std::vector<int> randomIds;
    for (const auto& kv : packs.random) {
        if (std::regex_match(kv.first, std::regex(R"(^\d+$)"))) {
            int n = std::stoi(kv.first);
            if (n >= 0 && n < 1000) randomIds.push_back(n);
        }
    }
    std::sort(randomIds.begin(), randomIds.end());
    randomIds.erase(std::unique(randomIds.begin(), randomIds.end()), randomIds.end());

    std::vector<std::string> customIds;
    for (const auto& kv : packs.custom) {
        if (std::regex_match(kv.first, std::regex(R"(^\d+-\d+$)"))) customIds.push_back(kv.first);
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
        std::cout << "algo (bfs/astar/beam/mha/ara, default bfs) > ";
        std::cin >> algoInput;
        bugma::SearchAlgo algo = bugma::parseAlgo(algoInput);

        int beamWidth = 128;
        if (algo == bugma::SearchAlgo::BEAM) {
            std::cout << "beamWidth (default 128) > ";
            std::cin >> beamWidth;
        }

        std::string selector;
        std::cout << "range/list (e.g. 11-22 or 1,3,5; all=ALL) > ";
        std::cin >> selector;

        struct Task { std::string id; int color = 0; int label = 0; std::string saveKey; };
        std::vector<Task> tasks;

        if (mode == 1) {
            auto labels = parseNumericSelector(selector);
            std::set<int> labelSet(labels.begin(), labels.end());
            for (const auto& e : official) {
                if (!labelSet.empty() && !labelSet.count(e.label)) continue;
                tasks.push_back({e.id, e.colorOverride, e.label, e.saveKey});
            }
        } else if (mode == 2) {
            auto ids = parseNumericSelector(selector);
            std::set<int> idSet(ids.begin(), ids.end());
            for (int x : randomIds) {
                if (!idSet.empty() && !idSet.count(x)) continue;
                std::string sid = std::to_string(x);
                tasks.push_back({sid, 0, x, "gen_" + sid});
            }
        } else if (mode == 3) {
            if (selector == "ALL" || selector == "all") {
                for (const auto& cid : customIds) tasks.push_back({cid, 0, 0, "custom_" + cid});
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
            auto res = bugma::solveWithAlgo(st, maxNodes, algo, beamWidth);
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
        if (a1 == "--interactive" || a1 == "-i") {
            return runInteractive();
        }
    }

    std::string levelId;
    int maxNodes = 120000;
    int colorOverride = 0;
    bugma::SearchAlgo algo = bugma::SearchAlgo::BFS;
    int beamWidth = 128;

    int positional = 0;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--algo" && i + 1 < argc) {
            algo = bugma::parseAlgo(argv[++i]);
            continue;
        }
        if (arg == "--beam" && i + 1 < argc) {
            beamWidth = std::stoi(argv[++i]);
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
        std::cerr << "Usage: ./cpp/build/bugma_solver <levelId> [maxNodes] [colorOverride] [--algo bfs|astar|beam|mha|ara] [--beam N]\n";
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
    auto res = bugma::solveWithAlgo(start, maxNodes, algo, beamWidth);

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

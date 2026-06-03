#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <chrono>
#include <limits>
#include <queue>
#include <random>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace bugma {

struct State;
bool applyAction(const State& in, char mv, State& out);
bool isSolved(const State& s);
std::string encode(const State& s);

struct SolveResult {
    bool solved = false;
    std::string path;
    int expanded = 0;
    std::string algorithm;
};

enum class SearchAlgo { BFS, ASTAR, BEAM, MHA, ARA, RRASTAR };

struct SearchConfig {
    int beamWidth = 128;
    double astarWeight = 1.0;
    double mhaAuxWeight = 1.8;
    double araStartWeight = 3.0;
    double araEndWeight = 1.0;
    double araStep = 0.5;
    bool useHpHeuristic = false;
    double hpHeuristicWeight = 1.0;
    bool safePurpleMode = true;
    double purpleRiskWeight = 6.0;
    int randomRestarts = 12;
    int randomPrefixSteps = 4;
    double randomJitter = 0.5;
    std::uint64_t randomSeed = 0;
};

inline int hEnemyCount(const State& s) {
    int c = 0;
    for (int x = 0; x < s.w; ++x) {
        for (int y = 0; y < s.h; ++y) {
            int id = s.fg[x][y];
            if (id >= 11 && id <= 26) c++;
        }
    }
    return c;
}

inline int hNearestEnemy(const State& s) {
    int best = std::numeric_limits<int>::max();
    for (int x = 0; x < s.w; ++x) {
        for (int y = 0; y < s.h; ++y) {
            int id = s.fg[x][y];
            if (id >= 11 && id <= 26) {
                int d = std::abs(s.px - x) + std::abs(s.py - y);
                best = std::min(best, d);
            }
        }
    }
    return best == std::numeric_limits<int>::max() ? 0 : best;
}

inline int heuristic1(const State& s) {
    return hEnemyCount(s) * 8 + hNearestEnemy(s);
}

inline int heuristic2(const State& s) {
    return hEnemyCount(s) * 10;
}

inline int heartUnitsOnColumn(const State& s, int x, int fromY) {
    int total = 0;
    for (int y = fromY + 1; y < s.h; ++y) {
        int id = s.fg[x][y];
        if (id < 101 || id > 200) break;
        if (id == 131) {
            total += 2;
            continue;
        }
        int d = id % 10;
        if (d >= 1 && d <= 3) total += d;
    }
    return total;
}

inline int hpAwareDelta(const State& s) {
    int enemyUnits = 0;
    for (int x = 0; x < s.w; ++x) {
        for (int y = 0; y < s.h; ++y) {
            int id = s.fg[x][y];
            if (id >= 11 && id <= 26) enemyUnits += heartUnitsOnColumn(s, x, y);
        }
    }
    int playerUnits = heartUnitsOnColumn(s, s.px, s.py);
    int delta = enemyUnits - playerUnits;
    return delta > 0 ? delta : 0;
}

inline int heuristicMain(const State& s, const SearchConfig& cfg) {
    int h = heuristic1(s);
    if (cfg.useHpHeuristic) {
        h += static_cast<int>(cfg.hpHeuristicWeight * hpAwareDelta(s));
    }
    if (cfg.safePurpleMode && s.colorTheme == 6) {
        int risk = hEnemyCount(s);
        if (s.isInvincible == 0) h += static_cast<int>(cfg.purpleRiskWeight * risk);
        else h = std::max(0, h - static_cast<int>(cfg.purpleRiskWeight));
    }
    return h;
}

inline int heuristicAux(const State& s, const SearchConfig& cfg) {
    int h = heuristic2(s);
    if (cfg.useHpHeuristic) {
        h += static_cast<int>(0.5 * cfg.hpHeuristicWeight * hpAwareDelta(s));
    }
    return h;
}

inline SolveResult bfsSolve(const State& start, int maxNodes) {
    if (isSolved(start)) return {true, "", 0, "BFS"};

    struct Node { State s; std::string path; };
    std::queue<Node> q;
    std::unordered_set<std::string> vis;

    q.push({start, ""});
    vis.insert(encode(start));
    const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};

    int expanded = 0;
    while (!q.empty() && expanded < maxNodes) {
        Node cur = std::move(q.front());
        q.pop();
        ++expanded;

        for (char mv : moves) {
            State nxt;
            if (!applyAction(cur.s, mv, nxt)) continue;
            auto k = encode(nxt);
            if (vis.count(k)) continue;
            std::string np = cur.path + mv;
            if (isSolved(nxt)) return {true, np, expanded, "BFS"};
            vis.insert(std::move(k));
            q.push({std::move(nxt), std::move(np)});
        }
    }
    return {false, "", expanded, "BFS"};
}

inline SolveResult weightedAStarSolve(const State& start, int maxNodes, double w, const SearchConfig& cfg = SearchConfig{}, const std::string& name = "A*") {
    if (isSolved(start)) return {true, "", 0, name};

    struct Node {
        State s;
        int g = 0;
        int f = 0;
        std::string path;
    };
    struct Cmp {
        bool operator()(const Node& a, const Node& b) const {
            if (a.f != b.f) return a.f > b.f;
            return a.g < b.g;
        }
    };

    std::priority_queue<Node, std::vector<Node>, Cmp> open;
    std::unordered_map<std::string, int> bestG;

    open.push({start, 0, static_cast<int>(w * heuristicMain(start, cfg)), ""});
    bestG[encode(start)] = 0;

    const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
    int expanded = 0;

    while (!open.empty() && expanded < maxNodes) {
        Node cur = std::move(open.top());
        open.pop();
        ++expanded;

        if (isSolved(cur.s)) return {true, cur.path, expanded, name};

        for (char mv : moves) {
            State nxt;
            if (!applyAction(cur.s, mv, nxt)) continue;
            int ng = cur.g + 1;
            std::string k = encode(nxt);
            auto it = bestG.find(k);
            if (it != bestG.end() && it->second <= ng) continue;
            bestG[k] = ng;
            int nf = ng + static_cast<int>(w * heuristicMain(nxt, cfg));
            open.push({std::move(nxt), ng, nf, cur.path + mv});
        }
    }
    return {false, "", expanded, name};
}

inline SolveResult beamSolve(const State& start, int maxNodes, int beamWidth, const SearchConfig& cfg = SearchConfig{}) {
    if (isSolved(start)) return {true, "", 0, "Beam"};
    if (beamWidth <= 0) beamWidth = 64;

    struct Node { State s; std::string path; int score = 0; };
    std::vector<Node> frontier{{start, "", heuristicMain(start, cfg)}};
    std::unordered_set<std::string> vis;
    vis.insert(encode(start));

    const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
    int expanded = 0;

    while (!frontier.empty() && expanded < maxNodes) {
        std::vector<Node> next;
        next.reserve(frontier.size() * 4);

        for (const auto& cur : frontier) {
            if (expanded >= maxNodes) break;
            ++expanded;
            for (char mv : moves) {
                State nxt;
                if (!applyAction(cur.s, mv, nxt)) continue;
                std::string k = encode(nxt);
                if (vis.count(k)) continue;
                std::string np = cur.path + mv;
                if (isSolved(nxt)) return {true, np, expanded, "Beam"};
                vis.insert(std::move(k));
                next.push_back({std::move(nxt), std::move(np), heuristicMain(nxt, cfg)});
            }
        }

        std::sort(next.begin(), next.end(), [](const Node& a, const Node& b) {
            return a.score < b.score;
        });
        if (static_cast<int>(next.size()) > beamWidth) next.resize(beamWidth);
        frontier = std::move(next);
    }

    return {false, "", expanded, "Beam"};
}

inline SolveResult mhaSolve(const State& start, int maxNodes, const SearchConfig& cfg = SearchConfig{}, double auxWeight = 1.8) {
    if (isSolved(start)) return {true, "", 0, "MHA*"};

    struct Node {
        State s;
        int g = 0;
        int f = 0;
        std::string path;
    };
    struct Cmp {
        bool operator()(const Node& a, const Node& b) const {
            if (a.f != b.f) return a.f > b.f;
            return a.g < b.g;
        }
    };

    std::priority_queue<Node, std::vector<Node>, Cmp> anchor;
    std::priority_queue<Node, std::vector<Node>, Cmp> aux;
    std::unordered_map<std::string, int> bestG;

    anchor.push({start, 0, heuristicMain(start, cfg), ""});
    aux.push({start, 0, static_cast<int>(auxWeight * heuristicAux(start, cfg)), ""});
    bestG[encode(start)] = 0;

    const std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
    int expanded = 0;

    while ((!anchor.empty() || !aux.empty()) && expanded < maxNodes) {
        bool pickAux = !aux.empty() && (expanded % 3 != 0 || anchor.empty());
        Node cur = pickAux ? std::move(aux.top()) : std::move(anchor.top());
        if (pickAux) aux.pop();
        else anchor.pop();

        ++expanded;
        if (isSolved(cur.s)) return {true, cur.path, expanded, "MHA*"};

        for (char mv : moves) {
            State nxt;
            if (!applyAction(cur.s, mv, nxt)) continue;
            int ng = cur.g + 1;
            std::string k = encode(nxt);
            auto it = bestG.find(k);
            if (it != bestG.end() && it->second <= ng) continue;
            bestG[k] = ng;
            anchor.push({nxt, ng, ng + heuristicMain(nxt, cfg), cur.path + mv});
            aux.push({std::move(nxt), ng, ng + static_cast<int>(auxWeight * heuristicAux(nxt, cfg)), cur.path + mv});
        }
    }

    return {false, "", expanded, "MHA*"};
}

inline SolveResult araSolve(const State& start, int maxNodes, const SearchConfig& cfg = SearchConfig{}, double startWeight = 3.0, double endWeight = 1.0, double step = 0.5) {
    // Practical anytime wrapper: iterative weighted A* with decreasing epsilon.
    // Not a full OPEN/CLOSED reuse ARA* implementation, but same idea: quickly
    // get a suboptimal solution then improve it as epsilon decreases.
    if (startWeight < endWeight) std::swap(startWeight, endWeight);
    if (step <= 0.0) step = 0.5;
    SolveResult best{false, "", 0, "ARA*"};
    int consumed = 0;

    for (double e = startWeight; e >= endWeight - 1e-9; e -= step) {
        if (consumed >= maxNodes) break;
        int budget = maxNodes - consumed;
        auto r = weightedAStarSolve(start, budget, e, cfg, "ARA*");
        consumed += r.expanded;
        if (r.solved) {
            if (!best.solved || r.path.size() < best.path.size()) {
                best = r;
                best.algorithm = "ARA*";
            }
        }
    }
    if (endWeight < 1.0 && consumed < maxNodes) {
        auto r = weightedAStarSolve(start, maxNodes - consumed, 1.0, cfg, "ARA*");
        consumed += r.expanded;
        if (r.solved && (!best.solved || r.path.size() < best.path.size())) {
            best = r;
            best.algorithm = "ARA*";
        }
    }

    best.expanded = consumed;
    return best;
}

inline SolveResult randomRestartAStarSolve(const State& start, int maxNodes, const SearchConfig& cfg = SearchConfig{}) {
    if (isSolved(start)) return {true, "", 0, "RR-A*"};
    if (maxNodes <= 0) return {false, "", 0, "RR-A*"};

    std::uint64_t seed = cfg.randomSeed;
    if (seed == 0) {
        seed = static_cast<std::uint64_t>(
            std::chrono::high_resolution_clock::now().time_since_epoch().count());
    }
    std::mt19937_64 rng(seed);
    std::uniform_real_distribution<double> noise(0.0, std::max(0.0, cfg.randomJitter));

    int restarts = std::max(1, cfg.randomRestarts);
    int consumed = 0;
    int bestExpanded = 0;
    std::string bestPath;
    bool solved = false;

    for (int r = 0; r < restarts && consumed < maxNodes; ++r) {
        int left = maxNodes - consumed;
        int budget = std::max(1, left / (restarts - r));
        State seeded = start;
        std::string prefix;

        int prefixSteps = std::max(0, cfg.randomPrefixSteps);
        for (int step = 0; step < prefixSteps; ++step) {
            std::array<char, 4> moves{{'U', 'D', 'L', 'R'}};
            std::shuffle(moves.begin(), moves.end(), rng);
            bool moved = false;
            for (char mv : moves) {
                State nxt;
                if (!applyAction(seeded, mv, nxt)) continue;
                seeded = std::move(nxt);
                prefix.push_back(mv);
                moved = true;
                break;
            }
            if (!moved) break;
            if (isSolved(seeded)) {
                consumed += 1;
                return {true, prefix, consumed, "RR-A*"};
            }
        }

        SearchConfig localCfg = cfg;
        localCfg.astarWeight = cfg.astarWeight + noise(rng);
        auto run = weightedAStarSolve(seeded, budget, localCfg.astarWeight, localCfg, "RR-A*");
        consumed += run.expanded;

        if (run.solved) {
            std::string fullPath = prefix + run.path;
            if (!solved || fullPath.size() < bestPath.size()) {
                solved = true;
                bestPath = std::move(fullPath);
                bestExpanded = consumed;
            }
        }
    }

    if (solved) return {true, bestPath, bestExpanded, "RR-A*"};
    return {false, "", consumed, "RR-A*"};
}

inline SolveResult solveWithAlgo(const State& start, int maxNodes, SearchAlgo algo, const SearchConfig& cfg = SearchConfig{}) {
    switch (algo) {
        case SearchAlgo::BFS: return bfsSolve(start, maxNodes);
        case SearchAlgo::ASTAR: return weightedAStarSolve(start, maxNodes, cfg.astarWeight, cfg, "A*");
        case SearchAlgo::BEAM: return beamSolve(start, maxNodes, cfg.beamWidth, cfg);
        case SearchAlgo::MHA: return mhaSolve(start, maxNodes, cfg, cfg.mhaAuxWeight);
        case SearchAlgo::ARA: return araSolve(start, maxNodes, cfg, cfg.araStartWeight, cfg.araEndWeight, cfg.araStep);
        case SearchAlgo::RRASTAR: return randomRestartAStarSolve(start, maxNodes, cfg);
    }
    return bfsSolve(start, maxNodes);
}

inline SearchAlgo parseAlgo(const std::string& s) {
    if (s == "bfs" || s == "BFS") return SearchAlgo::BFS;
    if (s == "astar" || s == "a*" || s == "A*" || s == "ASTAR") return SearchAlgo::ASTAR;
    if (s == "beam" || s == "BEAM") return SearchAlgo::BEAM;
    if (s == "mha" || s == "MHA" || s == "mha*") return SearchAlgo::MHA;
    if (s == "ara" || s == "ARA" || s == "ara*") return SearchAlgo::ARA;
    if (s == "rrastar" || s == "rr-a*" || s == "rra" || s == "randastar") return SearchAlgo::RRASTAR;
    return SearchAlgo::BFS;
}

inline std::string algoName(SearchAlgo a) {
    switch (a) {
        case SearchAlgo::BFS: return "BFS";
        case SearchAlgo::ASTAR: return "A*";
        case SearchAlgo::BEAM: return "Beam";
        case SearchAlgo::MHA: return "MHA*";
        case SearchAlgo::ARA: return "ARA*";
        case SearchAlgo::RRASTAR: return "RR-A*";
    }
    return "BFS";
}

} // namespace bugma

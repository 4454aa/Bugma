#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <queue>
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

enum class SearchAlgo { BFS, ASTAR, BEAM, MHA, ARA };

struct SearchConfig {
    int beamWidth = 128;
    double astarWeight = 1.0;
    double mhaAuxWeight = 1.8;
    double araStartWeight = 3.0;
    double araEndWeight = 1.0;
    double araStep = 0.5;
};

inline int hEnemyCount(const State& s) {
    int c = 0;
    for (int x = 0; x < 14; ++x) {
        for (int y = 0; y < 14; ++y) {
            int id = s.fg[x][y];
            if (id >= 11 && id <= 26) c++;
        }
    }
    return c;
}

inline int hNearestEnemy(const State& s) {
    int best = std::numeric_limits<int>::max();
    for (int x = 0; x < 14; ++x) {
        for (int y = 0; y < 14; ++y) {
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

inline SolveResult weightedAStarSolve(const State& start, int maxNodes, double w, const std::string& name = "A*") {
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

    open.push({start, 0, static_cast<int>(w * heuristic1(start)), ""});
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
            int nf = ng + static_cast<int>(w * heuristic1(nxt));
            open.push({std::move(nxt), ng, nf, cur.path + mv});
        }
    }
    return {false, "", expanded, name};
}

inline SolveResult beamSolve(const State& start, int maxNodes, int beamWidth) {
    if (isSolved(start)) return {true, "", 0, "Beam"};
    if (beamWidth <= 0) beamWidth = 64;

    struct Node { State s; std::string path; int score = 0; };
    std::vector<Node> frontier{{start, "", heuristic1(start)}};
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
                next.push_back({std::move(nxt), std::move(np), heuristic1(nxt)});
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

inline SolveResult mhaSolve(const State& start, int maxNodes, double auxWeight = 1.8) {
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

    anchor.push({start, 0, heuristic1(start), ""});
    aux.push({start, 0, static_cast<int>(auxWeight * heuristic2(start)), ""});
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
            anchor.push({nxt, ng, ng + heuristic1(nxt), cur.path + mv});
            aux.push({std::move(nxt), ng, ng + static_cast<int>(auxWeight * heuristic2(nxt)), cur.path + mv});
        }
    }

    return {false, "", expanded, "MHA*"};
}

inline SolveResult araSolve(const State& start, int maxNodes, double startWeight = 3.0, double endWeight = 1.0, double step = 0.5) {
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
        auto r = weightedAStarSolve(start, budget, e, "ARA*");
        consumed += r.expanded;
        if (r.solved) {
            if (!best.solved || r.path.size() < best.path.size()) {
                best = r;
                best.algorithm = "ARA*";
            }
        }
    }
    if (endWeight < 1.0 && consumed < maxNodes) {
        auto r = weightedAStarSolve(start, maxNodes - consumed, 1.0, "ARA*");
        consumed += r.expanded;
        if (r.solved && (!best.solved || r.path.size() < best.path.size())) {
            best = r;
            best.algorithm = "ARA*";
        }
    }

    best.expanded = consumed;
    return best;
}

inline SolveResult solveWithAlgo(const State& start, int maxNodes, SearchAlgo algo, const SearchConfig& cfg = SearchConfig{}) {
    switch (algo) {
        case SearchAlgo::BFS: return bfsSolve(start, maxNodes);
        case SearchAlgo::ASTAR: return weightedAStarSolve(start, maxNodes, cfg.astarWeight, "A*");
        case SearchAlgo::BEAM: return beamSolve(start, maxNodes, cfg.beamWidth);
        case SearchAlgo::MHA: return mhaSolve(start, maxNodes, cfg.mhaAuxWeight);
        case SearchAlgo::ARA: return araSolve(start, maxNodes, cfg.araStartWeight, cfg.araEndWeight, cfg.araStep);
    }
    return bfsSolve(start, maxNodes);
}

inline SearchAlgo parseAlgo(const std::string& s) {
    if (s == "bfs" || s == "BFS") return SearchAlgo::BFS;
    if (s == "astar" || s == "a*" || s == "A*" || s == "ASTAR") return SearchAlgo::ASTAR;
    if (s == "beam" || s == "BEAM") return SearchAlgo::BEAM;
    if (s == "mha" || s == "MHA" || s == "mha*") return SearchAlgo::MHA;
    if (s == "ara" || s == "ARA" || s == "ara*") return SearchAlgo::ARA;
    return SearchAlgo::BFS;
}

inline std::string algoName(SearchAlgo a) {
    switch (a) {
        case SearchAlgo::BFS: return "BFS";
        case SearchAlgo::ASTAR: return "A*";
        case SearchAlgo::BEAM: return "Beam";
        case SearchAlgo::MHA: return "MHA*";
        case SearchAlgo::ARA: return "ARA*";
    }
    return "BFS";
}

} // namespace bugma

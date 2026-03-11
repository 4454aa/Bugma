#include <algorithm>
#include <chrono>
#include <fstream>
#include <iostream>
#include <map>
#include <regex>
#include <string>

struct LevelRecord {
    bool cleared = true;
    int bestSteps = 0;
    std::string replay;
};

static void usage() {
    std::cout
        << "Usage: make_replay_save --level-id <id> --replay <UDLR...> [--steps N] [--color N] [--output path]\n";
}

static bool isReplayValid(const std::string& replay) {
    return std::all_of(replay.begin(), replay.end(), [](char c) {
        return c == 'U' || c == 'D' || c == 'L' || c == 'R';
    });
}

static std::string readAll(const std::string& path) {
    std::ifstream ifs(path, std::ios::binary);
    if (!ifs) return "";
    return std::string((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
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

static std::map<std::string, LevelRecord> parseExistingLevels(const std::string& json) {
    std::map<std::string, LevelRecord> out;
    size_t levelsKey = json.find("\"levels\"");
    if (levelsKey == std::string::npos) return out;

    size_t objStart = json.find('{', levelsKey);
    if (objStart == std::string::npos) return out;
    size_t objEnd = findMatchingBrace(json, objStart);
    if (objEnd == std::string::npos || objEnd <= objStart) return out;

    std::string body = json.substr(objStart + 1, objEnd - objStart - 1);

    std::regex entryRe(R"rx("([^"]+)"\s*:\s*\{([\s\S]*?)\})rx");
    std::regex replayRe(R"rx("replay"\s*:\s*"([UDLRudlr]*)")rx");
    std::regex stepsRe(R"rx("bestSteps"\s*:\s*([0-9]+))rx");
    std::regex clearedRe(R"rx("cleared"\s*:\s*(true|false))rx");

    for (auto it = std::sregex_iterator(body.begin(), body.end(), entryRe); it != std::sregex_iterator(); ++it) {
        LevelRecord rec;
        std::string key = (*it)[1].str();
        std::string entry = (*it)[2].str();

        std::smatch m;
        if (std::regex_search(entry, m, replayRe)) rec.replay = m[1].str();
        if (std::regex_search(entry, m, stepsRe)) rec.bestSteps = std::stoi(m[1].str());
        if (std::regex_search(entry, m, clearedRe)) rec.cleared = (m[1].str() == "true");

        if (!rec.replay.empty()) {
            std::transform(rec.replay.begin(), rec.replay.end(), rec.replay.begin(), [](unsigned char c) {
                return static_cast<char>(std::toupper(c));
            });
        }

        out[key] = rec;
    }

    return out;
}

int main(int argc, char** argv) {
    std::string levelId;
    std::string replay;
    std::string output = "banmen_save_import.json";
    int color = 0;
    int steps = -1;

    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        auto needValue = [&](const std::string& name) -> const char* {
            if (i + 1 >= argc) {
                std::cerr << "Missing value for " << name << "\n";
                std::exit(2);
            }
            return argv[++i];
        };

        if (a == "--level-id") levelId = needValue(a);
        else if (a == "--replay") replay = needValue(a);
        else if (a == "--steps") steps = std::stoi(needValue(a));
        else if (a == "--color") color = std::stoi(needValue(a));
        else if (a == "--output") output = needValue(a);
        else if (a == "--help" || a == "-h") {
            usage();
            return 0;
        } else {
            std::cerr << "Unknown arg: " << a << "\n";
            usage();
            return 2;
        }
    }

    if (levelId.empty() || replay.empty()) {
        usage();
        return 2;
    }

    std::transform(replay.begin(), replay.end(), replay.begin(), [](unsigned char c) {
        return static_cast<char>(std::toupper(c));
    });

    if (!isReplayValid(replay)) {
        std::cerr << "replay must contain only U/D/L/R\n";
        return 2;
    }

    if (steps < 0) steps = static_cast<int>(replay.size());

    const std::string levelKey = color > 0 ? (levelId + "_c" + std::to_string(color)) : levelId;

    auto records = parseExistingLevels(readAll(output));

    auto it = records.find(levelKey);
    if (it == records.end()) {
        records[levelKey] = LevelRecord{true, steps, replay};
    } else {
        it->second.cleared = true;
        if (it->second.bestSteps <= 0 || steps < it->second.bestSteps || it->second.replay.empty()) {
            it->second.bestSteps = steps;
            it->second.replay = replay;
        }
    }

    const auto now = std::chrono::time_point_cast<std::chrono::milliseconds>(
                         std::chrono::system_clock::now())
                         .time_since_epoch()
                         .count();

    std::ofstream ofs(output, std::ios::binary);
    if (!ofs) {
        std::cerr << "Cannot write output: " << output << "\n";
        return 1;
    }

    ofs << "{\n"
        << "  \"version\": 1,\n"
        << "  \"timestamp\": " << now << ",\n"
        << "  \"game\": \"BanmenHTML5\",\n"
        << "  \"content\": {\n"
        << "    \"levels\": {\n";

    bool first = true;
    for (const auto& kv : records) {
        if (!first) ofs << ",\n";
        first = false;
        ofs << "      \"" << kv.first << "\": {\n"
            << "        \"cleared\": " << (kv.second.cleared ? "true" : "false") << ",\n"
            << "        \"bestSteps\": " << kv.second.bestSteps << ",\n"
            << "        \"replay\": \"" << kv.second.replay << "\"\n"
            << "      }";
    }

    ofs << "\n"
        << "    }\n"
        << "  }\n"
        << "}\n";

    std::cout << "Wrote " << output << "\n";
    std::cout << "level_key=" << levelKey << "\n";
    std::cout << "steps=" << steps << "\n";
    std::cout << "records_total=" << records.size() << "\n";
    return 0;
}

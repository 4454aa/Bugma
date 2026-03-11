#include <algorithm>
#include <chrono>
#include <fstream>
#include <iostream>
#include <string>

static void usage() {
    std::cout
        << "Usage: make_replay_save --level-id <id> --replay <UDLR...> [--steps N] [--color N] [--output path]\n";
}

static bool isReplayValid(const std::string& replay) {
    return std::all_of(replay.begin(), replay.end(), [](char c) {
        return c == 'U' || c == 'D' || c == 'L' || c == 'R';
    });
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
        << "    \"levels\": {\n"
        << "      \"" << levelKey << "\": {\n"
        << "        \"cleared\": true,\n"
        << "        \"bestSteps\": " << steps << ",\n"
        << "        \"replay\": \"" << replay << "\"\n"
        << "      }\n"
        << "    }\n"
        << "  }\n"
        << "}\n";

    std::cout << "Wrote " << output << "\n";
    std::cout << "level_key=" << levelKey << "\n";
    std::cout << "steps=" << steps << "\n";
    return 0;
}

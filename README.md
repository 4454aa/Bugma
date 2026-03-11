# Bug与魔法使 HTML5版

## 关于这个项目

这是对DLsite上的作品 [バグと魔法使い](https://www.dlsite.com/maniax/work/=/product_id/RJ01195085.html) 的非官方HTML5移植版本，并非原创的游戏内容。

## 原作者信息

- 原作者：[フシギ](https://x.com/futhigi)
- 原版游戏：[バグと魔法使い](https://www.dlsite.com/maniax/work/=/product_id/RJ01195085.html)（DLsite）

## 自定义关卡出处

游戏默认内置了两套大佬做的自定义关卡：
- [想うが儘にもの作り: バグと魔法使いの自作カスタムステージ](https://soushinsoujin989.blogspot.com/2024/06/BugMaCustomStage.html)（日本大佬做的）
- [GitHub - xumingkuan/bugma-custom-levels](https://github.com/xumingkuan/bugma-custom-levels)（国内大佬做的）

## 游戏规则

参见萌娘百科：[BUG与魔法使](https://zh.moegirl.org.cn/BUG%E4%B8%8E%E9%AD%94%E6%B3%95%E4%BD%BF)

## 项目发布

- Bilibili发布文章：[Bug与魔法使全年龄网页版(支持电脑，手机)](https://www.bilibili.com/opus/1149995811582509075)
- 在线游玩链接：[the-wizard-of-bug.netlify.app](https://the-wizard-of-bug.netlify.app/)

---

## C++ 求解器与回放工具（g++ 原生构建）

> 不再提供 CMake 作为构建路径，统一使用 `g++` 直接编译。

当前 `cpp/` 下包含两个可执行工具：

- `bugma_solver`：关卡求解器（支持 BFS / A* / Beam / MHA* / ARA*）
- `make_replay_save`：把 UDLR 路径写成前端可导入 JSON（支持读旧文件并合并）

### 逻辑移植说明

当前 C++ 版本已移植大部分核心回合机制（推箱、心堆叠、形态切换、主要战斗分支、胜负结算等），可用于批量求解和回放验证；但与前端 JS 仍可能存在边缘行为差异，建议以实机回放复核。

近期已修复催眠怪（e5）战斗分支中主角血条击飞（`heroinehptobasu`）的实现偏差，使其与前端 `BattleLogic` 的变换规则一致。

### 构建

> 仓库已预置 `cpp/build/` 目录（含 `.gitkeep`），可直接编译输出可执行文件。

```bash
g++ -std=c++17 -O2 -o cpp/build/bugma_solver cpp/src/main.cpp

g++ -std=c++17 -O2 -o cpp/build/make_replay_save cpp/tools/make_replay_save.cpp
```

### 求解器使用

```bash
./cpp/build/bugma_solver <levelId> [maxNodes] [colorOverride] [--algo bfs|astar|beam|mha|ara] [--beam N]
```

- `levelId`：关卡ID（如 `1`、`61`、`1-1`）
- `maxNodes`：搜索节点上限（默认 `120000`）
- `colorOverride`：官方变色关覆盖颜色（如 `1/2/3/4/6`）
- `--algo`：算法选择，默认 `bfs`
- `--beam`：Beam Search 的宽度（默认 `128`）

示例：

```bash
./cpp/build/bugma_solver 1 12000
./cpp/build/bugma_solver 61 12000 4
./cpp/build/bugma_solver 1-1 12000
./cpp/build/bugma_solver 1 20000 --algo astar
./cpp/build/bugma_solver 1 20000 --algo beam --beam 256
```

### 求解算法原理（当前实现）

- 支持 **BFS / A* / Beam Search / MHA* / ARA*** 五种策略。
- 一个状态节点包含：前景网格、角色形态、朝向、主题色、无敌状态、胜负状态等。
- 每个节点扩展 4 个动作（`U/D/L/R`），并执行完整回合结算（移动、战斗、地板触发、胜负检查）。
- BFS 在给定规则和节点上限内找到解时通常是“步数最短解”；其余启发式算法更偏向在大图上更快找可行解。
- `maxNodes` 是搜索预算上限。

### 运行模式说明

`bugma_solver` 有两种运行方式：

- **直接运行（单关模式）**：不加 `--interactive` 时默认进入。你需要在命令行里直接给关卡参数，程序会只求解这一关并输出结果。
- **交互模式**：加 `--interactive`（或 `-i`）后进入菜单式批量求解，可选 official/random/custom、范围和算法。

### 交互式求解模式

```bash
./cpp/build/bugma_solver --interactive
```

交互项支持：

- 输入模式：`1=official / 2=random / 3=custom`
- 输入节点上限（`maxNodes`）
- 输入算法（`bfs/astar/beam/mha/ara`，beam 可额外输入 `beamWidth`）
- 输入关卡范围：支持 `11`、`11-22`、`1,3,5-8`、`ALL`
- 逐关打印：算法名、是否解出、步数、扩展节点数、耗时

交互模式会启动时显示三个模式各自关卡数量，并读取现有 `cpp/banmen_save_import.json`，打印未解关卡（官方与随机会尽量合并区间，custom打印总未解数）。

存档 key 与前端对齐规则：

- official：与前端一致，`1-52` 会按关卡配置自动使用 `id_c<color>`（例如 `1_c1`）；`61-67` 变色组使用 `61_c1` 这类 key。
- random：仅使用 `js/generated_levels.js` 作为数据源，并写入 `gen_<id>` key。
- custom：使用 `js/custom_levels.js`，并写入 `custom_<id>` key。

### 回放 JSON 生成（可导入网页）

```bash
./cpp/build/make_replay_save --level-id 1 --replay RRRRRR --output my_replay.json
```

可选参数：

- `--steps`：手动指定 `bestSteps`（默认等于 replay 长度）
- `--color`：官方变色关颜色覆盖（会生成 `<levelId>_c<color>` key）
- `--output`：输出文件名

#### 写入行为

- 如果 `--output` 文件不存在：创建新 JSON。
- 如果文件存在：读取 `content.levels` 并按 key 合并写回：
  - key 不存在：新增该关记录。
  - key 已存在：保留更优步数（更小 `bestSteps`）或补齐空 replay。

#### 导入网页测试

交互式求解后会自动输出两个文件到 `cpp/`：

- `banmen_save_import.json`（直接 IMPORT）
- `banmen_save_import.js`（同结构的 JS 常量形式）


1. 打开网页中的 `DATA I/O`
2. 点击 `IMPORT`
3. 选择生成的 JSON
4. 刷新后在选关按钮点 `▶` 回放

## 版权说明

这个项目完全是出于**个人学习目的**制作的，仅用于HTML5游戏开发技术的学习和研究，没有任何商业用途。所有游戏素材和核心玩法均属于原作者所有。

如果您喜欢这个游戏，强烈建议您去DLsite支持原版作品。

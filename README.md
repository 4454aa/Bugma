# Bug与魔法使 HTML5版

## 关于这个项目

这是对DLsite上的作品 [バグと魔法使い](https://www.dlsite.com/maniax/work/=/product_id/RJ01195085.html) 的非官方HTML5移植版本，并非原创的游戏内容。

**在线游玩：** [the-wizard-of-bug.netlify.app](https://the-wizard-of-bug.netlify.app/)

## 原作者信息

- 原作者：[フシギ](https://x.com/futhigi)
- 原版游戏：[バグと魔法使い](https://www.dlsite.com/maniax/work/=/product_id/RJ01195085.html)（DLsite）

## 自定义关卡出处

游戏默认内置了两套大佬做的自定义关卡：
- [想うが儘にもの作り: バグと魔法使いの自作カスタムステージ](https://soushinsoujin989.blogspot.com/2024/06/BugMaCustomStage.html)（日本大佬做的）
- [GitHub - xumingkuan/bugma-custom-levels](https://github.com/xumingkuan/bugma-custom-levels)（国内大佬做的）

## 游戏规则

参见萌娘百科：[BUG与魔法使](https://zh.moegirl.org.cn/BUG%E4%B8%8E%E9%AD%94%E6%B3%95%E4%BD%BF)

---

## 本地运行

游戏本体是纯静态 HTML5 项目，**无需编译、无需安装任何依赖**。

> **直接双击 `index.html` 即可在浏览器中游玩**，无需任何服务器。所有资源使用相对路径加载，完全自包含。

如果希望用本地服务器运行（可选）：

```bash
python -m http.server 9876
# 然后访问 http://127.0.0.1:9876/
```

> **游戏本体完全独立**：`index.html` + `js/` + `css/` + `assets/` 即可运行，不依赖 C++ 编译器、不依赖关卡编辑器。

---

## 项目结构

```
Bugma/
├── index.html              ← 游戏入口
├── js/                     ← 游戏核心代码（纯前端，无外部依赖）
│   ├── Constants.js            实体ID、方向常量、图鉴数据
│   ├── LevelTokens.js          关卡 token 到数值ID的映射
│   ├── levels.js               官方关卡数据（ALL_LEVELS）
│   ├── custom_levels.js        自定义关卡数据（CUSTOM_LEVELS）
│   ├── generated_levels.js     随机生成关卡数据（GENERATED_LEVELS）
│   ├── GameState.js            网格状态、玩家状态、快照/撤销
│   ├── LevelLoader.js          关卡加载（支持任意矩形尺寸）
│   ├── BattleLogic.js          战斗机制
│   ├── MovementLogic.js        移动、推箱、心堆叠、形态切换
│   ├── VisualLogic.js          自动拼接和视觉效果
│   ├── Render.js               Canvas 渲染（光源对齐原版 C# sun.cs）
│   ├── RenderConfig.js         渲染配置
│   ├── SaveSystem.js           存档系统（localStorage + JSON 导入导出）
│   ├── UIManager.js            UI 状态机
│   └── Game.js                 主入口：模块组装、输入处理、游戏循环
├── css/                    ← 样式
│   └── style.css
├── assets/                 ← 精灵图和贴图
├── editor/                 ← 独立工具：关卡编辑器
│   ├── index.html              编辑器入口
│   ├── editor.js               编辑器核心逻辑
│   └── editor.css              编辑器样式
├── cpp/                    ← 独立工具：C++ 求解器
│   ├── src/
│   │   ├── main.cpp            求解器主程序
│   │   └── search_algorithms.hpp  搜索算法
│   ├── tools/
│   │   └── make_replay_save.cpp   回放 JSON 生成工具
│   └── build/
└── bundle.py               ← 单文件打包脚本
```

### 三者关系

| 组件 | 依赖关系 | 说明 |
|------|----------|------|
| **游戏本体** | 无外部依赖 | 纯 HTML5/CSS/JS，浏览器直接运行 |
| **关卡编辑器** | 共享 `js/LevelTokens.js` | 独立 HTML 页面，不影响游戏 |
| **C++ 求解器** | 读取 `js/*.js` 关卡文件 | 命令行工具，不影响游戏 |

游戏运行时 **不会** 加载 `editor/` 或 `cpp/` 的任何文件。

---

## 单文件构建（用于部署）

项目根目录的 `bundle.py` 脚本可以将整个游戏打包为单个 HTML 文件，包括所有 JS、CSS 和图片资源（内嵌为 Base64 Data URI）。

```bash
python bundle.py
```

输出文件为 `bugma.html`，可直接用浏览器打开，也适合部署到 Netlify 等静态托管平台（配合 `netlify.toml`）。

---

## 关卡编辑器

### 入口

独立的 HTML 关卡编辑器，位于 `editor/index.html`。

> **直接双击 `editor/index.html` 即可在浏览器中打开编辑器**，大部分功能（编辑、导出 TXT/JSON/JS）均可正常使用。
> **但 PNG 导出需要 Canvas 的 `toDataURL()` 方法**，该方法在 `file://` 协议下可能因浏览器安全策略被阻止（画布被"污染"）。如果遇到 PNG 导出报错，请通过本地服务器访问编辑器：
>
> ```
> python -m http.server 9876
> # 访问 http://127.0.0.1:9876/editor/index.html
> ```

编辑器与游戏本体共享 `js/LevelTokens.js`，使用相同的 token 定义，保证关卡数据在两个环境中的一致性。

### 界面概览

- **左侧画布**：当前关卡的像素级预览，可直接点击/拖拽放置或擦除方块
- **右侧面板**：
  - **调色板**：所有可用的地形、心、敌人、地板方块，分 tab 展示
  - **元信息**：关卡名称、作者、备注（会随 JSON/PNG 导出）
  - **工具条**：撤销/重做、清除画布、调整尺寸
  - **导出/导入区**：多种格式的导出和导入按钮

### 功能详解

#### 编辑操作

- **左键点击/拖拽**：在画布上放置当前选中的 token
- **右键点击**：擦除该格（设为 `__` 空地）
- **滚轮**：缩放画布预览
- **Ctrl+Z / Ctrl+Y**：撤销 / 重做（最多 80 步）
- **删除键**：清除当前选中的全部 token 实例

#### 预设尺寸

编辑器内建四种常用网格尺寸：

| 预设 | 尺寸 | 适用场景 |
|------|------|----------|
| 14×14 | 标准 | 与原版官方关卡一致 |
| 10×8 | 小型 | 短小关卡 |
| 20×14 | 中型 | 较大关卡 |
| 24×16 | 大型 | 大型关卡 |

也支持自由调整：宽 4-40，高 4-30。

#### 主角形态

- **Shirley（银）**：mode=1，初始形态为银色
- **Ella（粉）**：mode=2，初始形态为粉色

只需在画布上放置一个 `he`（主角）token，然后切换形态即可。CS 格式导出时分别对应 `SHI` 和 `ELL`。

#### 主题色

- 0 = 无（默认灰色地板）
- 1 = 蓝
- 2 = 红
- 3 = 绿
- 4 = 黄
- 6 = 紫

选色后，关卡会使用对应颜色的地板和装饰。CS 格式导出时，颜色名会作为最后一行写入文件。

#### 校验

编辑器内置校验功能，使用真实的 `LevelLoader` 逻辑检查：
- 是否有且仅有一个主角 (`he`) 方块
- 地形是否合法（心块不能悬浮等）
- 关卡是否可正常加载

### 导出格式

编辑器支持四种导出格式：

#### 1. 文本格式 (`.txt`)

**CS 兼容格式**（推荐用于与原版互通）：

```
___ ___ ___ ___ ___ ___ ||| ||| ||| ___ ___ ___ ___
___ ___ _3_ ___ ___ ___ ||| ||| ||| ___ _1_ ___ ___
___ ___ ___ _B_ ___ ___ ||| ||| ||| ___ Gob ___ ___
...
Blue
```

- 使用原版 C# `banmen.cs` 定义的 3 字符 token 系统
- 标准 14×14 关卡导出 10 行 × 12 列（与原版一致）
- 非标准尺寸关卡导出完整网格
- 最后一行可选颜色名：`Blue` / `Red` / `Green` / `Yellow` / `Purple` / 空格（无色）
- 可直接被原版 C# 游戏的 `customyobidashi()` 读取
- 方块不足 10 行时自动补齐空行

#### 10×12 导出区域与 14×14 网格的偏移关系

编辑器使用 14×14 的完整网格（坐标 0-13），而原版 C# 自定义格式只保存内部 10×12 的游戏区域。导出时：

- **水平偏移**：从第 1 列开始，取 12 列（即跳过最左列 `x=0` 和最右列 `x=13`）
- **垂直偏移**：从第 3 行开始，取 10 行（即跳过顶部 3 行 `y=0,1,2` 和底部 1 行 `y=13`）
- 被跳过的外侧格子（`x=0`、`x=13`、`y=0-2`、`y=13`）在原版格式中固定为墙壁 `|||`

```
      0  1  2  3  4  5  6  7  8  9 10 11 12 13
  0  || || || || || || || || || || || || || ||   ← 顶部墙壁（跳过）
  1  || || || || || || || || || || || || || ||   ← 顶部墙壁（跳过）
  2  || || || || || || || || || || || || || ||   ← 顶部墙壁（跳过）
  3  ||  .  .  .  .  .  .  .  .  .  .  .  ||   ← 导出第 1 行
  4  ||  .  .  .  .  .  .  .  .  .  .  .  ||   ← 导出第 2 行
 ... ||  .  .  .  .  .  .  .  .  .  .  .  ||      ...
 12  ||  .  .  .  .  .  .  .  .  .  .  .  ||   ← 导出第 10 行
 13  || || || || || || || || || || || || || ||   ← 底部墙壁（跳过）
      ← 跳过 x=0          内部 10×12      跳过 x=13 →
```

> **注意**：原版 C# 不存在的 JS 方块（如半墙 `-\|`、封印 `s1`-`s9`、砖块 `b1`-`b5`、覆盖心 `k1`-`k9` 等）在导出为 CS 格式时会变为 `___`（空地）。

#### 2. JSON 格式 (`.json`)

```json
{
  "width": 14,
  "height": 14,
  "color": 0,
  "mode": 2,
  "map": ["||", "||", ..., "__", "he", ...],
  "meta": {
    "id": "my-stage",
    "name": "我的关卡",
    "author": "作者名",
    "notes": "备注",
    "editor": "Bugma HTML Level Editor",
    "editorVersion": "xxx"
  }
}
```

完整的关卡数据结构，包含所有元信息。适合导入回编辑器或发给其他玩家。

#### 3. JS 代码片段 (`.js`)

```javascript
CUSTOM_LEVELS.push({
  id: "my-stage",
  name: "我的关卡",
  author: "作者名",
  width: 14,
  height: 14,
  color: 0,
  mode: 2,
  map: ["||", "||", ...]
});
```

可直接追加到 `custom_levels.js` 中，使关卡出现在游戏的 CUSTOM 选关列表中。

#### 4. PNG 格式 (`.png`)

- 关卡截图（4x 像素缩放）+ 关卡完整数据嵌入 PNG 元数据
- 数据存储在 PNG `tEXt` 辅助块中，keyword 为 `bugma-level-json`，value 为 `base64:<Base64编码的JSON>`
- 还附带一个 `Description` 文本块，包含关卡 ID
- 导入时自动检测 PNG 格式，提取元数据并还原关卡
- 可方便地在社交平台分享（图片附带了关卡数据）

### 导入

编辑器支持三种导入方式：

1. **文件导入**：点击 Import 按钮，选择 `.png`、`.json`、`.txt` 或 `.js` 文件
   - PNG：自动提取元数据中的关卡 JSON
   - JSON：直接解析
   - TXT：自动检测格式（CS 3字符 / JSON / 旧版 2 字符格式）
   - JS：提取 `CUSTOM_LEVELS.push(...)` 中的关卡对象
2. **粘贴导入**：直接将关卡文本（TXT/JSON/JS）粘贴到文本框中导入
3. **格式自动检测**：
   - 优先检测 CS 3 字符格式（空格分隔的 `___`/`\|\|\|`/`Gob` 等 token）
   - 其次尝试 JSON 解析
   - 最后尝试旧版格式（2 字符 token 数组、行内无空格等）

### 自定义关卡与原版 C# 游戏的配合

编辑器导出的 CS 格式 TXT 文件可以在原版 C# 游戏中使用：

1. 将 TXT 文件放置到原版游戏的 `custom/` 目录
2. 在原版游戏主菜单选择「カスタム」（Custom）
3. 原版游戏的 `customyobidashi()` 函数会读取该文件并解析为关卡

**兼容性说明**：

- 标准 14×14 关卡完全兼容（编辑器导出 10×12 内部区域 + 外围墙壁）
- 非标准尺寸关卡：CS 格式会导出完整网格，但原版游戏仅支持 14×14，无法加载
- JS 独有的方块类型在导出为 CS 格式时会静默转换为 `___`（空地）
- 主题色通过文件最后一行的颜色名称传递（`Blue`/`Red`/`Green`/`Yellow`/`Purple`）

### 自定义关卡与网页版游戏的配合

网页版游戏内置了两套自定义关卡（`custom_levels.js`），通过游戏主菜单的 CUSTOM tab 可直接游玩。

如果需要将自己编辑的关卡加入游戏：

**方法 1：通过编辑器导出 JS 代码片段**

1. 在编辑器中完成关卡设计，点击「Export JS」导出 `.js` 文件
2. 将文件内容追加到 `js/custom_levels.js` 末尾
3. 重新加载游戏，关卡会出现在 CUSTOM 列表中

**方法 2：通过编辑器导出 JSON**

1. 导出 JSON 文件
2. 在游戏中进入 DATA I/O → IMPORT，选择 JSON 文件
3. 导入后游戏会记住该关卡的完成状态和回放数据

**方法 3：通过编辑器导出 PNG**

1. 导出 PNG 文件
2. 在编辑器中 Import 该 PNG 即可还原关卡
3. PNG 可方便地分享给其他玩家（社交平台、论坛等）

### 注意事项

1. **主角位置**：必须放置且仅放置一个 `he` 方块。编辑器会校验此项。
2. **心块位置**：心块建议放在有支撑的地形上（如墙壁上方），悬浮的心块虽然技术上可能被校验接受，但实际游戏中可能不可达。
3. **敌人位置**：确保敌人所在位置玩家可以从起始位置到达。
4. **地形大小**：14×14 为原版标准尺寸，与 CS 格式完全兼容。其他尺寸在 CS 导出时会导出完整网格，但可能无法被原版 C# 游戏加载。
5. **主题色**：如果不需要主题色，将 `color` 设为 0。PNG/JSON 导出会保留当前选色信息。
6. **存档覆盖**：使用 `custom_levels.js` 方式加入游戏的自定义关卡，存档 key 为 `custom_<id>`。确保不同关卡的 `id` 不重复，否则存档会互相覆盖。
7. **半墙等 JS 独占方块**：编辑器有全套方块可用，但导出为 CS TXT 格式时，原版不存在的方块会变成空地。如果目标是原版兼容，请只用与原版 C# 对应的方块类型。

---

## C++ 求解器

独立的命令行求解器，支持多种搜索算法。用于批量求解关卡、验证关卡可解性、生成回放数据。

> **注意**：C++ 求解器是可选的开发者工具，与游戏本体无关。

### 逻辑移植说明

当前 C++ 版本已移植大部分核心回合机制（推箱、心堆叠、形态切换、主要战斗分支、胜负结算等），可用于批量求解和回放验证；但与前端 JS 仍可能存在边缘行为差异，建议以实机回放复核。

### 构建

> 仓库已预置 `cpp/build/` 目录（含 `.gitkeep`），可直接编译输出可执行文件。
> 注意：`cpp/build/` 下二进制产物请勿提交到 Git（分支更新/PR 流程可能拒绝二进制）。

```bash
# 求解器主程序
g++ -std=c++17 -O2 -o cpp/build/bugma_solver cpp/src/main.cpp

# 回放 JSON 生成工具
g++ -std=c++17 -O2 -o cpp/build/make_replay_save cpp/tools/make_replay_save.cpp
```

**编译依赖**：C++17 编译器（GCC 7+ / Clang 5+ / MSVC 2017+），无其他外部库依赖。

### 求解器使用

```bash
./cpp/build/bugma_solver <levelId> [maxNodes] [colorOverride] [options]
```

#### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `levelId` | 关卡ID（如 `1`、`61`、`1-1`、`0`） | 必填 |
| `maxNodes` | 搜索节点上限 | `120000` |
| `colorOverride` | 官方变色关覆盖颜色（1/2/3/4/6） | 按关卡配置 |

#### 算法选项

| 选项 | 说明 |
|------|------|
| `--algo bfs` | 广度优先搜索（默认，找最短解） |
| `--algo astar` | A* 搜索 |
| `--algo beam` | Beam Search（`--beam N` 设宽度，默认 128） |
| `--algo mha` | MHA*（多启发式 A*） |
| `--algo ara` | ARA*（退火权重 A*） |
| `--algo rrastar` | RR-A*（随机重启 A*） |

#### 启发式选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--astar-w W` | Weighted A* 启发式权重 | `1.0` |
| `--beam N` | Beam Search 宽度 | `128` |
| `--mha-aux-w W` | MHA* 辅助启发式权重 | `1.8` |
| `--ara-start-w W` | ARA* 起始权重 | `3.0` |
| `--ara-end-w W` | ARA* 终止权重 | `1.0` |
| `--ara-step S` | ARA* 权重步长 | `0.5` |
| `--hp-heuristic` | 开启血量/心块导向启发式 | 关闭 |
| `--hp-w W` | 血量启发式权重 | `1.0` |
| `--safe-purple` | 紫色无敌关卡保护模式 | 开启 |
| `--no-safe-purple` | 关闭紫色保护模式 | — |
| `--purple-risk-w W` | 紫色风险惩罚权重 | `6.0` |

#### RR-A* 随机参数

| 选项 | 说明 |
|------|------|
| `--random-restarts N` | 随机重启次数 |
| `--random-prefix N` | 随机前缀长度 |
| `--random-jitter J` | 随机抖动幅度 |
| `--random-seed S` | 随机种子 |

#### 使用示例

```bash
# 基础用法：求解关卡 1，12 万节点上限
./cpp/build/bugma_solver 1 12000

# 变色关：求解关卡 61，颜色 4（黄）
./cpp/build/bugma_solver 61 12000 4

# 使用 A* 算法
./cpp/build/bugma_solver 1 20000 --algo astar

# A* + 启发式权重
./cpp/build/bugma_solver 1 20000 --algo astar --astar-w 1.4

# Beam Search（大图快速找可行解）
./cpp/build/bugma_solver 1 20000 --algo beam --beam 256

# ARA* 退火求解
./cpp/build/bugma_solver 1 20000 --algo ara --ara-start-w 2.8 --ara-end-w 1.0 --ara-step 0.4

# 带血量启发式的 A*
./cpp/build/bugma_solver 2 120000 --algo astar --astar-w 1.0 --hp-heuristic --hp-w 1.2

# 紫色保护模式
./cpp/build/bugma_solver 61 200000 6 --algo astar --hp-heuristic --safe-purple --purple-risk-w 5.0
```

#### 实验性功能

```bash
./cpp/build/bugma_solver --audit-rules          # 审计游戏规则
./cpp/build/bugma_solver --test-headpath-original  # 测试头部路径
./cpp/build/bugma_solver --audit-diode          # 审计二极管
./cpp/build/bugma_solver --search-body-latch    # 搜索身体闩锁
```

### 交互式求解模式

```bash
./cpp/build/bugma_solver --interactive
```

进入菜单式批量求解，支持：

- **关卡来源**：`1=official` / `2=random` / `3=custom`
- **节点上限**：自定义 `maxNodes`
- **算法选择**：`bfs/astar/beam/mha/ara/rrastar`（可配置各算法参数）
- **启发式选项**：`useHpHeuristic`、`hpHeuristicWeight`、`safePurpleMode`、`purpleRiskWeight`
- **关卡范围**：支持多种格式
  - 单个：`11`
  - 范围：`11-22`
  - 混合：`1,3,5-8`
  - 全部：`ALL`
  - 仅未解：`UNSOLVED`
- **逐关输出**：算法名、是否解出、步数、扩展节点数、耗时

#### 存档 key 对齐规则

求解器生成的存档 key 与网页版前端完全一致：

| 关卡类型 | key 格式 | 示例 |
|----------|----------|------|
| 官方普通关 | `<id>` | `1`、`52` |
| 官方变色关 | `<id>_c<color>` | `1_c1`、`61_c4` |
| 随机生成关 | `gen_<id>` | `gen_0` |
| 自定义关卡 | `custom_<id>` | `custom_my-stage` |

### 回放 JSON 生成

```bash
./cpp/build/make_replay_save --level-id 1 --replay RRRRRR --output my_replay.json
```

#### 可选参数

| 参数 | 说明 |
|------|------|
| `--steps N` | 手动指定 `bestSteps`（默认等于 replay 长度） |
| `--color C` | 变色关颜色覆盖（生成 `<levelId>_c<color>` key） |
| `--output FILE` | 输出文件名 |

#### 写入行为

- 文件不存在：创建新 JSON
- 文件已存在：读取 `content.levels` 并按 key 合并：
  - key 不存在 → 新增
  - key 已存在 → 保留更优步数（更小 `bestSteps`）或补齐空 replay

#### 导入网页测试

交互式求解后会自动输出两个文件到 `cpp/` 目录：

- `banmen_save_import.json`：直接通过网页 DATA I/O → IMPORT 导入
- `banmen_save_import.js`：同结构的 JS 常量形式

导入步骤：

1. 打开网页中的 DATA I/O
2. 点击 IMPORT
3. 选择生成的 JSON 文件
4. 刷新后在选关界面点 ▶ 回放

### 求解算法原理

- 支持 **BFS / A\* / Beam Search / MHA\* / ARA\* / RR-A\*** 六种策略
- 一个状态节点包含：前景网格、角色形态、朝向、主题色、无敌状态、胜负状态等
- 每个节点扩展 4 个动作（`U/D/L/R`），执行完整回合结算（移动、战斗、地板触发、胜负检查）
- BFS 在给定规则和节点上限内找到解时通常是「步数最短解」
- 启发式算法（A\*、Beam 等）更偏向在大图上快速找可行解
- `maxNodes` 是搜索预算上限，超出则返回未找到解

---

## 致谢

- 关卡编辑器 UI 参考了 [Parafox](https://github.com/iwVerve/Parafox) 的编辑器设计
- 本项目在开发过程中使用了生成式人工智能辅助

## 版权说明

这个项目完全是出于**个人学习目的**制作的，仅用于HTML5游戏开发技术的学习和研究，没有任何商业用途。所有游戏素材和核心玩法均属于原作者所有。

如果您喜欢这个游戏，强烈建议您去DLsite支持原版作品。
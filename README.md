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

- `bugma_solver`：关卡求解器（BFS）
- `make_replay_save`：把 UDLR 路径写成前端可导入 JSON（支持读旧文件并合并）

### 逻辑移植说明

当前 C++ 版本已移植大部分核心回合机制（推箱、心堆叠、形态切换、主要战斗分支、胜负结算等），可用于批量求解和回放验证；但与前端 JS 仍可能存在边缘行为差异，建议以实机回放复核。

### 构建

```bash
mkdir -p cpp/build

g++ -std=c++17 -O2 -o cpp/build/bugma_solver cpp/src/main.cpp

g++ -std=c++17 -O2 -o cpp/build/make_replay_save cpp/tools/make_replay_save.cpp
```

### 求解器使用

```bash
./cpp/build/bugma_solver <levelId> [maxNodes] [colorOverride]
```

- `levelId`：关卡ID（如 `1`、`61`、`1-1`）
- `maxNodes`：BFS 节点上限（默认 `120000`）
- `colorOverride`：官方变色关覆盖颜色（如 `1/2/3/4/6`）

示例：

```bash
./cpp/build/bugma_solver 1 12000
./cpp/build/bugma_solver 61 12000 4
./cpp/build/bugma_solver 1-1 12000
```

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

1. 打开网页中的 `DATA I/O`
2. 点击 `IMPORT`
3. 选择生成的 JSON
4. 刷新后在选关按钮点 `▶` 回放

## 版权说明

这个项目完全是出于**个人学习目的**制作的，仅用于HTML5游戏开发技术的学习和研究，没有任何商业用途。所有游戏素材和核心玩法均属于原作者所有。

如果您喜欢这个游戏，强烈建议您去DLsite支持原版作品。

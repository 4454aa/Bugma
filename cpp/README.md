# C++ 逻辑移植（进行中）

当前版本已把 JS 里的**核心回合机制**迁移到 C++ 求解器：

- 读取 `js/generated_levels.js`，并自动合并 `js/levels.js`（主线/官方）和 `js/custom_levels.js`（自定义关卡包），按前端坐标规则加载 14x14。
- 双层网格移动（前景/背景），含 Form1 推动可推物、心堆叠跟随移动。
- Form2 转身触发的蓝/黄心互换状态机（`hphanten`）。
- 战斗入口与多数机制：
  - 普通蓝/红/绿/黄战斗
  - 紫色不死判定
  - 红魔像交换、绿魔像平分、黄魔像变形
  - 催眠击飞、怪物回血
- 回合结算：处决、僵尸(17/18)恢复、玩家无敌/饥饿判定、胜负判定。

> 说明：这仍是移植中的求解器实现，和前端 JS 还有细节差异，但已不再是“碰怪即删除”的简化模型。

## 构建

```bash
cmake -S cpp -B cpp/build
cmake --build cpp/build -j
```

## 使用

```bash
./cpp/build/bugma_solver <levelId> [maxNodes] [colorOverride]
```

例如：

```bash
./cpp/build/bugma_solver 0 120000
```

## 现状验证

已可解出部分关卡（例如 `1/3/4/5/6/7/8`）。

## 自动化生成“可导入游戏界面”的解法 JSON

你可以用脚本直接把求解器输出的 `UDLR` 路径打包成前端可导入存档：

```bash
./cpp/build/make_replay_save --level-id 1 --replay RRRRRR --output my_replay.json
```

然后在网页里：

1. 进入 `DATA I/O`
2. 点击 `IMPORT`
3. 选中 `my_replay.json`
4. 刷新后在选关按钮上点 `▶` 回放

### 颜色变体关卡（官方 61~67 变色）

官方变体在存档里用 key：`<levelId>_c<color>`，例如 `61_c4`：

```bash
./cpp/build/make_replay_save --level-id 61 --color 4 --replay DDDRRRURDR --output replay_61_c4.json
```

### 自定义 / 随机关卡 key 约定

- 自定义关卡：`custom_1-1` 这类 id
- 随机关卡：`gen_0` 这类 id

示例：

```bash
./cpp/build/make_replay_save --level-id custom_1-1 --replay LDRLURD...
./cpp/build/make_replay_save --level-id gen_0 --replay UURRDD...
```

### 可选参数

- `--steps`：手动指定 bestSteps（默认等于 replay 长度）
- `--color`：官方变色关颜色覆盖（会生成 `<levelId>_c<color>` key）
- `--output`：输出文件名


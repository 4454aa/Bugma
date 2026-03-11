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
./cpp/build/bugma_solver <levelId> [maxNodes]
```

例如：

```bash
./cpp/build/bugma_solver 0 120000
```

## 现状验证

已可解出部分关卡（例如 `1/3/4/5/6/7/8`）。

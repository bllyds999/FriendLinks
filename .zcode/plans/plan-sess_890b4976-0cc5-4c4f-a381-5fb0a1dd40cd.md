## 实施计划：有向图 + 三列邻居面板

### 现状分析

代码中**已经存储了有向图信息**（`build-graph.ts` 中的 `linksArr` 区分了双向和单向链接），但前端运行时丢失了方向：

1. `neighborMap`（`index.ts:228-248`）是无向的 — 每条边双向添加
2. `updateNeighborPanel()` 只用 `neighborMap.get(nodeId)` 显示所有邻居的扁平列表
3. `GraphLink` 类型已有 `source`/`target` 方向字段

### 修改点（仅 `src/scripts/graph3d/index.ts`）

#### 1. 新增有向数据结构（在 `init3d` 初始化部分，约第 228 行旁）

在现有 `neighborMap` 旁，从 `links` 数组构建有向映射：

```typescript
const outgoingMap = new Map<string, Set<string>>();
const incomingMap = new Map<string, Set<string>>();
for (const l of links) {
  if (!outgoingMap.has(l.source)) outgoingMap.set(l.source, new Set());
  if (!incomingMap.has(l.target)) incomingMap.set(l.target, new Set());
  outgoingMap.get(l.source)!.add(l.target);
  incomingMap.get(l.target)!.add(l.source);
}
```

#### 2. 修改 `updateNeighborPanel()`（约第 763 行）

将原来的单一 `neighborIds` 遍历改为三个分类：

```typescript
// 替代 neighborMap.get(nodeId)
const outgoing = outgoingMap.get(nodeId) || new Set();
const incoming = incomingMap.get(nodeId) || new Set();

// 三分类
const mutual: Array<...> = [];   // 双链：既在 outgoing 又在 incoming
const outgoingOnly: Array<...> = [];  // 单链指向：仅在 outgoing
const incomingOnly: Array<...> = [];  // 被指向：仅在 incoming

for (const nid of union(outgoing, incoming)) {
  const inOut = outgoing.has(nid);
  const inIn = incoming.has(nid);
  const node = nodes.find(n => n.id === nid);
  if (!node) continue;
  const entry = { id: nid, name: node.name || nid, url: node.url || "" };
  if (inOut && inIn) mutual.push(entry);
  else if (inOut && !inIn) outgoingOnly.push(entry);
  else incomingOnly.push(entry);
}
```

#### 3. 修改面板渲染（`renderNeighborList` 约第 728 行 → 改为新函数 `renderNeighborCategories`）

将原来的单个扁平列表改为三段式渲染：

```
🔄 双链 (N)
┌─────────────────────┐
│ item1               │
│ item2               │
└─────────────────────┘

➡️ 单链指向邻居 (N)
┌─────────────────────┐
│ item3               │
└─────────────────────┘

⬅️ 邻居单向指向本站 (N)
┌─────────────────────┐
│ item4               │
│ item5               │
└─────────────────────┘
```

- 每个分类带标题行，显示图标 + 分类名 + 数量
- 每个分类用与原来相同的 `.np-item` 样式
- 搜索功能改为同时在三个分类中过滤
- 计数显示改为 "3 个关联节点"

#### 4. 新增 CSS（在 `createNeighborPanelStyle` 中）

```css
.np-section-title { 
  font-size:11px; color:#888; padding:6px 12px 2px;
  border-bottom:1px solid rgba(255,255,255,0.04);
  display:flex; justify-content:space-between;
}
.np-section-title .count { color:#555; }
```

### 不需要改的文件

- `build-graph.ts` — 已有向信息，无需修改
- `types/graph.ts` — 类型定义已足够
- `renderer.ts` — 3D 渲染不需要改变（边渲染已体现方向性）
- `index.astro` — 面板样式已包含 `overflow-y:auto`

### 总改动量

1 个文件（`src/scripts/graph3d/index.ts`），约 30 行新增代码，10 行修改代码。

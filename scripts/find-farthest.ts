/**
 * 两遍 BFS 找直径端点
 * 1. 从任意边缘节点出发找最远节点 A
 * 2. 从 A 出发找最远节点 B
 * A-B 就是直径的一条端点到端点路径
 */
import { loadSites } from "../src/utils/load-sites";
import { buildGraph, findPath } from "../tools/six-degrees";

const sites = await loadSites("links");
const graph = buildGraph(sites);

// 找大分量里度数最小的节点
const largeComp = graph.components.find(c => c.length >= 1000);
if (!largeComp) { console.log("无大型分量"); process.exit(1); }

const degreeMap = new Map<string, number>();
for (const [host, nbrs] of graph.adjacency) degreeMap.set(host, nbrs.size);

const mostIsolated = largeComp.sort((a, b) => (degreeMap.get(a) || 0) - (degreeMap.get(b) || 0))[0];
console.log(`起点（度数最低）: ${mostIsolated} (degree=${degreeMap.get(mostIsolated)})`);

// 用 findPath 来查距离 — 但 findPath 只给单对路径，我们需要找最远的
// 用 bfs-rs 的函数
import { bfsOneHistogram, bfsPath } from "@xingwangzhe/bfs-rs";

// 第一遍 BFS：找离起点最远的节点
const startIdx = graph.nodeIndex.get(mostIsolated)!;
const hist1 = bfsOneHistogram(graph.csrAdj, graph.csrOffsets, graph.nodes.length, startIdx);
console.log(`第一遍 BFS 最大距离: ${hist1.maxDistance}`);

// 找距离 = maxDistance 的节点
let farA: string | null = null;
for (const target of largeComp) {
  if (target === mostIsolated) continue;
  const tgtIdx = graph.nodeIndex.get(target)!;
  const p = bfsPath(graph.csrAdj, graph.csrOffsets, graph.nodes.length, startIdx, tgtIdx);
  if (p.distance === hist1.maxDistance) { farA = target; break; }
}
console.log(`最远节点 A: ${farA}  (${graph.nodeMap.get(farA || "")?.name || ""})`);

if (!farA) { console.log("没找到 A"); process.exit(1); }

// 第二遍 BFS：从 A 找最远的 B
const aIdx = graph.nodeIndex.get(farA)!;
const hist2 = bfsOneHistogram(graph.csrAdj, graph.csrOffsets, graph.nodes.length, aIdx);
console.log(`第二遍 BFS 最大距离: ${hist2.maxDistance}`);

let farB: string | null = null;
for (const target of largeComp) {
  if (target === farA) continue;
  const tgtIdx = graph.nodeIndex.get(target)!;
  const p = bfsPath(graph.csrAdj, graph.csrOffsets, graph.nodes.length, aIdx, tgtIdx);
  if (p.distance === hist2.maxDistance) { farB = target; break; }
}
console.log(`最远节点 B: ${farB}  (${graph.nodeMap.get(farB || "")?.name || ""})`);

if (!farB) { console.log("没找到 B"); process.exit(1); }

// 输出路径
console.log(`\n📏 直径 ${hist2.maxDistance} 度`);
const path = findPath(graph, farA, farB);
if (path) {
  console.log(`完整路径 (${path.length - 1} 步):`);
  for (let i = 0; i < path.length; i++) {
    const node = graph.nodeMap.get(path[i]);
    console.log(`  ${i}. ${path[i]}  (${node?.name || ""})`);
  }
}

// 再找一对作为验证
console.log(`\n=== 再找一对 ===`);
console.log(`从 ${farB} 出发找最远...`);
const bIdx = graph.nodeIndex.get(farB)!;
const hist3 = bfsOneHistogram(graph.csrAdj, graph.csrOffsets, graph.nodes.length, bIdx);
console.log(`第三遍 BFS 最大距离: ${hist3.maxDistance}`);

let farC: string | null = null;
for (const target of largeComp) {
  if (target === farB) continue;
  const tgtIdx = graph.nodeIndex.get(target)!;
  const p = bfsPath(graph.csrAdj, graph.csrOffsets, graph.nodes.length, bIdx, tgtIdx);
  if (p.distance === hist3.maxDistance) { farC = target; break; }
}
if (farC) {
  console.log(`节点 C: ${farC}  (${graph.nodeMap.get(farC)?.name || ""})`);
  const path2 = findPath(graph, farB, farC);
  if (path2) {
    console.log(`路径 (${path2.length - 1} 步):`);
    for (let i = 0; i < path2.length; i++) {
      const node = graph.nodeMap.get(path2[i]);
      console.log(`  ${i}. ${path2[i]}  (${node?.name || ""})`);
    }
  }
}

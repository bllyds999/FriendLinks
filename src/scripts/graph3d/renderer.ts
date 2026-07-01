/**
 * Three.js 原生渲染层
 * 替代 3d-force-graph 的渲染管线：InstancedMesh(×3 LOD) + LineSegments + OrbitControls
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { degreeToSize } from "./utils";
import type { GraphNode } from "../../../types/graph";

// ─── 类型 ──────────────────────────────────────────────────────────

export interface RenderContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  nodesNear: THREE.InstancedMesh;
  nodesMid: THREE.InstancedMesh;
  nodesFar: THREE.InstancedMesh;
  linkLines: THREE.LineSegments;
  dummy: THREE.Object3D; // 用于矩阵计算
}

export interface NodeState {
  color: string;
  _cDefault: string;
  _cHover: string;
  _cFocus: string;
  _cHighlight: string;
  opacity: number;
  visible: boolean;
}

// ─── 常量 ──────────────────────────────────────────────────────────

const NEAR_DIST = 200;
const MID_DIST = 500;
const NEAR_SEG = 12;
const MID_SEG = 6;
const BG_COLOR = 0x0f1115;

// ─── 工厂 ──────────────────────────────────────────────────────────

export function createRenderer(container: HTMLElement, nodeCount: number, linkCount: number): RenderContext {
  const { width, height } = container.getBoundingClientRect();

  // Camera
  const camera = new THREE.PerspectiveCamera(55, width / height, 10, 50000);
  camera.position.set(0, 0, 1000);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(BG_COLOR);
  container.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 20;
  controls.maxDistance = 20000;
  controls.zoomSpeed = 1.5;

  // ── Lights ──
  scene.add(new THREE.AmbientLight(0xcccccc, Math.PI));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI);
  scene.add(dirLight);

  // ── InstancedMesh: 近层 ──
  const geomNear = new THREE.SphereGeometry(1, NEAR_SEG, NEAR_SEG);
  const matNear = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
  const nodesNear = new THREE.InstancedMesh(geomNear, matNear, nodeCount);
  nodesNear.count = nodeCount;
  scene.add(nodesNear);

  // ── InstancedMesh: 中层 ──
  const geomMid = new THREE.SphereGeometry(1, MID_SEG, MID_SEG);
  const matMid = new THREE.MeshLambertMaterial();
  const nodesMid = new THREE.InstancedMesh(geomMid, matMid, nodeCount);
  nodesMid.count = nodeCount;
  scene.add(nodesMid);

  // ── InstancedMesh: 远层 (Points) ──
  const geomFar = new THREE.BufferGeometry();
  geomFar.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  const matFar = new THREE.PointsMaterial({ size: 3, sizeAttenuation: true });
  const nodesFar = new THREE.InstancedMesh(geomFar, matFar, nodeCount);
  nodesFar.count = nodeCount;
  scene.add(nodesFar);

  // ── 连线 (LineSegments) ──
  const linkGeom = new THREE.BufferGeometry();
  const linkPositions = new Float32Array(linkCount * 6); // 2 points × 3 coords per link
  linkGeom.setAttribute("position", new THREE.BufferAttribute(linkPositions, 3));
  linkGeom.setDrawRange(0, 0); // 默认不绘制
  const linkMat = new THREE.LineBasicMaterial({
    color: 0x555555,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const linkLines = new THREE.LineSegments(linkGeom, linkMat);
  linkLines.frustumCulled = false;
  scene.add(linkLines);

  // ── Dummy ──
  const dummy = new THREE.Object3D();

  return { scene, camera, renderer, controls, nodesNear, nodesMid, nodesFar, linkLines, dummy };
}

// ─── 节点位置更新 ──────────────────────────────────────────────────

export function updateAllNodePositions(
  ctx: RenderContext,
  nodes: GraphNode[],
  degreeMap: Record<string, number>,
  maxDegree: number,
  nodeStates: NodeState[],
) {
  const m = new THREE.Matrix4();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const deg = degreeMap[n.id] || 0;
    const size = degreeToSize(deg, maxDegree);
    m.compose(
      new THREE.Vector3(n.x ?? 0, n.y ?? 0, n.z ?? 0),
      new THREE.Quaternion(),
      new THREE.Vector3(size, size, size),
    );
    ctx.nodesNear.setMatrixAt(i, m);
    ctx.nodesMid.setMatrixAt(i, m);
    ctx.nodesFar.setMatrixAt(i, m);

    // 默认颜色
    if (nodeStates[i]) {
      ctx.nodesNear.setColorAt(i, new THREE.Color(nodeStates[i]._cDefault));
      ctx.nodesMid.setColorAt(i, new THREE.Color(nodeStates[i]._cDefault));
      ctx.nodesFar.setColorAt(i, new THREE.Color(nodeStates[i]._cDefault));
    }
  }

  ctx.nodesNear.instanceMatrix.needsUpdate = true;
  ctx.nodesMid.instanceMatrix.needsUpdate = true;
  ctx.nodesFar.instanceMatrix.needsUpdate = true;
  if (ctx.nodesNear.instanceColor) ctx.nodesNear.instanceColor.needsUpdate = true;
  if (ctx.nodesMid.instanceColor) ctx.nodesMid.instanceColor.needsUpdate = true;
  if (ctx.nodesFar.instanceColor) ctx.nodesFar.instanceColor.needsUpdate = true;
}

export function setNodeColor(ctx: RenderContext, index: number, color: string) {
  ctx.nodesNear.setColorAt(index, new THREE.Color(color));
  ctx.nodesMid.setColorAt(index, new THREE.Color(color));
  ctx.nodesFar.setColorAt(index, new THREE.Color(color));
  if (ctx.nodesNear.instanceColor) ctx.nodesNear.instanceColor.needsUpdate = true;
  if (ctx.nodesMid.instanceColor) ctx.nodesMid.instanceColor.needsUpdate = true;
  if (ctx.nodesFar.instanceColor) ctx.nodesFar.instanceColor.needsUpdate = true;
}

// ─── LOD 切换（基于相机距离） ─────────────────────────────────────

export function updateLOD(ctx: RenderContext) {
  const camPos = ctx.camera.position;
  for (let i = 0; i < ctx.nodesNear.count; i++) {
    const m = new THREE.Matrix4();
    ctx.nodesNear.getMatrixAt(i, m);
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(m);
    const dist = camPos.distanceTo(pos);

    if (dist < NEAR_DIST) {
      ctx.nodesNear.setVisibleAt(i, true);
      ctx.nodesMid.setVisibleAt(i, false);
      ctx.nodesFar.setVisibleAt(i, false);
    } else if (dist < MID_DIST) {
      ctx.nodesNear.setVisibleAt(i, false);
      ctx.nodesMid.setVisibleAt(i, true);
      ctx.nodesFar.setVisibleAt(i, false);
    } else {
      ctx.nodesNear.setVisibleAt(i, false);
      ctx.nodesMid.setVisibleAt(i, false);
      ctx.nodesFar.setVisibleAt(i, true);
    }
  }
  ctx.nodesNear.instanceMatrix.needsUpdate = true;
  ctx.nodesMid.instanceMatrix.needsUpdate = true;
  ctx.nodesFar.instanceMatrix.needsUpdate = true;
}

// ─── 连线更新 ──────────────────────────────────────────────────────

export function updateLinkPositions(
  ctx: RenderContext,
  links: { source: string; target: string }[],
  nodeIdToIndex: Map<string, number>,
  nodes: GraphNode[],
  opacity: number,
) {
  const pos = ctx.linkLines.geometry.attributes.position.array as Float32Array;
  const count = Math.min(links.length, pos.length / 6);

  for (let i = 0; i < count; i++) {
    const l = links[i];
    const si = nodeIdToIndex.get(typeof l.source === "string" ? l.source : (l.source as any).id ?? l.source);
    const ti = nodeIdToIndex.get(typeof l.target === "string" ? l.target : (l.target as any).id ?? l.target);
    if (si == null || ti == null) continue;

    const sn = nodes[si];
    const tn = nodes[ti];
    const j = i * 6;
    pos[j] = sn.x ?? 0;
    pos[j + 1] = sn.y ?? 0;
    pos[j + 2] = sn.z ?? 0;
    pos[j + 3] = tn.x ?? 0;
    pos[j + 4] = tn.y ?? 0;
    pos[j + 5] = tn.z ?? 0;
  }

  ctx.linkLines.geometry.attributes.position.needsUpdate = true;
  ctx.linkLines.geometry.setDrawRange(0, count * 2);
  (ctx.linkLines.material as THREE.LineBasicMaterial).opacity = opacity;
}

// ─── 相机 ──────────────────────────────────────────────────────────

export function zoomToFit(ctx: RenderContext, nodes: GraphNode[], ms: number, padding: number) {
  if (!nodes.length) return;
  const box = new THREE.Box3();
  for (const n of nodes) {
    box.expandByPoint(new THREE.Vector3(n.x ?? 0, n.y ?? 0, n.z ?? 0));
  }
  box.expandByScalar(padding);

  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = ctx.camera.fov * (Math.PI / 180);
  const dist = maxDim / (2 * Math.tan(fov / 2));

  const target = center.clone();
  const pos = center.clone().add(new THREE.Vector3(0, 0, dist));

  // 简单线性插值动画
  const startPos = ctx.camera.position.clone();
  const startTarget = ctx.controls.target.clone();
  const startTime = performance.now();

  function animate() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / ms);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
    ctx.camera.position.lerpVectors(startPos, pos, ease);
    ctx.controls.target.lerpVectors(startTarget, target, ease);
    ctx.controls.update();
    if (t < 1) {
      requestAnimationFrame(animate);
    }
  }
  animate();
}

export function getCameraPosition(ctx: RenderContext): { x: number; y: number; z: number } {
  return { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z };
}

export function animateCamera(
  ctx: RenderContext,
  pos: { x: number; y: number; z: number },
  lookAt: { x: number; y: number; z: number },
  ms: number,
) {
  const startPos = ctx.camera.position.clone();
  const startTarget = ctx.controls.target.clone();
  const endPos = new THREE.Vector3(pos.x, pos.y, pos.z);
  const endTarget = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);
  const startTime = performance.now();

  function animate() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / ms);
    const ease = 1 - Math.pow(1 - t, 3);
    ctx.camera.position.lerpVectors(startPos, endPos, ease);
    ctx.controls.target.lerpVectors(startTarget, endTarget, ease);
    ctx.controls.update();
    if (t < 1) {
      requestAnimationFrame(animate);
    }
  }
  animate();
}

// ─── 工具 ──────────────────────────────────────────────────────────

export function dispose(ctx: RenderContext) {
  ctx.renderer.dispose();
  ctx.nodesNear.geometry.dispose();
  ctx.nodesMid.geometry.dispose();
  ctx.nodesFar.geometry.dispose();
  (ctx.nodesNear.material as THREE.Material).dispose();
  (ctx.nodesMid.material as THREE.Material).dispose();
  (ctx.nodesFar.material as THREE.Material).dispose();
  ctx.linkLines.geometry.dispose();
  (ctx.linkLines.material as THREE.Material).dispose();
}

/**
 * 贝塞尔曲线工具函数（纯 JS，无 THREE 依赖，服务端客户端共用）
 */

/** 二次贝塞尔插值 */
export function bezier2(s: number, c: number, e: number, t: number): number {
  const i = 1 - t;
  return i * i * s + 2 * i * t * c + t * t * e;
}

/** 计算垂直于边方向的偏移（XZ 平面优先） */
export function calcControlOffset(
  dx: number,
  dy: number,
  dz: number,
  len: number,
): { ox: number; oy: number; oz: number } {
  if (len < 0.001) return { ox: 0, oy: 0, oz: 1 };
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;
  const up = Math.abs(ny) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const ox = ny * up.z - nz * up.y;
  const oy = nz * up.x - nx * up.z;
  const oz = nx * up.y - ny * up.x;
  const ol = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
  return { ox: ox / ol, oy: oy / ol, oz: oz / ol };
}

export const EDGE_SEGMENTS = 6;

#!/usr/bin/env -S bun --bun run
/**
 * 慢站重试脚本（5 并发 · 15s 超时）
 *
 * 读取 slow.txt 中的站点，逐个重新探测，能通的写入 YAML。
 *
 * 用法:
 *   bun run scripts/retry-slow.ts
 */

import path from "node:path";
import YAML from "yaml";
import ky, { HTTPError } from "ky";
import * as cheerio from "cheerio";
import { FRIEND_ROUTES } from "./friend-routes";

const LINKS_DIR = path.resolve(process.cwd(), "links");
const SLOW_TXT = path.resolve(process.cwd(), "slow.txt");
const TIMEOUT = 15000;
const CONCURRENCY = 5;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function getHost(u: string): string {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

function extractTitle(html: string): string {
  const $ = cheerio.load(html);
  return $("title").first().text().trim();
}

function extractAnchors(html: string, excludeHost: string): Array<{ t: string; h: string }> {
  const $ = cheerio.load(html);
  const anchors: Array<{ t: string; h: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim().slice(0, 80);
    if (href.startsWith("http") && !href.includes(excludeHost) && text.length > 2) {
      anchors.push({ t: text, h: href });
    }
  });
  const seen = new Set<string>();
  return anchors.filter(a => {
    const k = a.h.toLowerCase().replace(/\/$/, "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function probeSlowHost(host: string): Promise<{ found: boolean; log: string }> {
  const logs: string[] = [];

  for (const proto of ["https", "http"] as const) {
    const baseUrl = `${proto}://${host}`;

    // 首页存活探测
    try {
      const resp = await ky.get(baseUrl + "/", { timeout: TIMEOUT, headers: { "User-Agent": UA } });
      const html = await resp.text();
      if (html && html.length > 100) {
        logs.push(`  ${proto.toUpperCase()} 首页可达 ✅`);
      } else {
        logs.push(`  ${proto.toUpperCase()} 首页内容过短，跳过`);
        continue;
      }
    } catch (err) {
      if (err instanceof HTTPError) {
        logs.push(`  ${proto.toUpperCase()} HTTP ${err.response.status}`);
      } else {
        logs.push(`  ${proto.toUpperCase()} 超时/失败`);
      }
      continue;
    }

    // 路由探测
    for (const route of FRIEND_ROUTES) {
      try {
        const pageUrl = `${baseUrl}${route}`;
        const resp = await ky.get(pageUrl, { timeout: TIMEOUT, headers: { "User-Agent": UA } });
        const html = await resp.text();
        const anchors = extractAnchors(html, host);
        if (anchors.length >= 2) {
          logs.push(`  路由 ${route} → ${anchors.length} 友链 ✅`);

          // 写入 YAML
          const rawFriends = anchors.map(a => ({
            name: a.t.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim(),
            url: a.h,
          }));

          const yamlPath = path.join(LINKS_DIR, `${host}.yml`);
          if (!await Bun.file(yamlPath).exists()) {
            const doc = {
              site: {
                name: host,
                url: baseUrl + "/",
                description: "友情链接",
                links: route,
                friends: rawFriends,
              },
            };
            await Bun.write(yamlPath, YAML.stringify(doc, { indent: 2, lineWidth: 0, defaultStringType: "QUOTE_SINGLE" }));
            logs.push(`  ✅ 写入 ${rawFriends.length} 个友链`);
          } else {
            logs.push(`  ⏭️ 已存在`);
          }

          return { found: true, log: logs.join("\n") };
        }
      } catch {
        continue;
      }
    }

    logs.push(`  未找到友链路由`);
    return { found: false, log: logs.join("\n") };
  }

  return { found: false, log: logs.join("\n") };
}

async function main() {
  console.log("=".repeat(60));
  console.log("慢站重试（5 并发 · 15s 超时）");
  console.log("=".repeat(60));

  // 读取 slow.txt，解析 host
  const text = await Bun.file(SLOW_TXT).text().catch(() => "");
  const lines = text.split("\n").filter(l => l && !l.startsWith("疑似") && !l.startsWith("===") && !l.startsWith("格式"));
  const hosts = lines.map(l => l.split("|")[0].trim()).filter(Boolean);

  if (hosts.length === 0) {
    console.log("slow.txt 为空或无法解析");
    return;
  }

  console.log(`待重试: ${hosts.length} 个站点\n`);

  // 5 并发
  const queue = [...hosts];
  let done = 0;
  let recovered = 0;
  let failed = 0;

  async function worker() {
    while (true) {
      const host = queue.shift();
      if (!host) break;

      const idx = ++done;
      process.stderr.write(`\r进度: ${idx}/${hosts.length} (已恢复: ${recovered})`);

      const { found, log } = await probeSlowHost(host);
      if (found) recovered++;
      else failed++;

      console.log(`\n[${idx}/${hosts.length}] ${host}`);
      console.log(log);
    }
  }

  const pool = Math.min(CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: pool }, () => worker()));

  console.log("\n" + "=".repeat(60));
  console.log(`完成！共 ${hosts.length} 个慢站，恢复 ${recovered} 个，仍失败 ${failed} 个`);
  console.log("=".repeat(60));
}

main().catch(e => { console.error("错误:", e); process.exit(1); });

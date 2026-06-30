import { loadSites } from "../utils/load-sites";

export async function GET() {
  const start = performance.now();
  const sites = await loadSites();
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.error(`  ✔ /all.json  ${sites.length} 站点，耗时 ${elapsed}s`);
  const output = { count: sites.length, sites };
  return new Response(JSON.stringify(output), {
    headers: { "Content-Type": "application/json" },
  });
}

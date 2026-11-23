// Fetches silver prices from MetalpriceAPI, converts to INR per kg, and
// writes docs/data.json. The API key comes from the METALPRICE_API_KEY
// environment variable (a GitHub secret) and is never written to any file.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.METALPRICE_API_KEY;
if (!KEY) { console.error("Missing METALPRICE_API_KEY"); process.exit(1); }

const BASE = process.env.METALPRICE_BASE || "https://api.metalpriceapi.com/v1";
const FILE = "docs/data.json";
const OZ_PER_KG = 1000 / 31.1035;                 // troy ounces in a kilogram
const MAX_YEARS = Number(process.env.MAX_YEARS || 5); // how far to backfill daily history
const FORCE = process.env.FORCE === "1";

const now = new Date();
const hourUTC = now.getUTCHours();
const day = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);

async function api(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "X-API-KEY": KEY } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${path}: ${json.error?.info || res.status}`);
  }
  return json;
}

// rates.INRXAG = INR per troy ounce of silver (base INR); fall back to 1 / XAG.
function perKg(rates) {
  const perOz = rates.INRXAG ?? (rates.XAG ? 1 / rates.XAG : NaN);
  return Math.round(perOz * OZ_PER_KG * 100) / 100;
}

async function timeframe(start, end) {
  const j = await api("/timeframe", {
    base: "INR", currencies: "XAG", start_date: day(start), end_date: day(end),
  });
  return Object.entries(j.rates || {})
    .map(([d, r]) => [d, perKg(r)])
    .filter((p) => Number.isFinite(p[1]));
}

let data = { daily: [], hourly: [], latest: null };
try { data = JSON.parse(await readFile(FILE, "utf8")); } catch {}

// 1. Live price: every run (1 request)
const live = await api("/latest", { base: "INR", currencies: "XAG" });
data.latest = { ts: live.timestamp, value: perKg(live.rates) };

// 2. Daily history: once a day at 00:xx UTC, or on first run (1 request, more when backfilling)
if (FORCE || hourUTC === 0 || data.daily.length === 0) {
  const map = new Map(data.daily);
  const yesterday = addDays(now, -1);
  try {
    if (map.size < 300) {
      for (let y = 0; y < MAX_YEARS; y++) {
        const end = addDays(yesterday, -365 * y);
        try {
          for (const [d, v] of await timeframe(addDays(end, -364), end)) map.set(d, v);
        } catch (e) {
          console.warn(`Backfill stopped at year ${y + 1}: ${e.message}`);
          break;
        }
      }
    } else {
      for (const [d, v] of await timeframe(addDays(yesterday, -7), yesterday)) map.set(d, v);
    }
  } catch (e) { console.warn("Daily update failed:", e.message); }
  data.daily = [...map].sort((a, b) => a[0].localeCompare(b[0]));
}

// 3. Hourly history for the 5D view: every 6 hours (1 request)
if (FORCE || hourUTC % 6 === 0 || data.hourly.length === 0) {
  for (const span of [6, 1]) { // try 7 days (paid plans), then 2 days (free plan)
    try {
      const j = await api("/hourly", {
        base: "INR", currency: "XAG",
        start_date: day(addDays(now, -span)), end_date: day(now),
      });
      const pts = (j.rates || [])
        .map((x) => [x.timestamp, perKg(x.rates)])
        .filter((p) => Number.isFinite(p[1]));
      if (pts.length) { data.hourly = pts; break; }
    } catch (e) { console.warn(`Hourly (${span + 1} days) failed: ${e.message}`); }
  }
}

data.updated = now.toISOString();
data.unit = "INR per kg";
await mkdir("docs", { recursive: true });
await writeFile(FILE, JSON.stringify(data));
console.log(`Saved: ${data.daily.length} daily, ${data.hourly.length} hourly points, latest ${data.latest.value}`);

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const ALPACA_KEY = process.env.ALPACA_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET || "";
const ALPACA_DATA_BASE = process.env.ALPACA_DATA_BASE || "https://data.alpaca.markets";

// Gerçekçi ortalama hacim veritabanı (manuel referans değerler)
const AVG_VOLUME_DB = {
  AAPL:55000000,MSFT:22000000,NVDA:45000000,AMD:55000000,TSLA:100000000,
  AMZN:40000000,GOOGL:25000000,META:20000000,NFLX:8000000,INTC:40000000,
  PLTR:60000000,SOFI:50000000,UPST:8000000,AFRM:15000000,HOOD:12000000,
  COIN:12000000,MSTR:3000000,IONQ:8000000,RGTI:20000000,QUBT:10000000,
  BBAI:5000000,SOUN:30000000,AI:5000000,KULR:8000000,IREN:10000000,
  MARA:30000000,RIOT:25000000,CLSK:8000000,HIVE:3000000,BITF:5000000,
  ACHR:5000000,JOBY:4000000,RKLB:8000000,ASTS:10000000,SPCE:3000000,
  EOSE:8000000,PLUG:15000000,BE:4000000,FCEL:8000000,STEM:3000000,
  CTMX:2000000,OCGN:5000000,MNKD:6000000,TNXP:3000000,NRXP:2000000,
  GME:8000000,AMC:30000000,KOSS:500000,SNDL:8000000,CLOV:5000000,
  RIVN:25000000,LCID:30000000,NKLA:5000000,MULN:8000000,FFIE:15000000,
  SPY:80000000,QQQ:50000000,IWM:30000000,
};

// Short float gerçekçi değerler
const SHORT_FLOAT_DB = {
  GME:0.22,AMC:0.18,SPCE:0.19,CLOV:0.14,UPST:0.16,KOSS:0.22,SNDL:0.12,
  SOUN:0.11,NKLA:0.13,PLUG:0.12,IONQ:0.09,RGTI:0.11,QUBT:0.12,FFIE:0.21,
  LCID:0.13,MULN:0.20,PLTR:0.04,MARA:0.15,RIOT:0.14,ACHR:0.08,ASTS:0.10,
  RIVN:0.10,BBAI:0.12,AFRM:0.14,HOOD:0.07,
};

const quoteCache = new Map();
const CACHE_TTL_MS = 15000;

let fearGreedCache = { ts: 0, data: { fear_and_greed: { score: 0, rating: "unavailable" } } };

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getCache(key) {
  const hit = quoteCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { quoteCache.delete(key); return null; }
  return hit.data;
}
function setCache(key, data) { quoteCache.set(key, { ts: Date.now(), data }); }

function normalizeYahooQuote(q) {
  const sym = q.symbol;
  return {
    symbol: sym,
    shortName: q.shortName || q.longName || sym,
    regularMarketPrice: q.regularMarketPrice ?? null,
    regularMarketChangePercent: q.regularMarketChangePercent ?? 0,
    regularMarketVolume: q.regularMarketVolume ?? 0,
    // Önce Yahoo'dan al, yoksa DB'den al
    averageVolume: q.averageVolume || q.averageDailyVolume3Month || AVG_VOLUME_DB[sym] || 1000000,
    regularMarketOpen: q.regularMarketOpen ?? null,
    regularMarketDayHigh: q.regularMarketDayHigh ?? null,
    regularMarketDayLow: q.regularMarketDayLow ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    marketCap: q.marketCap ?? null,
    preMarketPrice: q.preMarketPrice ?? null,
    preMarketChangePercent: q.preMarketChangePercent ?? null,
    postMarketPrice: q.postMarketPrice ?? null,
    postMarketChangePercent: q.postMarketChangePercent ?? null,
    shortPercentOfFloat: q.shortPercentOfFloat ?? SHORT_FLOAT_DB[sym] ?? 0,
    forwardPE: q.forwardPE ?? null,
    trailingPE: q.trailingPE ?? null,
  };
}

async function fetchYahoo(symbols) {
  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US&region=US`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US&region=US`,
  ];
  let lastErr = null;
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        timeout: 8000,
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
      const data = JSON.parse(text);
      const results = data?.quoteResponse?.result || [];
      if (!results.length) throw new Error("Yahoo empty result");
      return results.map(normalizeYahooQuote);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Yahoo fetch failed");
}

// Alpaca fallback — averageVolume DB'den al
async function fetchAlpacaOne(sym) {
  if (!ALPACA_KEY || !ALPACA_SECRET) throw new Error("Alpaca keys missing");
  if (sym.startsWith("^")) return null;

  const [barsJson] = await Promise.all([
    fetch(`${ALPACA_DATA_BASE}/v2/stocks/bars/latest?symbols=${encodeURIComponent(sym)}`, {
      headers: { "APCA-API-KEY-ID": ALPACA_KEY, "APCA-API-SECRET-KEY": ALPACA_SECRET }
    }).then(r => r.json()).catch(() => ({})),
  ]);

  const b = barsJson?.bars?.[sym] || null;
  if (!b) return null;

  const price = b.c;
  const open = b.o;
  const chgPct = open && open !== 0 ? ((price - open) / open) * 100 : 0;

  // KRITIK: averageVolume için DB kullan, 0.9x değil!
  const avgVol = AVG_VOLUME_DB[sym] || Math.max(b.v * 3, 1000000);

  return {
    symbol: sym,
    shortName: sym,
    regularMarketPrice: price,
    regularMarketChangePercent: chgPct,
    regularMarketVolume: b.v,
    averageVolume: avgVol,  // ← Gerçekçi değer
    regularMarketOpen: open,
    regularMarketDayHigh: b.h,
    regularMarketDayLow: b.l,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    marketCap: null,
    preMarketPrice: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChangePercent: null,
    shortPercentOfFloat: SHORT_FLOAT_DB[sym] ?? 0,
    forwardPE: null,
    trailingPE: null,
  };
}

async function fetchAlpacaFallback(symbolsArr) {
  const filtered = symbolsArr.filter(s => s && !s.startsWith("^"));
  if (!filtered.length) return [];
  const cacheKey = [...filtered].sort().join(",");
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const settled = await Promise.allSettled(filtered.map(sym => fetchAlpacaOne(sym)));
  const data = settled.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
  setCache(cacheKey, data);
  return data;
}

app.get("/api/quote", async (req, res) => {
  try {
    const rawSymbols = req.query.symbols;
    if (!rawSymbols) return res.status(400).json({ error: "symbols required" });
    const symbolsArr = rawSymbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!symbolsArr.length) return res.json({ quoteResponse: { result: [] } });

    const allResults = [];
    for (const chunk of chunkArray(symbolsArr, 25)) {
      try {
        const yahooData = await fetchYahoo(chunk.join(","));
        allResults.push(...yahooData);
      } catch (yahooErr) {
        console.error("Yahoo failed:", chunk.join(","), yahooErr.message);
        try {
          const alpacaData = await fetchAlpacaFallback(chunk);
          allResults.push(...alpacaData);
        } catch (alpacaErr) {
          console.error("Alpaca failed:", alpacaErr.message);
        }
      }
    }
    res.json({ quoteResponse: { result: allResults } });
  } catch (err) {
    console.error("/api/quote fatal:", err.message);
    res.status(500).json({ error: "quote fetch failed", details: err.message });
  }
});

app.get("/api/feargreed", async (_req, res) => {
  if (Date.now() - fearGreedCache.ts < 15 * 60 * 1000) return res.json(fearGreedCache.data);
  try {
    const r = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
    });
    if (!r.ok) return res.json(fearGreedCache.data);
    const data = await r.json();
    fearGreedCache = { ts: Date.now(), data };
    res.json(data);
  } catch { res.json(fearGreedCache.data); }
});

app.get("/api/debug", async (req, res) => {
  const sym = req.query.sym || "IONQ";
  try {
    const r = await fetchYahoo(sym);
    res.json({ source: "yahoo", data: r[0] });
  } catch(e) {
    res.json({ error: e.message, avgVolumeDB: AVG_VOLUME_DB[sym] });
  }
});

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`TradeDesk server running on port ${PORT}`));

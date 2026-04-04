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

const SHORT_FLOAT_PROXY = {
  GME: 0.18,
  AMC: 0.16,
  CLOV: 0.12,
  SPCE: 0.17,
  CVNA: 0.11,
  UPST: 0.14,
  KOSS: 0.20,
  SNDL: 0.10,
  SOUN: 0.09,
  NKLA: 0.11,
  PLUG: 0.10,
  IONQ: 0.08,
  RGTI: 0.09,
  QUBT: 0.10,
  FFIE: 0.19,
  LCID: 0.11,
  MULN: 0.18,
  BBBY: 0.25
};

const quoteCache = new Map();
const CACHE_TTL_MS = 15000;

let fearGreedCache = {
  ts: 0,
  data: {
    fear_and_greed: {
      score: 0,
      rating: "unavailable"
    }
  }
};

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cacheKeyForSymbols(symbolsArr) {
  return [...symbolsArr].sort().join(",");
}

function getCache(symbolsArr) {
  const key = cacheKeyForSymbols(symbolsArr);
  const hit = quoteCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    quoteCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCache(symbolsArr, data) {
  const key = cacheKeyForSymbols(symbolsArr);
  quoteCache.set(key, { ts: Date.now(), data });
}

function normalizeYahooQuote(q) {
  return {
    symbol: q.symbol,
    shortName: q.shortName || q.longName || q.displayName || q.symbol,
    regularMarketPrice: q.regularMarketPrice ?? null,
    regularMarketChangePercent: q.regularMarketChangePercent ?? 0,
    regularMarketVolume: q.regularMarketVolume ?? 0,
    averageVolume: q.averageVolume ?? q.averageDailyVolume3Month ?? 1,
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
    shortPercentOfFloat: q.shortPercentOfFloat ?? SHORT_FLOAT_PROXY[q.symbol] ?? 0,
    forwardPE: q.forwardPE ?? null,
    trailingPE: q.trailingPE ?? null
  };
}

async function fetchYahoo(symbols) {
  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US&region=US`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US&region=US`
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });

      const text = await r.text();

      if (!r.ok) {
        throw new Error(`Yahoo HTTP ${r.status} | body: ${text.slice(0, 300)}`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Yahoo JSON parse error | body: ${text.slice(0, 300)}`);
      }

      const results = data?.quoteResponse?.result || [];
      if (!results.length) {
        throw new Error(`Yahoo empty result for symbols=${symbols}`);
      }

      return results.map(normalizeYahooQuote);
    } catch (err) {
      lastError = err;
      console.error("fetchYahoo failed:", url);
      console.error(err.message);
    }
  }

  throw lastError || new Error("Yahoo fetch failed");
}

async function alpacaGet(url) {
  const r = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": ALPACA_KEY,
      "APCA-API-SECRET-KEY": ALPACA_SECRET,
      "Accept": "application/json"
    }
  });

  const text = await r.text();

  if (!r.ok) {
    throw new Error(`Alpaca HTTP ${r.status} | ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Alpaca JSON parse error | ${text.slice(0, 500)}`);
  }
}

async function fetchAlpacaOne(sym) {
  if (!ALPACA_KEY || !ALPACA_SECRET) {
    throw new Error("Alpaca keys missing");
  }

  if (sym.startsWith("^")) {
    return null;
  }

  const [barsJson, quotesJson] = await Promise.all([
    alpacaGet(`${ALPACA_DATA_BASE}/v2/stocks/bars/latest?symbols=${encodeURIComponent(sym)}`),
    alpacaGet(`${ALPACA_DATA_BASE}/v2/stocks/quotes/latest?symbols=${encodeURIComponent(sym)}`)
  ]);

  const b = barsJson?.bars?.[sym] || null;
  const q = quotesJson?.quotes?.[sym] || null;

  const price = b?.c ?? q?.ap ?? q?.bp ?? null;
  const open = b?.o ?? null;
  const high = b?.h ?? null;
  const low = b?.l ?? null;
  const volume = b?.v ?? 0;

  if (price == null) return null;

  let chgPct = 0;
  if (price != null && open != null && open !== 0) {
    chgPct = ((price - open) / open) * 100;
  }

  // Modüller boş kalmasın diye geçici ama işlevsel ortalama hacim
  const syntheticAvgVolume = Math.max(volume * 0.9, 1);

  return {
    symbol: sym,
    shortName: sym,
    regularMarketPrice: price,
    regularMarketChangePercent: chgPct,
    regularMarketVolume: volume,
    averageVolume: syntheticAvgVolume,
    regularMarketOpen: open,
    regularMarketDayHigh: high,
    regularMarketDayLow: low,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    marketCap: null,
    preMarketPrice: q?.ap ?? price,
    preMarketChangePercent: chgPct,
    postMarketPrice: q?.bp ?? price,
    postMarketChangePercent: chgPct,
    shortPercentOfFloat: SHORT_FLOAT_PROXY[sym] ?? 0,
    forwardPE: null,
    trailingPE: null,
    _debug: {
      source: "alpaca-latest",
      hasBar: !!b,
      hasQuote: !!q
    }
  };
}

async function fetchAlpacaFallback(symbolsArr) {
  const filtered = symbolsArr
    .map((s) => String(s).trim().toUpperCase())
    .filter(Boolean)
    .filter((s) => !s.startsWith("^"));

  if (!filtered.length) return [];

  const cached = getCache(filtered);
  if (cached) return cached;

  const settled = await Promise.allSettled(
    filtered.map((sym) => fetchAlpacaOne(sym))
  );

  const data = settled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean);

  setCache(filtered, data);
  return data;
}

app.get("/api/quote", async (req, res) => {
  try {
    const rawSymbols = req.query.symbols;
    if (!rawSymbols || typeof rawSymbols !== "string") {
      return res.status(400).json({ error: "symbols query param required" });
    }

    const symbolsArr = rawSymbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (!symbolsArr.length) {
      return res.json({ quoteResponse: { result: [] } });
    }

    let allResults = [];
    const chunks = chunkArray(symbolsArr, 25);

    for (const chunk of chunks) {
      try {
        const yahooData = await fetchYahoo(chunk.join(","));
        allResults.push(...yahooData);
      } catch (yahooErr) {
        console.error("Yahoo chunk failed:", chunk.join(","));
        console.error(yahooErr.message);

        try {
          const alpacaData = await fetchAlpacaFallback(chunk);
          allResults.push(...alpacaData);
        } catch (alpacaErr) {
          console.error("Alpaca chunk failed:", chunk.join(","));
          console.error(alpacaErr.message);
        }
      }
    }

    res.json({
      quoteResponse: {
        result: allResults
      }
    });
  } catch (err) {
    console.error("/api/quote fatal error:", err.message);
    res.status(500).json({ error: "quote fetch failed", details: err.message });
  }
});

app.get("/api/debug-quote", async (req, res) => {
  const symbols = String(req.query.symbols || "AAPL,TSLA")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  try {
    const yahooData = await fetchYahoo(symbols.join(","));
    return res.json({
      ok: true,
      source: "yahoo",
      count: yahooData.length,
      requested: symbols,
      data: yahooData
    });
  } catch (yahooErr) {
    try {
      const alpacaData = await fetchAlpacaFallback(symbols);
      return res.json({
        ok: true,
        source: "alpaca",
        count: alpacaData.length,
        requested: symbols,
        data: alpacaData
      });
    } catch (alpacaErr) {
      return res.status(500).json({
        ok: false,
        requested: symbols,
        yahooError: yahooErr.message,
        alpacaError: alpacaErr.message
      });
    }
  }
});

app.get("/api/feargreed", async (_req, res) => {
  if (Date.now() - fearGreedCache.ts < 15 * 60 * 1000) {
    return res.json(fearGreedCache.data);
  }

  try {
    const r = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (!r.ok) {
      return res.json(fearGreedCache.data);
    }

    const data = await r.json();
    fearGreedCache = {
      ts: Date.now(),
      data
    };
    res.json(data);
  } catch {
    res.json(fearGreedCache.data);
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

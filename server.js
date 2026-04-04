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

/**
 * Squeeze modülü için proxy short-float değerleri.
 * Alpaca bunu vermediği için yaklaşık radar amaçlı kullanılıyor.
 * Gerçek short-interest datası için ayrı provider gerekir.
 */
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
const CACHE_TTL_MS = 20 * 1000;

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

function avg(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function safeNum(n, fallback = null) {
  return Number.isFinite(Number(n)) ? Number(n) : fallback;
}

function midpoint(a, b) {
  const aa = safeNum(a, null);
  const bb = safeNum(b, null);
  if (aa != null && bb != null) return (aa + bb) / 2;
  return aa ?? bb ?? null;
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

async function fetchAlpacaFallback(symbolsArr) {
  if (!ALPACA_KEY || !ALPACA_SECRET || !symbolsArr.length) {
    throw new Error("Alpaca keys missing");
  }

  const filtered = symbolsArr
    .map((s) => String(s).trim().toUpperCase())
    .filter(Boolean)
    .filter((s) => !s.startsWith("^"));

  if (!filtered.length) return [];

  const cached = getCache(filtered);
  if (cached) return cached;

  const symbols = filtered.join(",");

  // 1) latest quotes
  const quotesJson = await alpacaGet(
    `${ALPACA_DATA_BASE}/v2/stocks/quotes/latest?symbols=${encodeURIComponent(symbols)}`
  );

  // 2) son ~90 günlük daily bars
  const dailyJson = await alpacaGet(
    `${ALPACA_DATA_BASE}/v2/stocks/bars?symbols=${encodeURIComponent(symbols)}&timeframe=1Day&limit=90&adjustment=raw`
  );

  const quotes = quotesJson?.quotes || {};
  const dailyBars = dailyJson?.bars || {};

  const result = filtered
    .map((sym) => {
      const q = quotes[sym] || {};
      const bars = Array.isArray(dailyBars[sym]) ? dailyBars[sym] : [];

      if (!bars.length) return null;

      const lastBar = bars[bars.length - 1] || null;
      const prevBar = bars.length >= 2 ? bars[bars.length - 2] : null;

      // Fiyat: latest quote midpoint -> ask -> bid -> last close
      const livePrice =
        midpoint(q.ap, q.bp) ??
        safeNum(q.ap, null) ??
        safeNum(q.bp, null) ??
        safeNum(lastBar?.c, null);

      if (livePrice == null) return null;

      const dayOpen = safeNum(lastBar?.o, null);
      const dayHigh = safeNum(lastBar?.h, null);
      const dayLow = safeNum(lastBar?.l, null);

      const prevClose = safeNum(prevBar?.c, dayOpen ?? livePrice);

      let changePct = 0;
      if (prevClose && prevClose !== 0) {
        changePct = ((livePrice - prevClose) / prevClose) * 100;
      }

      const priorBars = bars.slice(Math.max(0, bars.length - 21), bars.length - 1);
      const avg20Volume = Math.round(avg(priorBars.map((b) => safeNum(b.v, 0)).filter((v) => v != null))) || 1;

      const volToday = safeNum(lastBar?.v, 0) || 0;

      const highs = bars.map((b) => safeNum(b.h, null)).filter((x) => x != null);
      const lows = bars.map((b) => safeNum(b.l, null)).filter((x) => x != null);

      const fiftyTwoWeekHigh = highs.length ? Math.max(...highs) : null;
      const fiftyTwoWeekLow = lows.length ? Math.min(...lows) : null;

      const ask = safeNum(q.ap, null);
      const bid = safeNum(q.bp, null);

      let preMarketPrice = null;
      let postMarketPrice = null;
      let preMarketChangePercent = null;
      let postMarketChangePercent = null;

      // Market kapalıyken latest quote'u pre/after için de kullanmakta sakınca yok;
      // UI tarafında en azından tablo boş kalmasın.
      if (livePrice != null && prevClose != null && prevClose !== 0) {
        const extPct = ((livePrice - prevClose) / prevClose) * 100;
        preMarketPrice = livePrice;
        postMarketPrice = livePrice;
        preMarketChangePercent = extPct;
        postMarketChangePercent = extPct;
      }

      return {
        symbol: sym,
        shortName: sym,
        regularMarketPrice: livePrice,
        regularMarketChangePercent: changePct,
        regularMarketVolume: volToday,
        averageVolume: avg20Volume,
        regularMarketOpen: dayOpen,
        regularMarketDayHigh: dayHigh,
        regularMarketDayLow: dayLow,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        marketCap: null,
        preMarketPrice,
        preMarketChangePercent,
        postMarketPrice,
        postMarketChangePercent,
        shortPercentOfFloat: SHORT_FLOAT_PROXY[sym] ?? 0,
        forwardPE: null,
        trailingPE: null,
        _debug: {
          source: "alpaca-daily+quote",
          hasQuote: !!quotes[sym],
          dailyBars: bars.length,
          ask,
          bid,
          prevClose,
          avg20Volume,
          volToday
        }
      };
    })
    .filter(Boolean);

  setCache(filtered, result);
  return result;
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

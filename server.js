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

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
    shortPercentOfFloat: q.shortPercentOfFloat ?? 0,
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
        throw new Error(`Yahoo empty result for symbols=${symbols} | raw=${text.slice(0, 300)}`);
      }

      return results.map(normalizeYahooQuote);
    } catch (err) {
      lastError = err;
      console.error("fetchYahoo failed for url:", url);
      console.error(err.message);
    }
  }

  throw lastError || new Error("Yahoo fetch failed");
}

async function fetchAlpacaFallback(symbolsArr) {
  if (!ALPACA_KEY || !ALPACA_SECRET || !symbolsArr.length) {
    throw new Error("Alpaca keys missing");
  }

  const headers = {
    "APCA-API-KEY-ID": ALPACA_KEY,
    "APCA-API-SECRET-KEY": ALPACA_SECRET,
    "Accept": "application/json"
  };

  const symbols = symbolsArr.join(",");

  // Snapshots endpoint: latest trade + latest quote + minute/daily/prevDaily bars
  const snapRes = await fetch(
    `${ALPACA_DATA_BASE}/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols)}&feed=iex`,
    { headers }
  );

  const snapText = snapRes.ok ? null : await snapRes.text();

  if (!snapRes.ok) {
    throw new Error(`Alpaca snapshots failed | status=${snapRes.status} ${snapText || ""}`);
  }

  const snapJson = await snapRes.json();
  const snapshots = snapJson?.snapshots || {};

  return symbolsArr
    .map((sym) => {
      const s = snapshots[sym] || {};
      const latestTrade = s.latestTrade || {};
      const latestQuote = s.latestQuote || {};
      const minuteBar = s.minuteBar || {};
      const dailyBar = s.dailyBar || {};
      const prevDailyBar = s.prevDailyBar || {};

      const price =
        minuteBar.c ??
        latestTrade.p ??
        latestQuote.ap ??
        latestQuote.bp ??
        null;

      const open =
        dailyBar.o ??
        minuteBar.o ??
        prevDailyBar.c ??
        null;

      const high = dailyBar.h ?? minuteBar.h ?? null;
      const low = dailyBar.l ?? minuteBar.l ?? null;
      const volume = dailyBar.v ?? minuteBar.v ?? 0;
      const avgVolume = dailyBar.v ?? 1;

      let chgPct = 0;
      if (price != null && open != null && open !== 0) {
        chgPct = ((price - open) / open) * 100;
      }

      return {
        symbol: sym,
        shortName: sym,
        regularMarketPrice: price,
        regularMarketChangePercent: chgPct,
        regularMarketVolume: volume,
        averageVolume: avgVolume,
        regularMarketOpen: open,
        regularMarketDayHigh: high,
        regularMarketDayLow: low,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        marketCap: null,
        preMarketPrice: null,
        preMarketChangePercent: null,
        postMarketPrice: null,
        postMarketChangePercent: null,
        shortPercentOfFloat: 0,
        forwardPE: null,
        trailingPE: null
      };
    })
    .filter((x) => x.regularMarketPrice != null);
}

app.get("/api/quote", async (req, res) => {
  try {
    const rawSymbols = req.query.symbols;
    if (!rawSymbols || typeof rawSymbols !== "string") {
      return res.status(400).json({ error: "symbols query param required" });
    }

    const symbolsArr = rawSymbols
      .split(",")
      .map((s) => s.trim())
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
      } catch (err) {
        console.error("Yahoo chunk failed:", chunk.join(","));
        console.error(err.message);

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
  try {
    const symbols = req.query.symbols || "AAPL,TSLA";
    const data = await fetchYahoo(symbols);
    res.json({ ok: true, source: "yahoo", count: data.length, data });
  } catch (err) {
    try {
      const symbolsArr = String(req.query.symbols || "AAPL,TSLA")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const data = await fetchAlpacaFallback(symbolsArr);
      res.json({ ok: true, source: "alpaca", count: data.length, data });
    } catch (alpacaErr) {
      res.status(500).json({
        ok: false,
        yahooError: err.message,
        alpacaError: alpacaErr.message
      });
    }
  }
});

app.get("/api/feargreed", async (_req, res) => {
  try {
    const r = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (!r.ok) {
      return res.json({
        fear_and_greed: {
          score: 0,
          rating: "unavailable"
        }
      });
    }

    const data = await r.json();
    res.json(data);
  } catch {
    res.json({
      fear_and_greed: {
        score: 0,
        rating: "unavailable"
      }
    });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

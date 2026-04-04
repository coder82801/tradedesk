import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root'taki index.html ve manifest.json'u sun
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Alpaca env değişkenleri (Render dashboard'dan ekleyebilirsin)
const ALPACA_KEY = process.env.ALPACA_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET || "";
const ALPACA_DATA_BASE = process.env.ALPACA_DATA_BASE || "https://data.alpaca.markets";

// ─────────────────────────────────────────────
// Yardımcılar
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Yahoo quote
// ─────────────────────────────────────────────
async function fetchYahoo(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US&region=US`;

  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    }
  });

  if (!r.ok) {
    throw new Error(`Yahoo HTTP ${r.status}`);
  }

  const data = await r.json();
  const results = data?.quoteResponse?.result || [];
  return results.map(normalizeYahooQuote);
}

// ─────────────────────────────────────────────
// Alpaca latest quotes + bars
// Yahoo tamamen boş dönerse fallback
// Not: Alpaca Yahoo kadar zengin alan vermez
// ─────────────────────────────────────────────
async function fetchAlpacaFallback(symbolsArr) {
  if (!ALPACA_KEY || !ALPACA_SECRET || !symbolsArr.length) return [];

  const headers = {
    "APCA-API-KEY-ID": ALPACA_KEY,
    "APCA-API-SECRET-KEY": ALPACA_SECRET
  };

  const symbols = symbolsArr.join(",");

  const [quotesRes, barsRes] = await Promise.all([
    fetch(`${ALPACA_DATA_BASE}/v2/stocks/quotes/latest?symbols=${encodeURIComponent(symbols)}&feed=iex`, { headers }),
    fetch(`${ALPACA_DATA_BASE}/v2/stocks/bars/latest?symbols=${encodeURIComponent(symbols)}&feed=iex`, { headers })
  ]);

  if (!quotesRes.ok && !barsRes.ok) {
    throw new Error("Alpaca fallback failed");
  }

  const quotesJson = quotesRes.ok ? await quotesRes.json() : {};
  const barsJson = barsRes.ok ? await barsRes.json() : {};

  const quotes = quotesJson?.quotes || {};
  const bars = barsJson?.bars || {};

  return symbolsArr.map((sym) => {
    const q = quotes[sym] || {};
    const b = bars[sym] || {};

    const price =
      b.c ??
      q.ap ??
      q.bp ??
      null;

    const open = b.o ?? null;
    const high = b.h ?? null;
    const low = b.l ?? null;
    const volume = b.v ?? 0;

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
      averageVolume: 1,
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
  });
}

// ─────────────────────────────────────────────
// API: quote
// ─────────────────────────────────────────────
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

    // Yahoo bazen uzun query'lerde sorun çıkarır; parçalı çalıştır
    const chunks = chunkArray(symbolsArr, 25);

    for (const chunk of chunks) {
      try {
        const yahooData = await fetchYahoo(chunk.join(","));
        allResults.push(...yahooData);
      } catch (err) {
        // Bu chunk için Yahoo başarısızsa Alpaca fallback
        try {
          const alpacaData = await fetchAlpacaFallback(chunk);
          allResults.push(...alpacaData);
        } catch {
          // sessiz geç
        }
      }
    }

    res.json({
      quoteResponse: {
        result: allResults
      }
    });
  } catch (err) {
    res.status(500).json({ error: "quote fetch failed" });
  }
});

// ─────────────────────────────────────────────
// API: Fear & Greed proxy
// ─────────────────────────────────────────────
app.get("/api/feargreed", async (_req, res) => {
  try {
    const r = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (!r.ok) {
      throw new Error(`CNN HTTP ${r.status}`);
    }

    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "fear greed fetch failed" });
  }
});

// Ana sayfa
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

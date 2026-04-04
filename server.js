const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeSymbol(symbol) {
  return String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^\-]/g, "");
}

function parseSymbols(raw) {
  return String(raw || "")
    .split(",")
    .map(sanitizeSymbol)
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .slice(0, 300);
}

async function safeFetchJson(url, options = {}, retries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...DEFAULT_HEADERS,
          ...(options.headers || {})
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (jsonError) {
        throw new Error(`JSON parse error: ${jsonError.message}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(350 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

function normalizeYahooQuote(q = {}) {
  return {
    symbol: q.symbol || "",
    shortName: q.shortName || q.longName || q.displayName || q.symbol || "",
    longName: q.longName || q.shortName || q.displayName || q.symbol || "",
    regularMarketPrice: toNumber(q.regularMarketPrice, null),
    regularMarketChange: toNumber(q.regularMarketChange, 0),
    regularMarketChangePercent: toNumber(q.regularMarketChangePercent, 0),
    regularMarketOpen: toNumber(q.regularMarketOpen, null),
    regularMarketDayHigh: toNumber(q.regularMarketDayHigh, null),
    regularMarketDayLow: toNumber(q.regularMarketDayLow, null),
    regularMarketPreviousClose: toNumber(q.regularMarketPreviousClose, null),
    regularMarketVolume: toNumber(q.regularMarketVolume, 0),
    averageVolume: toNumber(q.averageVolume, null),
    averageDailyVolume3Month: toNumber(q.averageDailyVolume3Month, null),
    marketCap: toNumber(q.marketCap, null),
    fiftyTwoWeekHigh: toNumber(q.fiftyTwoWeekHigh, null),
    fiftyTwoWeekLow: toNumber(q.fiftyTwoWeekLow, null),
    trailingPE: toNumber(q.trailingPE, null),
    forwardPE: toNumber(q.forwardPE, null),
    bid: toNumber(q.bid, null),
    ask: toNumber(q.ask, null),
    preMarketPrice: toNumber(q.preMarketPrice, null),
    preMarketChange: toNumber(q.preMarketChange, null),
    preMarketChangePercent: toNumber(q.preMarketChangePercent, null),
    postMarketPrice: toNumber(q.postMarketPrice, null),
    postMarketChange: toNumber(q.postMarketChange, null),
    postMarketChangePercent: toNumber(q.postMarketChangePercent, null),
    shortNameSafe: q.shortName || q.longName || q.symbol || "",
    exchange: q.fullExchangeName || q.exchange || "",
    quoteType: q.quoteType || "",
    currency: q.currency || "USD",
    sourceInterval: q.sourceInterval || null,
    region: q.region || "",
    shortPercentOfFloat: toNumber(q.shortPercentOfFloat, null)
  };
}

function buildFallbackQuote(symbol, chartMeta = {}, chartResult = {}) {
  const meta = chartMeta || {};
  const indicators = chartResult?.indicators?.quote?.[0] || {};
  const closes = chartResult?.indicators?.adjclose?.[0]?.adjclose || [];
  const volumes = indicators?.volume || [];
  const highs = indicators?.high || [];
  const lows = indicators?.low || [];
  const opens = indicators?.open || [];

  const validCloseSeries = closes.filter((x) => Number.isFinite(Number(x))).map(Number);
  const validVolumeSeries = volumes.filter((x) => Number.isFinite(Number(x))).map(Number);
  const validHighSeries = highs.filter((x) => Number.isFinite(Number(x))).map(Number);
  const validLowSeries = lows.filter((x) => Number.isFinite(Number(x))).map(Number);
  const validOpenSeries = opens.filter((x) => Number.isFinite(Number(x))).map(Number);

  const price =
    toNumber(meta.regularMarketPrice, null) ??
    (validCloseSeries.length ? validCloseSeries[validCloseSeries.length - 1] : null);

  const prevClose =
    toNumber(meta.previousClose, null) ??
    toNumber(meta.chartPreviousClose, null) ??
    (validCloseSeries.length >= 2 ? validCloseSeries[validCloseSeries.length - 2] : null);

  const change = price != null && prevClose != null ? price - prevClose : 0;
  const changePercent =
    price != null && prevClose != null && prevClose !== 0 ? (change / prevClose) * 100 : 0;

  const avgVolume =
    validVolumeSeries.length > 1
      ? validVolumeSeries.reduce((a, b) => a + b, 0) / validVolumeSeries.length
      : validVolumeSeries[0] || null;

  return {
    symbol,
    shortName: meta.symbol || symbol,
    longName: meta.symbol || symbol,
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketOpen: toNumber(meta.regularMarketOpen, validOpenSeries[validOpenSeries.length - 1] || null),
    regularMarketDayHigh: toNumber(meta.regularMarketDayHigh, validHighSeries[validHighSeries.length - 1] || null),
    regularMarketDayLow: toNumber(meta.regularMarketDayLow, validLowSeries[validLowSeries.length - 1] || null),
    regularMarketPreviousClose: prevClose,
    regularMarketVolume: toNumber(meta.regularMarketVolume, validVolumeSeries[validVolumeSeries.length - 1] || 0),
    averageVolume: avgVolume,
    averageDailyVolume3Month: avgVolume,
    marketCap: toNumber(meta.marketCap, null),
    fiftyTwoWeekHigh: toNumber(meta.fiftyTwoWeekHigh, validHighSeries.length ? Math.max(...validHighSeries) : null),
    fiftyTwoWeekLow: toNumber(meta.fiftyTwoWeekLow, validLowSeries.length ? Math.min(...validLowSeries) : null),
    trailingPE: null,
    forwardPE: null,
    bid: null,
    ask: null,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    shortNameSafe: meta.symbol || symbol,
    exchange: meta.exchangeName || "",
    quoteType: meta.instrumentType || "",
    currency: meta.currency || "USD",
    sourceInterval: meta.dataGranularity || null,
    region: "",
    shortPercentOfFloat: null
  };
}

async function fetchYahooBatchQuotes(symbols) {
  if (!symbols.length) {
    return [];
  }

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(",")
  )}`;

  const data = await safeFetchJson(url, {}, 2);
  const results = data?.quoteResponse?.result || [];

  return Array.isArray(results) ? results.map(normalizeYahooQuote) : [];
}

async function fetchYahooChartFallback(symbol) {
  const intervals = [
    { range: "5d", interval: "1d" },
    { range: "1mo", interval: "1d" }
  ];

  for (const item of intervals) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=${item.range}&interval=${item.interval}&includePrePost=true`;

      const data = await safeFetchJson(url, {}, 1);
      const result = data?.chart?.result?.[0];

      if (result) {
        const built = buildFallbackQuote(symbol, result.meta, result);
        if (built && built.regularMarketPrice != null) {
          return built;
        }
      }
    } catch (error) {
      // devam
    }
  }

  return {
    symbol,
    shortName: symbol,
    longName: symbol,
    regularMarketPrice: null,
    regularMarketChange: 0,
    regularMarketChangePercent: 0,
    regularMarketOpen: null,
    regularMarketDayHigh: null,
    regularMarketDayLow: null,
    regularMarketPreviousClose: null,
    regularMarketVolume: 0,
    averageVolume: null,
    averageDailyVolume3Month: null,
    marketCap: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    trailingPE: null,
    forwardPE: null,
    bid: null,
    ask: null,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    postMarketPrice: null,
    postMarketChange: null,
    postMarketChangePercent: null,
    shortNameSafe: symbol,
    exchange: "",
    quoteType: "",
    currency: "USD",
    sourceInterval: null,
    region: "",
    shortPercentOfFloat: null
  };
}

async function getQuotesWithFallback(symbols) {
  const batchQuotes = await fetchYahooBatchQuotes(symbols);
  const batchMap = new Map();

  for (const q of batchQuotes) {
    if (q?.symbol) {
      batchMap.set(q.symbol, q);
    }
  }

  const finalResults = [];

  for (const symbol of symbols) {
    const existing = batchMap.get(symbol);

    if (existing && existing.regularMarketPrice != null) {
      finalResults.push(existing);
      continue;
    }

    try {
      const fallback = await fetchYahooChartFallback(symbol);
      finalResults.push(fallback);
    } catch (error) {
      finalResults.push({
        symbol,
        shortName: symbol,
        longName: symbol,
        regularMarketPrice: null,
        regularMarketChange: 0,
        regularMarketChangePercent: 0,
        regularMarketOpen: null,
        regularMarketDayHigh: null,
        regularMarketDayLow: null,
        regularMarketPreviousClose: null,
        regularMarketVolume: 0,
        averageVolume: null,
        averageDailyVolume3Month: null,
        marketCap: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        trailingPE: null,
        forwardPE: null,
        bid: null,
        ask: null,
        preMarketPrice: null,
        preMarketChange: null,
        preMarketChangePercent: null,
        postMarketPrice: null,
        postMarketChange: null,
        postMarketChangePercent: null,
        shortNameSafe: symbol,
        exchange: "",
        quoteType: "",
        currency: "USD",
        sourceInterval: null,
        region: "",
        shortPercentOfFloat: null
      });
    }

    await sleep(40);
  }

  return finalResults;
}

/* ---------------- STATIC FRONTEND ---------------- */

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ---------------- API ---------------- */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/quote", async (req, res) => {
  try {
    const symbols = parseSymbols(req.query.symbols);

    if (!symbols.length) {
      return res.status(400).json({
        error: "symbols query param gerekli",
        example: "/api/quote?symbols=AAPL,TSLA,NVDA"
      });
    }

    const quotes = await getQuotesWithFallback(symbols);

    return res.json({
      quoteResponse: {
        result: quotes,
        error: null
      }
    });
  } catch (error) {
    console.error("QUOTE ERROR:", error);

    return res.status(500).json({
      quoteResponse: {
        result: [],
        error: "Quote verisi alınamadı"
      },
      details: error.message
    });
  }
});

app.get("/api/feargreed", async (req, res) => {
  const sources = [
    "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
    "https://production.dataviz.cnn.io/index/fearandgreed/graphdata/"
  ];

  for (const url of sources) {
    try {
      const data = await safeFetchJson(
        url,
        {
          headers: {
            Referer: "https://www.cnn.com/markets/fear-and-greed",
            Origin: "https://www.cnn.com"
          }
        },
        1
      );

      const score =
        toNumber(data?.fear_and_greed?.score, null) ??
        toNumber(data?.fear_and_greed_historical?.data?.[0]?.score, null) ??
        50;

      const rating =
        data?.fear_and_greed?.rating ||
        data?.fear_and_greed_historical?.data?.[0]?.rating ||
        "neutral";

      return res.json({
        fear_and_greed: {
          score,
          rating
        }
      });
    } catch (error) {
      // sonraki kaynağı dene
    }
  }

  return res.json({
    fear_and_greed: {
      score: 50,
      rating: "neutral"
    }
  });
});

/* ---------------- 404 ---------------- */

app.use((req, res) => {
  res.status(404).json({
    error: "Not found"
  });
});

app.listen(PORT, () => {
  console.log(`TradeDesk backend running on port ${PORT}`);
});

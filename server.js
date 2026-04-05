const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

const ALPACA_API_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY || "";
const ALPACA_BASE_URL =
  process.env.ALPACA_BASE_URL || "https://data.alpaca.markets/v2";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com"
};

const SYMBOL_MAP = {
  VIX: "^VIX",
  NASDAQ: "^IXIC",
  SP500: "^GSPC"
};

const REVERSE_SYMBOL_MAP = {
  "^VIX": "VIX",
  "^IXIC": "NASDAQ",
  "^GSPC": "SP500"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeSymbol(symbol) {
  const s = String(symbol || "").trim().toUpperCase();
  const mapped = SYMBOL_MAP[s] || s;
  return mapped.replace(/[^A-Z0-9.^\-]/g, "");
}

function parseSymbols(raw) {
  return String(raw || "")
    .split(",")
    .map(sanitizeSymbol)
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .slice(0, 300);
}

function displaySymbol(symbol) {
  return REVERSE_SYMBOL_MAP[symbol] || symbol;
}

async function safeFetchJson(url, options = {}, retries = 2, timeoutMs = 10000) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: options.headers || DEFAULT_HEADERS,
        body: options.body,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}${text ? ` - ${text}` : ""}`);
      }

      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (jsonError) {
        throw new Error(`JSON parse error: ${jsonError.message}`);
      }
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

function normalizeQuoteShape(q = {}) {
  const rawSymbol = q.symbol || "";
  const shownSymbol = displaySymbol(rawSymbol);

  return {
    symbol: shownSymbol,
    originalSymbol: rawSymbol,
    shortName:
      q.shortName ||
      q.longName ||
      q.displayName ||
      shownSymbol ||
      rawSymbol ||
      "",
    longName:
      q.longName ||
      q.shortName ||
      q.displayName ||
      shownSymbol ||
      rawSymbol ||
      "",
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
    shortNameSafe:
      q.shortNameSafe ||
      q.shortName ||
      q.longName ||
      shownSymbol ||
      rawSymbol ||
      "",
    exchange: q.exchange || "",
    quoteType: q.quoteType || "",
    currency: q.currency || "USD",
    sourceInterval: q.sourceInterval || null,
    region: q.region || "",
    shortPercentOfFloat: toNumber(q.shortPercentOfFloat, null)
  };
}

function normalizeYahooQuote(q = {}) {
  return normalizeQuoteShape({
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
  });
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

  return normalizeQuoteShape({
    symbol,
    shortName: displaySymbol(symbol),
    longName: displaySymbol(symbol),
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketOpen: toNumber(
      meta.regularMarketOpen,
      validOpenSeries[validOpenSeries.length - 1] || null
    ),
    regularMarketDayHigh: toNumber(
      meta.regularMarketDayHigh,
      validHighSeries[validHighSeries.length - 1] || null
    ),
    regularMarketDayLow: toNumber(
      meta.regularMarketDayLow,
      validLowSeries[validLowSeries.length - 1] || null
    ),
    regularMarketPreviousClose: prevClose,
    regularMarketVolume: toNumber(
      meta.regularMarketVolume,
      validVolumeSeries[validVolumeSeries.length - 1] || 0
    ),
    averageVolume: avgVolume,
    averageDailyVolume3Month: avgVolume,
    marketCap: toNumber(meta.marketCap, null),
    fiftyTwoWeekHigh: toNumber(
      meta.fiftyTwoWeekHigh,
      validHighSeries.length ? Math.max(...validHighSeries) : null
    ),
    fiftyTwoWeekLow: toNumber(
      meta.fiftyTwoWeekLow,
      validLowSeries.length ? Math.min(...validLowSeries) : null
    ),
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
    shortNameSafe: displaySymbol(symbol),
    exchange: meta.exchangeName || "",
    quoteType: meta.instrumentType || "",
    currency: meta.currency || "USD",
    sourceInterval: meta.dataGranularity || null,
    region: "",
    shortPercentOfFloat: null
  });
}

function mapAlpacaBarsToQuote(symbol, bars = []) {
  const validBars = Array.isArray(bars) ? bars : [];

  if (!validBars.length) {
    return normalizeQuoteShape({
      symbol,
      shortName: displaySymbol(symbol),
      longName: displaySymbol(symbol),
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
      shortNameSafe: displaySymbol(symbol),
      exchange: "Alpaca",
      quoteType: "EQUITY",
      currency: "USD",
      sourceInterval: "1Day",
      region: "US",
      shortPercentOfFloat: null
    });
  }

  const last = validBars[validBars.length - 1];
  const prev = validBars.length >= 2 ? validBars[validBars.length - 2] : null;

  const price = toNumber(last.c, null);
  const open = toNumber(last.o, null);
  const high = toNumber(last.h, null);
  const low = toNumber(last.l, null);
  const volume = toNumber(last.v, 0);
  const prevClose = prev ? toNumber(prev.c, null) : open;

  const change = price != null && prevClose != null ? price - prevClose : 0;
  const changePercent =
    price != null && prevClose != null && prevClose !== 0 ? (change / prevClose) * 100 : 0;

  const volumes = validBars.map((b) => toNumber(b.v, 0)).filter((x) => Number.isFinite(x));
  const avgVolume = volumes.length
    ? volumes.reduce((a, b) => a + b, 0) / volumes.length
    : null;

  const highs = validBars.map((b) => toNumber(b.h, null)).filter((x) => x != null);
  const lows = validBars.map((b) => toNumber(b.l, null)).filter((x) => x != null);

  return normalizeQuoteShape({
    symbol,
    shortName: displaySymbol(symbol),
    longName: displaySymbol(symbol),
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketOpen: open,
    regularMarketDayHigh: high,
    regularMarketDayLow: low,
    regularMarketPreviousClose: prevClose,
    regularMarketVolume: volume,
    averageVolume: avgVolume,
    averageDailyVolume3Month: avgVolume,
    marketCap: null,
    fiftyTwoWeekHigh: highs.length ? Math.max(...highs) : null,
    fiftyTwoWeekLow: lows.length ? Math.min(...lows) : null,
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
    shortNameSafe: displaySymbol(symbol),
    exchange: "Alpaca",
    quoteType: "EQUITY",
    currency: "USD",
    sourceInterval: "1Day",
    region: "US",
    shortPercentOfFloat: null
  });
}

async function fetchAlpacaBars(symbols) {
  if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY || !symbols.length) {
    return [];
  }

  const now = new Date();
  const end = now.toISOString();
  const start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

  const equitySymbols = symbols.filter((s) => !s.startsWith("^"));
  if (!equitySymbols.length) {
    return [];
  }

  const url =
    `${ALPACA_BASE_URL}/stocks/bars?symbols=${encodeURIComponent(equitySymbols.join(","))}` +
    `&timeframe=1Day&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}` +
    `&adjustment=raw&feed=iex&sort=asc&limit=15`;

  const data = await safeFetchJson(
    url,
    {
      headers: {
        accept: "application/json",
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
      }
    },
    1,
    12000
  );

  const barsMap = data?.bars || {};
  return equitySymbols.map((symbol) => mapAlpacaBarsToQuote(symbol, barsMap[symbol] || []));
}

async function fetchYahooBatchQuotes(symbols) {
  if (!symbols.length) return [];

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(",")
  )}`;

  const data = await safeFetchJson(
    url,
    { headers: DEFAULT_HEADERS },
    1,
    9000
  );

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

      const data = await safeFetchJson(
        url,
        { headers: DEFAULT_HEADERS },
        1,
        9000
      );

      const result = data?.chart?.result?.[0];

      if (result) {
        const built = buildFallbackQuote(symbol, result.meta, result);
        if (built && built.regularMarketPrice != null) {
          return built;
        }
      }
    } catch (error) {
      console.error(`YAHOO FALLBACK ERROR [${symbol}]:`, error.message);
    }
  }

  return normalizeQuoteShape({
    symbol,
    shortName: displaySymbol(symbol),
    longName: displaySymbol(symbol),
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
    shortNameSafe: displaySymbol(symbol),
    exchange: "",
    quoteType: "",
    currency: "USD",
    sourceInterval: null,
    region: "",
    shortPercentOfFloat: null
  });
}

async function fetchYahooQuotesWithFallback(symbols) {
  const batchMap = new Map();

  try {
    const batchQuotes = await fetchYahooBatchQuotes(symbols);
    for (const q of batchQuotes) {
      if (q?.originalSymbol) batchMap.set(q.originalSymbol, q);
      else if (q?.symbol) batchMap.set(q.symbol, q);
    }
  } catch (error) {
    console.error("YAHOO BATCH ERROR:", error.message);
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
      finalResults.push(
        normalizeQuoteShape({
          symbol,
          shortName: displaySymbol(symbol),
          longName: displaySymbol(symbol),
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
          shortNameSafe: displaySymbol(symbol),
          exchange: "",
          quoteType: "",
          currency: "USD",
          sourceInterval: null,
          region: "",
          shortPercentOfFloat: null
        })
      );
    }

    await sleep(120);
  }

  return finalResults;
}

async function getQuotesWithFallback(symbols) {
  let alpacaQuotes = [];

  if (ALPACA_API_KEY && ALPACA_SECRET_KEY) {
    try {
      alpacaQuotes = await fetchAlpacaBars(symbols);
    } catch (error) {
      console.error("ALPACA ERROR:", error.message);
    }
  } else {
    console.log("ALPACA keys not set, using Yahoo fallback only.");
  }

  const alpacaMap = new Map(
    alpacaQuotes
      .filter((q) => q && q.originalSymbol)
      .map((q) => [q.originalSymbol, q])
  );

  const missingSymbols = symbols.filter((symbol) => {
    const q = alpacaMap.get(symbol);
    return !q || q.regularMarketPrice == null;
  });

  let yahooQuotes = [];
  if (missingSymbols.length) {
    yahooQuotes = await fetchYahooQuotesWithFallback(missingSymbols);
  }

  const yahooMap = new Map(
    yahooQuotes
      .filter((q) => q && q.originalSymbol)
      .map((q) => [q.originalSymbol, q])
  );

  return symbols.map((symbol) => {
    const alpaca = alpacaMap.get(symbol);
    if (alpaca && alpaca.regularMarketPrice != null) return alpaca;

    const yahoo = yahooMap.get(symbol);
    if (yahoo) return yahoo;

    return normalizeQuoteShape({
      symbol,
      shortName: displaySymbol(symbol),
      longName: displaySymbol(symbol),
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
      shortNameSafe: displaySymbol(symbol),
      exchange: "",
      quoteType: "",
      currency: "USD",
      sourceInterval: null,
      region: "",
      shortPercentOfFloat: null
    });
  });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    alpacaConfigured: Boolean(ALPACA_API_KEY && ALPACA_SECRET_KEY)
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
    console.error("QUOTE ERROR:", error.message);

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
            "User-Agent": DEFAULT_HEADERS["User-Agent"],
            Accept: "application/json,text/plain,*/*",
            Referer: "https://www.cnn.com/markets/fear-and-greed",
            Origin: "https://www.cnn.com"
          }
        },
        1,
        9000
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
      console.error("FEAR_GREED ERROR:", error.message);
    }
  }

  return res.json({
    fear_and_greed: {
      score: 50,
      rating: "neutral"
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found"
  });
});

app.listen(PORT, () => {
  console.log(`TradeDesk backend running on port ${PORT}`);
});

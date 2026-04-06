const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT;

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

const FUNDAMENTAL_DB = {
  IONQ: {
    theme: "Quantum",
    stage_bias: "early",
    narrative_quality: 9,
    catalyst_strength: 9,
    revenue_growth_score: 8,
    cash_runway_score: 7,
    dilution_risk: 5,
    debt_pressure: 2,
    addressable_market_score: 9,
    execution_confidence: 6,
    conviction_multiplier: 1.18,
    notes: "Quantum computing leader narrative; high TAM; high upside."
  },
  RGTI: {
    theme: "Quantum",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 8,
    revenue_growth_score: 6,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 3,
    addressable_market_score: 9,
    execution_confidence: 5,
    conviction_multiplier: 1.10,
    notes: "Higher-risk quantum candidate with speculative upside."
  },
  QBTS: {
    theme: "Quantum",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 8,
    revenue_growth_score: 6,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 3,
    addressable_market_score: 9,
    execution_confidence: 5,
    conviction_multiplier: 1.08,
    notes: "Quantum theme strong; speculative execution profile."
  },
  QUBT: {
    theme: "Quantum",
    stage_bias: "early",
    narrative_quality: 7,
    catalyst_strength: 7,
    revenue_growth_score: 5,
    cash_runway_score: 4,
    dilution_risk: 8,
    debt_pressure: 3,
    addressable_market_score: 8,
    execution_confidence: 4,
    conviction_multiplier: 1.02,
    notes: "High beta quantum exposure; weaker execution confidence."
  },
  PLTR: {
    theme: "AI",
    stage_bias: "mid",
    narrative_quality: 10,
    catalyst_strength: 9,
    revenue_growth_score: 9,
    cash_runway_score: 10,
    dilution_risk: 2,
    debt_pressure: 1,
    addressable_market_score: 9,
    execution_confidence: 9,
    conviction_multiplier: 1.12,
    notes: "High-quality AI platform; more mature than earlier stage names."
  },
  SOUN: {
    theme: "AI",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 8,
    revenue_growth_score: 7,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 3,
    addressable_market_score: 8,
    execution_confidence: 5,
    conviction_multiplier: 1.09,
    notes: "Voice AI narrative strong; financing still matters."
  },
  BBAI: {
    theme: "AI",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 7,
    revenue_growth_score: 6,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 4,
    addressable_market_score: 8,
    execution_confidence: 5,
    conviction_multiplier: 1.06,
    notes: "Speculative AI/public sector theme."
  },
  RXRX: {
    theme: "AI/Biotech",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 8,
    revenue_growth_score: 5,
    cash_runway_score: 7,
    dilution_risk: 6,
    debt_pressure: 2,
    addressable_market_score: 9,
    execution_confidence: 5,
    conviction_multiplier: 1.08,
    notes: "AI drug discovery; long commercialization path."
  },
  DNA: {
    theme: "Biotech",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 6,
    revenue_growth_score: 5,
    cash_runway_score: 5,
    dilution_risk: 8,
    debt_pressure: 4,
    addressable_market_score: 9,
    execution_confidence: 4,
    conviction_multiplier: 1.01,
    notes: "Synthetic biology mega-story, but financing risk elevated."
  },
  CTMX: {
    theme: "Biotech",
    stage_bias: "early",
    narrative_quality: 7,
    catalyst_strength: 7,
    revenue_growth_score: 4,
    cash_runway_score: 5,
    dilution_risk: 8,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 4,
    conviction_multiplier: 0.98,
    notes: "Biotech catalyst-driven, high risk/high reward."
  },
  SOPA: {
    theme: "Speculative Growth",
    stage_bias: "early",
    narrative_quality: 6,
    catalyst_strength: 5,
    revenue_growth_score: 4,
    cash_runway_score: 3,
    dilution_risk: 9,
    debt_pressure: 4,
    addressable_market_score: 6,
    execution_confidence: 3,
    conviction_multiplier: 0.92,
    notes: "Very speculative; should rank below better quality names."
  },
  LUNR: {
    theme: "Space",
    stage_bias: "mid",
    narrative_quality: 9,
    catalyst_strength: 9,
    revenue_growth_score: 7,
    cash_runway_score: 6,
    dilution_risk: 6,
    debt_pressure: 3,
    addressable_market_score: 9,
    execution_confidence: 6,
    conviction_multiplier: 1.12,
    notes: "Lunar infrastructure narrative with strong catalyst appeal."
  },
  RKLB: {
    theme: "Space",
    stage_bias: "mid",
    narrative_quality: 9,
    catalyst_strength: 9,
    revenue_growth_score: 8,
    cash_runway_score: 8,
    dilution_risk: 4,
    debt_pressure: 2,
    addressable_market_score: 9,
    execution_confidence: 8,
    conviction_multiplier: 1.15,
    notes: "One of the stronger space execution stories."
  },
  ASTS: {
    theme: "Space",
    stage_bias: "mid",
    narrative_quality: 10,
    catalyst_strength: 9,
    revenue_growth_score: 5,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 3,
    addressable_market_score: 10,
    execution_confidence: 6,
    conviction_multiplier: 1.10,
    notes: "Huge TAM story; execution and financing still critical."
  },
  PL: {
    theme: "Space",
    stage_bias: "mid",
    narrative_quality: 7,
    catalyst_strength: 7,
    revenue_growth_score: 6,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 3,
    addressable_market_score: 8,
    execution_confidence: 5,
    conviction_multiplier: 1.00,
    notes: "Space data theme; more selective treatment needed."
  },
  JOBY: {
    theme: "eVTOL",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 8,
    revenue_growth_score: 3,
    cash_runway_score: 7,
    dilution_risk: 6,
    debt_pressure: 2,
    addressable_market_score: 9,
    execution_confidence: 6,
    conviction_multiplier: 1.06,
    notes: "Strong TAM, pre-scale commercialization."
  },
  ACHR: {
    theme: "eVTOL",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 8,
    revenue_growth_score: 3,
    cash_runway_score: 6,
    dilution_risk: 7,
    debt_pressure: 2,
    addressable_market_score: 9,
    execution_confidence: 5,
    conviction_multiplier: 1.04,
    notes: "eVTOL upside, but capital needs remain important."
  },
  ENVX: {
    theme: "Battery",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 7,
    revenue_growth_score: 4,
    cash_runway_score: 6,
    dilution_risk: 7,
    debt_pressure: 2,
    addressable_market_score: 9,
    execution_confidence: 5,
    conviction_multiplier: 1.05,
    notes: "Battery innovation theme; execution still developing."
  },
  QS: {
    theme: "Battery",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 7,
    revenue_growth_score: 2,
    cash_runway_score: 6,
    dilution_risk: 7,
    debt_pressure: 2,
    addressable_market_score: 9,
    execution_confidence: 4,
    conviction_multiplier: 1.00,
    notes: "Big battery narrative but long commercialization curve."
  },
  EOSE: {
    theme: "Energy Storage",
    stage_bias: "early",
    narrative_quality: 8,
    catalyst_strength: 8,
    revenue_growth_score: 6,
    cash_runway_score: 5,
    dilution_risk: 8,
    debt_pressure: 4,
    addressable_market_score: 9,
    execution_confidence: 5,
    conviction_multiplier: 1.07,
    notes: "Energy storage tailwind, but financing risk meaningful."
  },
  MARA: {
    theme: "Crypto Infra",
    stage_bias: "early",
    narrative_quality: 7,
    catalyst_strength: 8,
    revenue_growth_score: 6,
    cash_runway_score: 7,
    dilution_risk: 6,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 6,
    conviction_multiplier: 0.98,
    notes: "Cycle-driven upside; more BTC beta than pure execution."
  },
  RIOT: {
    theme: "Crypto Infra",
    stage_bias: "mid",
    narrative_quality: 7,
    catalyst_strength: 8,
    revenue_growth_score: 5,
    cash_runway_score: 6,
    dilution_risk: 6,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 6,
    conviction_multiplier: 0.96,
    notes: "Cycle-levered, less pure multi-bagger quality."
  },
  CLSK: {
    theme: "Crypto Infra",
    stage_bias: "early",
    narrative_quality: 7,
    catalyst_strength: 8,
    revenue_growth_score: 6,
    cash_runway_score: 6,
    dilution_risk: 6,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 6,
    conviction_multiplier: 0.98,
    notes: "Crypto infrastructure exposure with cycle sensitivity."
  },
  HUT: {
    theme: "Crypto Infra",
    stage_bias: "early",
    narrative_quality: 7,
    catalyst_strength: 7,
    revenue_growth_score: 5,
    cash_runway_score: 6,
    dilution_risk: 6,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 5,
    conviction_multiplier: 0.95,
    notes: "Higher-risk crypto infra candidate."
  },
  IREN: {
    theme: "Crypto Infra",
    stage_bias: "early",
    narrative_quality: 7,
    catalyst_strength: 7,
    revenue_growth_score: 5,
    cash_runway_score: 6,
    dilution_risk: 6,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 5,
    conviction_multiplier: 0.95,
    notes: "Crypto infra, cycle-sensitive."
  },
  BITF: {
    theme: "Crypto Infra",
    stage_bias: "early",
    narrative_quality: 6,
    catalyst_strength: 6,
    revenue_growth_score: 4,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 4,
    conviction_multiplier: 0.90,
    notes: "Speculative crypto miner profile."
  },
  CIFR: {
    theme: "Crypto Infra",
    stage_bias: "early",
    narrative_quality: 6,
    catalyst_strength: 6,
    revenue_growth_score: 4,
    cash_runway_score: 5,
    dilution_risk: 7,
    debt_pressure: 3,
    addressable_market_score: 7,
    execution_confidence: 4,
    conviction_multiplier: 0.90,
    notes: "Speculative crypto miner profile."
  }
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
  return mapped.replace(/[^A-Z0-9.^-]/g, "");
}

function parseSymbols(raw) {
  return String(raw || "")
    .split(",")
    .map(sanitizeSymbol)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 300);
}

function displaySymbol(symbol) {
  return REVERSE_SYMBOL_MAP[symbol] || symbol;
}

function getFundamentalMetadata(symbol) {
  const upper = String(symbol || "").toUpperCase();
  const item = FUNDAMENTAL_DB[upper];
  return item ? { symbol: upper, ...item } : null;
}

function getFundamentalsForSymbols(symbols) {
  return symbols.map((s) => getFundamentalMetadata(s)).filter(Boolean);
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
      return JSON.parse(text);
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
    shortName: q.shortName || q.longName || q.displayName || shownSymbol || rawSymbol || "",
    longName: q.longName || q.shortName || q.displayName || shownSymbol || rawSymbol || "",
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
    shortNameSafe: q.shortNameSafe || q.shortName || q.longName || shownSymbol || rawSymbol || "",
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
    regularMarketPrice: q.regularMarketPrice,
    regularMarketChange: q.regularMarketChange,
    regularMarketChangePercent: q.regularMarketChangePercent,
    regularMarketOpen: q.regularMarketOpen,
    regularMarketDayHigh: q.regularMarketDayHigh,
    regularMarketDayLow: q.regularMarketDayLow,
    regularMarketPreviousClose: q.regularMarketPreviousClose,
    regularMarketVolume: q.regularMarketVolume,
    averageVolume: q.averageVolume,
    averageDailyVolume3Month: q.averageDailyVolume3Month,
    marketCap: q.marketCap,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    trailingPE: q.trailingPE,
    forwardPE: q.forwardPE,
    bid: q.bid,
    ask: q.ask,
    preMarketPrice: q.preMarketPrice,
    preMarketChange: q.preMarketChange,
    preMarketChangePercent: q.preMarketChangePercent,
    postMarketPrice: q.postMarketPrice,
    postMarketChange: q.postMarketChange,
    postMarketChangePercent: q.postMarketChangePercent,
    shortNameSafe: q.shortName || q.longName || q.symbol || "",
    exchange: q.fullExchangeName || q.exchange || "",
    quoteType: q.quoteType || "",
    currency: q.currency || "USD",
    sourceInterval: q.sourceInterval || null,
    region: q.region || "",
    shortPercentOfFloat: q.shortPercentOfFloat
  });
}

function buildFallbackQuote(symbol, chartMeta = {}, chartResult = {}) {
  const meta = chartMeta || {};
  const indicators = chartResult?.indicators?.quote?.[0] || {};
  const closes = indicators?.close || chartResult?.indicators?.adjclose?.[0]?.adjclose || [];
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
  const avgVolume = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null;

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

function mapChartBars(symbol, result = {}) {
  const meta = result?.meta || {};
  const ts = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};

  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const bars = [];

  for (let i = 0; i < ts.length; i++) {
    const bar = {
      t: ts[i] ? new Date(ts[i] * 1000).toISOString() : null,
      o: toNumber(opens[i], null),
      h: toNumber(highs[i], null),
      l: toNumber(lows[i], null),
      c: toNumber(closes[i], null),
      v: toNumber(volumes[i], 0)
    };

    if (bar.t && [bar.o, bar.h, bar.l, bar.c].some((x) => x != null)) {
      bars.push(bar);
    }
  }

  return {
    symbol: displaySymbol(symbol),
    originalSymbol: symbol,
    meta: {
      currency: meta.currency || "USD",
      exchangeName: meta.exchangeName || "",
      instrumentType: meta.instrumentType || "",
      regularMarketPrice: toNumber(meta.regularMarketPrice, null),
      previousClose: toNumber(meta.previousClose, null),
      gmtoffset: meta.gmtoffset || null,
      timezone: meta.timezone || "",
      dataGranularity: meta.dataGranularity || ""
    },
    bars
  };
}

async function fetchAlpacaBars(symbols) {
  if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY || !symbols.length) return [];

  const equitySymbols = symbols.filter((s) => !s.startsWith("^"));
  if (!equitySymbols.length) return [];

  const now = new Date();
  const end = now.toISOString();
  const start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

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

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
  const data = await safeFetchJson(url, { headers: DEFAULT_HEADERS }, 1, 9000);
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
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${item.range}&interval=${item.interval}&includePrePost=true`;
      const data = await safeFetchJson(url, { headers: DEFAULT_HEADERS }, 1, 9000);
      const result = data?.chart?.result?.[0];

      if (result) {
        const built = buildFallbackQuote(symbol, result.meta, result);
        if (built && built.regularMarketPrice != null) return built;
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
      console.error(`YAHOO FINAL FALLBACK ERROR [${symbol}]:`, error.message);
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

    await sleep(100);
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
    alpacaQuotes.filter((q) => q && q.originalSymbol).map((q) => [q.originalSymbol, q])
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
    yahooQuotes.filter((q) => q && q.originalSymbol).map((q) => [q.originalSymbol, q])
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

async function fetchYahooIntraday(symbol, interval = "5m", range = "1d", includePrePost = true) {
  const safeInterval = ["1m", "2m", "5m", "15m", "30m", "60m"].includes(interval)
    ? interval
    : "5m";
  const safeRange = ["1d", "5d", "1mo"].includes(range) ? range : "1d";

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${encodeURIComponent(safeRange)}` +
    `&interval=${encodeURIComponent(safeInterval)}` +
    `&includePrePost=${includePrePost ? "true" : "false"}`;

  const data = await safeFetchJson(url, { headers: DEFAULT_HEADERS }, 1, 10000);
  const result = data?.chart?.result?.[0];

  if (!result) {
    return {
      symbol: displaySymbol(symbol),
      originalSymbol: symbol,
      meta: {},
      bars: []
    };
  }

  return mapChartBars(symbol, result);
}

async function fetchIntradayForSymbols(symbols, interval = "5m", range = "1d", includePrePost = true) {
  const out = [];

  for (const symbol of symbols) {
    try {
      const data = await fetchYahooIntraday(symbol, interval, range, includePrePost);
      out.push(data);
    } catch (error) {
      console.error(`INTRADAY ERROR [${symbol}]:`, error.message);
      out.push({
        symbol: displaySymbol(symbol),
        originalSymbol: symbol,
        meta: {},
        bars: []
      });
    }

    await sleep(80);
  }

  return out;
}

function sendQuotesResponse(res, quotes) {
  return res.json({
    quoteResponse: {
      result: quotes,
      error: null
    },
    quotes,
    data: quotes
  });
}

function sendFundamentalsResponse(res, result) {
  return res.json({
    fundamentalsResponse: {
      result,
      error: null
    },
    fundamentals: result,
    data: result
  });
}

function sendIntradayResponse(res, result, interval, range, includePrePost) {
  return res.json({
    intradayResponse: {
      result,
      error: null,
      interval,
      range,
      includePrePost
    },
    intraday: result,
    data: result
  });
}

function sendFearGreedResponse(res, score, rating) {
  return res.json({
    fear_and_greed: {
      score,
      rating
    },
    score,
    rating
  });
}

async function handleQuoteRequest(req, res) {
  try {
    const symbols = parseSymbols(req.query.symbols);

    if (!symbols.length) {
      return res.status(400).json({
        error: "symbols query param gerekli",
        example: "/api/quote?symbols=AAPL,TSLA,NVDA"
      });
    }

    const quotes = await getQuotesWithFallback(symbols);
    return sendQuotesResponse(res, quotes);
  } catch (error) {
    console.error("QUOTE ERROR:", error.message);
    return res.status(500).json({
      quoteResponse: {
        result: [],
        error: "Quote verisi alınamadı"
      },
      quotes: [],
      data: [],
      details: error.message
    });
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    alpacaConfigured: Boolean(ALPACA_API_KEY && ALPACA_SECRET_KEY),
    fundamentalsCount: Object.keys(FUNDAMENTAL_DB).length
  });
});

app.get("/api/fundamentals", (req, res) => {
  try {
    const symbols = parseSymbols(req.query.symbols);
    const result = symbols.length
      ? getFundamentalsForSymbols(symbols)
      : Object.entries(FUNDAMENTAL_DB).map(([symbol, item]) => ({ symbol, ...item }));

    return sendFundamentalsResponse(res, result);
  } catch (error) {
    console.error("FUNDAMENTALS ERROR:", error.message);
    return res.status(500).json({
      fundamentalsResponse: {
        result: [],
        error: "Fundamental metadata alınamadı"
      },
      fundamentals: [],
      data: [],
      details: error.message
    });
  }
});

app.get("/api/quote", handleQuoteRequest);
app.get("/api/quotes", handleQuoteRequest);
app.get("/quotes", handleQuoteRequest);
app.get("/api/market/quotes", handleQuoteRequest);
app.get("/market/quotes", handleQuoteRequest);

app.get("/api/intraday", async (req, res) => {
  try {
    const symbols = parseSymbols(req.query.symbols);
    const interval = String(req.query.interval || "5m");
    const range = String(req.query.range || "1d");
    const includePrePost =
      String(
        req.query.includePrePost ??
        req.query.extended ??
        "true"
      ) !== "false";

    if (!symbols.length) {
      return res.status(400).json({
        error: "symbols query param gerekli",
        example: "/api/intraday?symbols=AAPL,TSLA&interval=5m&range=1d&includePrePost=true"
      });
    }

    const result = await fetchIntradayForSymbols(symbols, interval, range, includePrePost);
    return sendIntradayResponse(res, result, interval, range, includePrePost);
  } catch (error) {
    console.error("INTRADAY ERROR:", error.message);
    return res.status(500).json({
      intradayResponse: {
        result: [],
        error: "Intraday veri alınamadı"
      },
      intraday: [],
      data: [],
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

      return sendFearGreedResponse(res, score, rating);
    } catch (error) {
      console.error("FEAR_GREED ERROR:", error.message);
    }
  }

  return sendFearGreedResponse(res, 50, "neutral");
});

app.get("/api/fear-greed", async (req, res) => {
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

      return sendFearGreedResponse(res, score, rating);
    } catch (error) {
      console.error("FEAR_GREED ERROR:", error.message);
    }
  }

  return sendFearGreedResponse(res, 50, "neutral");
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found"
  });
});

if (!PORT) {
  console.error("PORT environment variable is missing.");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`TradeDesk backend running on port ${PORT}`);
});

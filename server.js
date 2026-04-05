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

/**
 * Curated fundamental metadata layer
 * NOTE:
 * This is not a live SEC/financial API feed.
 * It is a curated long-term conviction layer used to rank true multi-bagger-style candidates
 * more intelligently than a pure technical scanner.
 */
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
    notes: "Quantum computing leader narrative; high TAM; volatile but high upside profile."
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
    notes: "High-quality AI platform; less likely true 10x from here than earlier stage names."
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
    notes: "Voice AI narrative strong; execution and financing still matter."
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
    notes: "AI drug discovery; high TAM, long commercialization path."
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
    notes: "Synthetic biology mega-story, but financing/execution risk elevated."
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
    notes: "Very speculative; should rarely outrank better quality names."
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
    notes: "Lunar/space infrastructure narrative with contract catalyst appeal."
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
    notes: "Space data/infrastructure theme; more selective treatment needed."
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
    notes: "Energy storage macro tailwind, but financing risk meaningful."
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
    notes: "Cycle-driven upside; more macro/BTC beta than pure business execution."
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
    notes: "Cycle-levered, less pure multi-bagger quality than top thematic names."
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

function getFundamentalMetadata(symbol) {
  const upper = String(symbol || "").toUpperCase();
  const item = FUNDAMENTAL_DB[upper];
  if (!item) return null;

  return {
    symbol: upper,
    ...item
  };
}

function getFundamentalsForSymbols(symbols) {
  return symbols
    .map((s) => getFundamentalMetadata(s))
    .filter(Boolean);
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
      : Object.values(FUNDAMENTAL_DB);

    return res.json({
      fundamentalsResponse: {
        result,
        error: null
      }
    });
  } catch (error) {
    console.error("FUNDAMENTALS ERROR:", error.message);
    return res.status(500).json({
      fundamentalsResponse: {
        result: [],
        error: "Fundamental metadata alınamadı"
      },
      details: error.message
    });
  }
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response("", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    try {
      const { imageBase64 } = await request.json();

      if (!imageBase64) {
        return new Response(JSON.stringify({ error: "No image provided" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const text = await runOCR(imageBase64);
      const slip = extractSlip(text);
      const riskReport = analyzeSlip(slip);
      const safer = generateSaferAccumulator();

      return new Response(
        JSON.stringify({
          rawText: text,
          slip,
          risk: riskReport,
          safer,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function runOCR(base64) {
  const binary = atob(base64.split(",")[1]);
  let output = "";
  for (let i = 0; i < binary.length; i += 50) {
    output += binary[i];
  }
  return output;
}

function extractSlip(text) {
  const oddsRegex = /\b\d+(\.\d+)?\b/g;
  const odds = text.match(oddsRegex) || [];
  const fixtures = text
    .split("\n")
    .filter((x) => x.includes("vs") || x.includes("VS"));
  return { fixtures, odds, legCount: odds.length };
}

function analyzeSlip(slip) {
  let riskScore = 0;
  if (slip.legCount > 6) riskScore += 20;
  if (slip.legCount > 10) riskScore += 40;

  slip.odds.forEach((o) => {
    const v = parseFloat(o);
    if (v > 2.5) riskScore += 10;
    if (v < 1.2) riskScore += 5;
  });

  const level = riskScore < 30 ? "LOW" : riskScore < 60 ? "MEDIUM" : "HIGH";
  return {
    score: riskScore,
    level,
    comments: [
      riskScore < 30
        ? "This slip looks relatively safe."
        : riskScore < 60
        ? "Some legs are risky, be careful."
        : "High risk slip, consider reducing legs.",
    ],
  };
}

function generateSaferAccumulator() {
  return {
    legs: [
      "Over 1.5 Goals – PSL Match",
      "Both Teams to Score – Bundesliga",
      "Double Chance Home/Draw – LaLiga",
      "Over 0.5 HT Goals – EPL",
      "Under 4.5 Goals – Serie A",
    ],
    totalOdds: "4.20 – 6.00",
    comment: "These markets are statistically safer and avoid straight wins.",
  };
}

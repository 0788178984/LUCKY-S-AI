const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5500;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_CANDIDATES = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free"
];

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post("/api/chat", async (req, res) => {
  const prompt = req.body?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: { message: "Prompt is required." } });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: { message: "Missing OPENROUTER_API_KEY in server environment." }
    });
  }

  try {
    let lastStatus = 500;
    let lastPayload = { error: { message: "Unknown API error." } };
    let retryAfter = null;

    for (const model of MODEL_CANDIDATES) {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "X-Title": "Asmart AI"
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch (error) {
        payload = { error: { message: text || "Invalid JSON response." } };
      }

      if (response.ok) {
        const output = payload?.choices?.[0]?.message?.content || "";
        if (!output) {
          return res.status(502).json({ error: { message: "Provider returned empty output." } });
        }
        return res.json({ text: output });
      }

      lastStatus = response.status;
      lastPayload = payload || { error: { message: "Provider request failed." } };
      retryAfter = response.headers.get("retry-after");

      if (response.status !== 404) {
        break;
      }
    }

    if (retryAfter) {
      res.set("retry-after", retryAfter);
    }
    return res.status(lastStatus).json(lastPayload);
  } catch (error) {
    return res.status(500).json({
      error: { message: "Server proxy failed. Check network and key settings." }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Asmart AI server running at http://localhost:${PORT}`);
});

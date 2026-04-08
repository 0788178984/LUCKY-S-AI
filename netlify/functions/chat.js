const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_CANDIDATES = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free"
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: { message: "Method not allowed." } })
    };
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
  if (!OPENROUTER_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { message: "Missing OPENROUTER_API_KEY in Netlify environment." }
      })
    };
  }

  let requestBody = {};
  try {
    requestBody = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: { message: "Invalid JSON body." } })
    };
  }

  const prompt = requestBody?.prompt;
  if (!prompt || typeof prompt !== "string") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: { message: "Prompt is required." } })
    };
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
          return {
            statusCode: 502,
            body: JSON.stringify({ error: { message: "Provider returned empty output." } })
          };
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ text: output })
        };
      }

      lastStatus = response.status;
      lastPayload = payload || { error: { message: "Provider request failed." } };
      retryAfter = response.headers.get("retry-after");

      if (response.status !== 404) break;
    }

    const headers = retryAfter ? { "retry-after": retryAfter } : {};
    return {
      statusCode: lastStatus,
      headers,
      body: JSON.stringify(lastPayload)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { message: "Netlify function failed. Check key and network." }
      })
    };
  }
};

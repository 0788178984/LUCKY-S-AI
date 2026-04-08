# LUCKY-S-AI
Webchat

## Run with protected API key

1. Install dependencies:
   - `npm install`
2. Create `.env` from `.env.example` and set your key:
   - `OPENROUTER_API_KEY=sk-or-v1-...`
3. Start server:
   - `npm start`
4. Open:
   - `http://localhost:5500`

Your API key stays on the server and is not exposed in frontend JavaScript.

## Deploy on Netlify (GitHub)

1. Push this repo to GitHub.
2. Import the repo in Netlify.
3. In Netlify site settings, add environment variable:
   - `OPENROUTER_API_KEY=sk-or-v1-...`
4. Deploy.

This project includes:
- `netlify/functions/chat.js` (server-side proxy)
- `netlify.toml` redirect from `/api/chat` to the function

So the same frontend works on Netlify without exposing your API key.

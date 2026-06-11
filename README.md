# nomaebot NEW

A sassy, self-aware AI chat webapp powered by OpenRouter. ChatGPT-style UI with streaming responses, file uploads, conversation history, and a condescending but helpful bot.

## Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Next.js API routes + SQLite (better-sqlite3)
- **Auth**: bcrypt + httpOnly cookie sessions
- **LLM**: OpenRouter API (free models)

## Run locally

```bash
npm install
npm run build
node scripts/bootstrap.mjs   # set up .env with OpenRouter key
./scripts/start.sh            # http://localhost:3000
```

### Auto-launch on login (macOS)

```bash
cp scripts/com.ollama-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.ollama-web.plist
```

## Models

| Model | Vision | 
|-------|--------|
| nomaebot NEW (nex-agi/nex-n2-pro:free) | ✗ |
| Gemini 2.0 Flash (google/gemini-2.0-flash-exp:free) | ✓ |
| Llama 3.2 11B Vision (meta-llama/llama-3.2-11b-vision-instruct:free) | ✓ |
| Gemma 3 27B (google/gemma-3-27b-it:free) | ✗ |
| Mistral 7B (mistralai/mistral-7b-instruct:free) | ✗ |

## GitHub Pages

The frontend is deployed to GitHub Pages at \
`https://testyee-09.github.io/OllamaWEBNOMAE/`

**Note**: The API routes need a server. The Pages build is a static export of the UI only — login and chat require running the backend locally.

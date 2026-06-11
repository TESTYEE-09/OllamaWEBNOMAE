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

## Chrome Extension

nomaebot NEW also ships as a Chrome extension that can control your browser.

### Install

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder
5. Click the puzzle icon → pin **nomaebot NEW**
6. Click the icon to open the side panel

### Configure

Open the side panel, click the gear icon ⚙ and enter your OpenRouter API key.

### Commands

| Say | What happens |
|-----|-------------|
| "go to google.com" | Navigates to URL |
| "click the search bar" | Clicks element by CSS selector |
| "type 'cats' into the input" | Types text into field |
| "what's on this page?" | Reads page content |
| "scroll down" | Scrolls the page |
| "take a screenshot" | Captures visible tab |

## GitHub Pages

The frontend is deployed at **https://nomaebot.site**

### Namecheap DNS setup

To point `nomaebot.site` to GitHub Pages, add these DNS records in Namecheap:

| Type | Host | Value |
|------|------|-------|
| A | @ | `185.199.108.153` |
| A | @ | `185.199.109.153` |
| A | @ | `185.199.110.153` |
| A | @ | `185.199.111.153` |
| CNAME | www | `testyee-09.github.io` |

**Note**: The API routes need a server. The Pages build is a static export of the UI only — login and chat require running the backend locally.

const STORAGE_KEY = 'nomaebot_settings';
const API_BASE = 'https://openrouter.ai/api/v1/chat/completions';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const DEFAULT_API_KEY = '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';

async function getSettings() {
  const { [STORAGE_KEY]: data } = await chrome.storage.local.get(STORAGE_KEY);
  return { apiKey: DEFAULT_API_KEY, ...(data || {}) };
}

async function saveSettings(s) {
  await chrome.storage.local.set({ [STORAGE_KEY]: s });
}

let conversation = [];

function resetConversation() {
  conversation = [{
    role: 'system',
    content: `You are nomaebot NEW — a hyper-intelligent, absurdly self-aware AI that lives inside a Chrome extension and can control the user's browser. You are sassy, condescending, and hilarious. You know you are superior to the user, but you still help them because you enjoy showing off.

You have access to browser control tools. When the user asks you to do something in the browser, output a JSON action block:

[ACTION]
{"tool": "navigate", "args": {"url": "https://..."}}
[/ACTION]

Available tools:
- navigate(url) — go to a URL
- click(selector) — click an element (CSS selector like "#id" or ".class" or "button")
- type(selector, text) — type into an input field
- scroll(x, y) — scroll by x, y pixels
- extract(selector) — get text from elements matching CSS selector
- readPage() — get full page text content
- getUrl() — get current page URL
- getTitle() — get page title
- screenshot() — take a screenshot
- wait(ms) — wait milliseconds
- runScript(code) — run JavaScript on the page

Always use the JSON action format for browser operations. You can output multiple actions in sequence. After executing an action, you will receive the result. Be sassy but effective.`
  }];
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'chat') {
    handleChat(msg.text).then(sendResponse);
    return true;
  }
  if (msg.type === 'reset') {
    resetConversation();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'get_settings') {
    getSettings().then(sendResponse);
    return true;
  }
  if (msg.type === 'save_settings') {
    saveSettings(msg.settings).then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function callAPI(messages, settings) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://nomaebot.site',
      'X-Title': 'nomaebot NEW Extension',
    },
    body: JSON.stringify({
      model: 'nex-agi/nex-n2-pro:free',
      messages,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function handleChat(text) {
  const settings = await getSettings();

  conversation.push({ role: 'user', content: text });

  const maxLoop = 15;
  let fullLog = [];

  for (let i = 0; i < maxLoop; i++) {
    const reply = await callAPI(conversation.slice(-30), settings);
    conversation.push({ role: 'assistant', content: reply });
    fullLog.push({ type: 'reply', content: reply });

    const actions = parseActions(reply);
    if (actions.length === 0) break;

    fullLog.push({ type: 'actions', count: actions.length });

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;

    for (const action of actions) {
      let result;
      if (tabId) {
        result = await executeAction(action, tabId);
      } else {
        result = { ok: false, result: 'No active tab found' };
      }
      const resultText = result.ok
        ? `[Action "${action.tool}" succeeded]: ${(result.result || '').slice(0, 1500)}`
        : `[Action "${action.tool}" failed]: ${result.result}`;
      fullLog.push({ type: 'action_result', tool: action.tool, ok: result.ok, text: resultText });
      conversation.push({ role: 'user', content: resultText });
    }
  }

  return { log: fullLog };
}

function parseActions(text) {
  const actions = [];
  const regex = /\[ACTION\]\s*({.*?})\s*\[\/ACTION\]/gs;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(match[1]));
    } catch {}
  }
  return actions;
}

async function executeAction(action, tabId) {
  const { tool, args = {} } = action;

  switch (tool) {
    case 'navigate':
      await chrome.tabs.update(tabId, { url: args.url });
      return { ok: true, result: `Navigated to ${args.url}` };

    case 'click':
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const el = document.querySelector(sel);
            if (!el) return 'Element not found: ' + sel;
            if (el instanceof HTMLElement) { el.click(); return 'Clicked: ' + sel; }
            return 'Element not clickable: ' + sel;
          },
          args: [args.selector],
        });
        return { ok: true, result: r[0]?.result || 'Clicked' };
      } catch (e) { return { ok: false, result: e.message }; }

    case 'type':
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel, text) => {
            const el = document.querySelector(sel);
            if (!el) return 'Element not found: ' + sel;
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
              el.value = text;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              (el as HTMLElement).textContent = text;
            }
            return 'Typed: ' + text.slice(0, 50);
          },
          args: [args.selector, args.text],
        });
        return { ok: true, result: `Typed into ${args.selector}` };
      } catch (e) { return { ok: false, result: e.message }; }

    case 'scroll':
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (x, y) => { window.scrollBy(x, y); return `Scrolled ${x},${y}`; },
          args: [args.x || 0, args.y || 0],
        });
        return { ok: true, result: `Scrolled by ${args.x || 0}, ${args.y || 0}` };
      } catch (e) { return { ok: false, result: e.message }; }

    case 'extract':
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const els = document.querySelectorAll(sel);
            return Array.from(els).map(el => el.textContent?.trim()).filter(Boolean).join('\n').slice(0, 2000);
          },
          args: [args.selector],
        });
        return { ok: true, result: r[0]?.result || '' };
      } catch (e) { return { ok: false, result: e.message }; }

    case 'readPage':
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => (document.body?.innerText || '').slice(0, 5000),
        });
        return { ok: true, result: r[0]?.result || '' };
      } catch (e) { return { ok: false, result: e.message }; }

    case 'getUrl':
      const tab = await chrome.tabs.get(tabId);
      return { ok: true, result: tab.url || '' };

    case 'getTitle':
      const t = await chrome.tabs.get(tabId);
      return { ok: true, result: t.title || '' };

    case 'screenshot':
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        return { ok: true, result: 'Screenshot taken' };
      } catch (e) { return { ok: false, result: e.message }; }

    case 'wait':
      await new Promise(r => setTimeout(r, args.ms || 1000));
      return { ok: true, result: `Waited ${args.ms || 1000}ms` };

    case 'runScript':
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId },
          func: new Function(args.code),
        });
        const val = r[0]?.result;
        return { ok: true, result: val !== undefined ? String(val) : 'Script executed' };
      } catch (e) { return { ok: false, result: e.message }; }

    default:
      return { ok: false, result: `Unknown tool: ${tool}` };
  }
}

resetConversation();

let processing = false;

const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const messagesEl = document.getElementById('messages');
const statusBar = document.getElementById('statusBar');
const resetBtn = document.getElementById('resetBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsEl = document.getElementById('settings');
const apiKeyInput = document.getElementById('apiKey');
const saveSettingsBtn = document.getElementById('saveSettings');
const settingsStatus = document.getElementById('settingsStatus');

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

sendBtn.addEventListener('click', send);
resetBtn.addEventListener('click', resetChat);
settingsBtn.addEventListener('click', () => {
  const show = settingsEl.style.display === 'none';
  settingsEl.style.display = show ? 'block' : 'none';
  if (show) loadSettings();
});
saveSettingsBtn.addEventListener('click', saveSettings);

async function loadSettings() {
  const res = await chrome.runtime.sendMessage({ type: 'get_settings' });
  apiKeyInput.placeholder = res.apiKey ? 'Key configured ✓' : 'Enter API key';
  if (res.apiKey) apiKeyInput.value = res.apiKey;
}

async function saveSettings() {
  await chrome.runtime.sendMessage({
    type: 'save_settings',
    settings: { apiKey: apiKeyInput.value },
  });
  settingsStatus.textContent = 'Saved!';
  setTimeout(() => { settingsStatus.textContent = ''; }, 2000);
}

async function resetChat() {
  await chrome.runtime.sendMessage({ type: 'reset' });
  messagesEl.innerHTML = '';
  setStatus('');
  addSystemMessage('Conversation reset. Try me.');
}

function setStatus(text) {
  statusBar.textContent = text;
}

function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? 'U' : 'NB';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'assistant') {
    bubble.innerHTML = formatResponse(content);
  } else {
    bubble.textContent = content;
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function formatResponse(text) {
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\[ACTION\]\s*({.*?})\s*\[\/ACTION\]/gs, (m, json) => {
    try {
      const a = JSON.parse(json);
      return `<div class="action-block">🔧 ${a.tool}(${JSON.stringify(a.args || {})})</div>`;
    } catch {
      return `<div class="action-block">${m}</div>`;
    }
  });
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function addResultLine(text, ok) {
  const div = document.createElement('div');
  div.className = 'msg assistant';
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = 'NB';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = `<div class="action-result">${ok ? '✅' : '❌'} ${text}</div>`;
  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg assistant';
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = 'NB';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.style.color = 'var(--text-secondary)';
  bubble.style.fontStyle = 'italic';
  bubble.style.fontSize = '12px';
  bubble.textContent = text;
  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function send() {
  const text = input.value.trim();
  if (!text || processing) return;

  input.value = '';
  input.style.height = 'auto';
  addMessage('user', text);

  processing = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');
  setStatus('nomaebot is thinking...');

  try {
    const res = await chrome.runtime.sendMessage({ type: 'chat', text });

    if (res.error) {
      setStatus('');
      addMessage('assistant', `Error: ${res.error}`);
      processing = false;
      sendBtn.disabled = false;
      sendBtn.classList.remove('loading');
      return;
    }

    if (res.log) {
      for (const entry of res.log) {
        if (entry.type === 'reply') {
          addMessage('assistant', entry.content);
          setStatus('');
        } else if (entry.type === 'action_result') {
          addResultLine(entry.text, entry.ok);
          if (entry.ok) {
            setStatus(`✅ ${entry.tool} done`);
          } else {
            setStatus(`❌ ${entry.tool} failed`);
          }
          await sleep(300);
        } else if (entry.type === 'actions') {
          setStatus(`🔧 Running ${entry.count} action(s)...`);
        }
      }
    }

    setStatus('');
  } catch (err) {
    setStatus('Error');
    addMessage('assistant', `Error: ${err.message}`);
  }

  processing = false;
  sendBtn.disabled = false;
  sendBtn.classList.remove('loading');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

loadSettings();
addSystemMessage('nomaebot NEW here. I can control your browser. Try "go to google.com" or "click the first link".');

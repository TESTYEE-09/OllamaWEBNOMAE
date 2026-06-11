chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'highlight') {
    try {
      const el = document.querySelector(msg.selector);
      if (el && el instanceof HTMLElement) {
        el.style.outline = '3px solid #8b5cf6';
        el.style.outlineOffset = '2px';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }, 2000);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Element not found' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }
});

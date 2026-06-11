'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CanvasPanel from './CanvasPanel';

type ModelEntry = {
  id: string;
  label: string;
  tier: string;
  vision: boolean;
  supportsThink: boolean;
  description: string;
  contextWindow: number;
  badge?: string;
};

type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
};

type Conversation = {
  id: string;
  title: string;
  model_id: string;
  thinking: string;
  updated_at: number;
};

const THINKING_LEVELS = ['off', 'low', 'medium', 'high'] as const;

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState('minimax-m3');
  const [thinkingLevel, setThinkingLevel] = useState<string>('off');
  const [canvasHtml, setCanvasHtml] = useState<string | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showThinkingPicker, setShowThinkingPicker] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(setModels).catch(() => {});
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setConversations(data);
    } catch {
      router.push('/login');
    }
  }

  async function loadConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setCurrentConvId(id);
    setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content, thinking: m.thinking })));
    setSelectedModel(data.conversation.model_id);
    setThinkingLevel(data.conversation.thinking);
  }

  function newChat() {
    setCurrentConvId(null);
    setMessages([]);
    setCanvasHtml(null);
    setCanvasOpen(false);
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    setStreaming(true);
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const msgContent = input;
    setInput('');

    const abortController = new AbortController();
    abortRef.current = abortController;

    let assistantMsg = '';
    let thinkingAcc = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentConvId,
          message: { content: msgContent },
          model_id: selectedModel,
          thinking: thinkingLevel,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.error}` }]);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'content') {
              assistantMsg += parsed.delta;
              setMessages(prev => {
                const copy = [...prev];
                if (copy[copy.length - 1]?.role === 'assistant') {
                  copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistantMsg, thinking: thinkingAcc || undefined };
                } else {
                  copy.push({ role: 'assistant', content: assistantMsg, thinking: thinkingAcc || undefined });
                }
                return copy;
              });
              if (parsed.canvasHtml) {
                setCanvasHtml(parsed.canvasHtml as string);
                setCanvasOpen(true);
              }
            } else if (parsed.type === 'thinking') {
              thinkingAcc += parsed.delta;
            } else if (parsed.type === 'done') {
              if (parsed.conversation_id && parsed.conversation_id !== currentConvId) {
                setCurrentConvId(parsed.conversation_id);
                loadConversations();
              }
            } else if (parsed.type === 'error') {
              setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${parsed.error}` }]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      }
    }
    setStreaming(false);
    abortRef.current = null;
    loadConversations();
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) return;
    const data = await res.json();
    if (data.type === 'image') {
      setInput(prev => prev + `\n![${data.name}](${data.dataUrl})`);
    } else if (data.type === 'text') {
      setInput(prev => prev + '\n' + data.text);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (currentConvId === id) {
      newChat();
    }
    loadConversations();
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const selectedModelEntry = models.find(m => m.id === selectedModel);

  function getModelBadgeStyle(badge?: string) {
    if (badge === 'NEW') return { background: '#10b981', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 600 };
    if (badge === 'CLOUD') return { background: '#3b82f6', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 600 };
    return {};
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{ width: 260, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: 12 }}>
            <button
              onClick={newChat}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Chat
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: 4,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: currentConvId === conv.id ? 'var(--bg-tertiary)' : 'transparent',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--text-secondary)' }}>
                  {conv.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2, opacity: 0.5, fontSize: 14 }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <button onClick={handleLogout} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ height: 48, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, background: 'var(--bg-secondary)' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowModelPicker(!showModelPicker); setShowThinkingPicker(false); }}
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {selectedModelEntry?.label || selectedModel}
              {selectedModelEntry?.badge && <span style={getModelBadgeStyle(selectedModelEntry.badge)}>{selectedModelEntry.badge}</span>}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showModelPicker && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setShowModelPicker(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, width: 300, maxHeight: 400, overflow: 'auto', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {models.map(m => (
                    <div
                      key={m.id}
                      onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: selectedModel === m.id ? 'var(--bg-tertiary)' : 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</span>
                        {m.badge && <span style={getModelBadgeStyle(m.badge)}>{m.badge}</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{m.tier}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{m.description}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowThinkingPicker(!showThinkingPicker); setShowModelPicker(false); }}
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Think: {thinkingLevel}
            </button>
            {showThinkingPicker && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setShowThinkingPicker(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, width: 160, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {THINKING_LEVELS.map(level => (
                    <div
                      key={level}
                      onClick={() => { setThinkingLevel(level); setShowThinkingPicker(false); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: thinkingLevel === level ? 'var(--bg-tertiary)' : 'transparent', fontSize: 13 }}
                    >
                      {level}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
              <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Ollama Web</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>Select a model and start chatting</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 480, width: '100%' }}>
                {[
                  { title: 'Explain code', desc: 'Ask about any programming language' },
                  { title: 'Write a story', desc: 'Get creative writing assistance' },
                  { title: 'Analyze data', desc: 'Process and interpret information' },
                  { title: 'Brainstorm ideas', desc: 'Explore new concepts together' },
                ].map(s => (
                  <div
                    key={s.title}
                    onClick={() => setInput(`Help me ${s.title.toLowerCase()}`)}
                    style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-secondary)' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 768, margin: '0 auto', padding: '24px 16px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 600,
                      background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    }}>
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {msg.thinking && (
                        <details style={{ marginBottom: 8, fontSize: 13 }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', userSelect: 'none' }}>Thinking trace</summary>
                          <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{msg.thinking}</div>
                        </details>
                      )}
                      <div className="markdown" style={{ fontSize: 14, lineHeight: 1.6 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--bg-secondary)' }}>
          <div style={{ maxWidth: 768, margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-tertiary)', borderRadius: 12, border: '1px solid var(--border)', padding: '8px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: 6, flexShrink: 0 }}
                title="Upload file"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept="image/*,.pdf,.txt,.md"
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                rows={1}
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'none', maxHeight: 200, padding: '4px 0', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              {streaming ? (
                <button
                  onClick={stopStreaming}
                  style={{ background: 'var(--danger)', border: 'none', color: 'white', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', flexShrink: 0, fontSize: 13 }}
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  style={{ background: input.trim() ? 'var(--accent)' : 'var(--border)', border: 'none', color: 'white', borderRadius: 8, padding: '8px 12px', cursor: input.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas panel */}
      {canvasOpen && canvasHtml && (
        <CanvasPanel html={canvasHtml} onClose={() => setCanvasOpen(false)} />
      )}
    </div>
  );
}

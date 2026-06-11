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
  description: string;
  contextWindow: number;
  badge?: string;
};

type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  model_id: string;
  updated_at: number;
};

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState('nex-agi/nex-n2-pro:free');
  const [canvasHtml, setCanvasHtml] = useState<string | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  async function loadConversations() {
    try {
      const res = await fetch('/api/conversations');
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) setConversations(await res.json());
    } catch { /* API not available */ }
  }

  async function loadConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setCurrentConvId(id);
    setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
    setSelectedModel(data.conversation.model_id);
    setError(null);
  }

  function newChat() {
    setCurrentConvId(null);
    setMessages([]);
    setCanvasHtml(null);
    setCanvasOpen(false);
    setError(null);
    setUploadedImages([]);
  }

  const selectedModelEntry = models.find(m => m.id === selectedModel);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedModelEntry?.vision) {
      setError('This model does not support image input. Switch to Gemini 2.0 Flash or Llama 3.2 11B Vision.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) { setError('Upload failed'); return; }
    const data = await res.json();
    if (data.type === 'image') {
      setUploadedImages(prev => [...prev, data.dataUrl]);
    } else if (data.type === 'text') {
      setInput(prev => prev + '\n' + data.text);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(index: number) {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  }

  async function sendMessage() {
    if ((!input.trim() && !uploadedImages.length) || streaming) return;
    setStreaming(true);
    setError(null);
    const msgContent = input;
    const images = [...uploadedImages];
    const userMsg: Message = { role: 'user', content: msgContent || '(image uploaded)' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setUploadedImages([]);

    const abortController = new AbortController();
    abortRef.current = abortController;
    let assistantMsg = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentConvId,
          message: { content: msgContent, images },
          model_id: selectedModel,
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
                  copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistantMsg };
                } else {
                  copy.push({ role: 'assistant', content: assistantMsg });
                }
                return copy;
              });
              if (parsed.canvasHtml) {
                setCanvasHtml(parsed.canvasHtml as string);
                setCanvasOpen(true);
              }
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (currentConvId === id) newChat();
    loadConversations();
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const hasContent = input.trim() || uploadedImages.length > 0;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '8px 8px 4px' }}>
          <button
            onClick={newChat}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            New Chat
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              style={{
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: currentConvId === conv.id ? 'var(--bg-tertiary)' : 'transparent',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--text-secondary)' }}>
                {conv.title}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2, opacity: 0.4, fontSize: 12 }}
              >✕</button>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
            Log out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 48, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '0 16px', background: 'var(--bg-secondary)', position: 'relative',
        }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
                fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6,
              }}
            >
              <span style={{ fontWeight: 500 }}>{selectedModelEntry?.label || 'nomaebot NEW'}</span>
              {selectedModelEntry?.badge && (
                <span style={{
                  background: selectedModelEntry.badge === 'VISION' ? '#8b5cf6' : '#10b981',
                  color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 600,
                }}>{selectedModelEntry.badge}</span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showModelPicker && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setShowModelPicker(false)} />
                <div style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginTop: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 12, width: 320, maxHeight: 400, overflow: 'auto', zIndex: 50,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: 4,
                }}>
                  {models.map(m => (
                    <div
                      key={m.id}
                      onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); setError(null); }}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', borderRadius: 8,
                        background: selectedModel === m.id ? 'var(--bg-tertiary)' : 'transparent',
                        marginBottom: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</span>
                        {m.badge && (
                          <span style={{
                            background: m.badge === 'VISION' ? '#8b5cf6' : '#10b981',
                            color: 'white', fontSize: 10, padding: '1px 5px', borderRadius: 6, fontWeight: 600,
                          }}>{m.badge}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{m.description}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>nomaebot NEW</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>Choose a model and start a conversation</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 520, width: '100%' }}>
                {[
                  { t: 'Explain quantum computing', d: 'in simple terms' },
                  { t: 'Write a Python script', d: 'to sort a CSV file' },
                  { t: 'Summarize this article', d: 'paste a URL or text' },
                  { t: 'Help me brainstorm', d: 'creative project ideas' },
                ].map(s => (
                  <div
                    key={s.t}
                    onClick={() => setInput(s.t)}
                    style={{
                      padding: 14, borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{s.t}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 768, margin: '0 auto', padding: '16px 16px 24px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 6, flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
                    background: msg.role === 'user' ? 'var(--accent)' : '#10b981',
                    color: 'white',
                  }}>
                    {msg.role === 'user' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                    <div className="markdown" style={{ fontSize: 14, lineHeight: 1.6 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            margin: '0 auto', maxWidth: 768, width: '100%', padding: '0 16px',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{
              background: '#7f1d1d', border: '1px solid #dc2626', borderRadius: 10,
              padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
              <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          </div>
        )}

        {/* Composer */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '0 16px 16px', background: 'var(--bg-primary)' }}>
          <div style={{ maxWidth: 768, margin: '0 auto' }}>
            {/* Image previews */}
            {uploadedImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {uploadedImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'var(--bg-tertiary)', borderRadius: 14,
              border: '1px solid var(--border)', padding: '8px 8px 8px 4px',
            }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                  padding: '6px 8px', borderRadius: 8, flexShrink: 0,
                }}
                title="Attach image or file"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*,.pdf,.txt,.md" />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message nomaebot NEW"
                rows={1}
                style={{
                  flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
                  fontSize: 14, outline: 'none', resize: 'none', maxHeight: 200,
                  padding: '6px 4px', fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
              {streaming ? (
                <button
                  onClick={() => { abortRef.current?.abort(); setStreaming(false); }}
                  style={{
                    background: 'var(--danger)', border: 'none', color: 'white', borderRadius: 8,
                    padding: '8px 10px', cursor: 'pointer', flexShrink: 0, fontSize: 13,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!hasContent}
                  style={{
                    background: hasContent ? 'var(--accent)' : 'var(--border)', border: 'none',
                    color: 'white', borderRadius: 8, padding: '8px 10px',
                    cursor: hasContent ? 'pointer' : 'not-allowed', flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              )}
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
              nomaebot NEW can make mistakes. Switch to a vision model for image support.
            </p>
          </div>
        </div>
      </div>

      {canvasOpen && canvasHtml && (
        <CanvasPanel html={canvasHtml} onClose={() => setCanvasOpen(false)} />
      )}
    </div>
  );
}

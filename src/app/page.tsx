'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.replace('/chat');
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#171717', color: '#b4b4b4', fontFamily: 'sans-serif', gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h1 style={{ color: '#ececec', fontSize: 20, fontWeight: 600 }}>nomaebot NEW</h1>
      <p style={{ fontSize: 13 }}>Redirecting to chat...</p>
      <a href="/chat" style={{ color: '#8b5cf6', fontSize: 13, textDecoration: 'none' }}>Click here</a>
    </div>
  );
}

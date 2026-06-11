'use client';

import { useState } from 'react';

type Props = {
  html: string;
  onClose: () => void;
};

export default function CanvasPanel({ html, onClose }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [source, setSource] = useState(html);

  return (
    <div style={{ width: 400, borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Canvas</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setEditMode(!editMode)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: '4px 8px', borderRadius: 4 }}
          >
            {editMode ? 'Preview' : 'Edit'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: 4 }}>✕</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {editMode ? (
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: 'none', padding: 12, fontFamily: 'monospace', fontSize: 12, resize: 'none', outline: 'none' }}
          />
        ) : (
          <iframe
            srcDoc={source}
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
            title="Canvas preview"
          />
        )}
      </div>
    </div>
  );
}

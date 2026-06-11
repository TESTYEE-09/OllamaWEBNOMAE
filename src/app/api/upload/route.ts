import { NextRequest, NextResponse } from 'next/server';
import { currentUserId } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const type = file.type;

    if (type.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${type};base64,${base64}`;
      return NextResponse.json({ type: 'image', dataUrl, name: file.name });
    }

    if (type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const { createRequire } = await import('node:module');
      const req2 = createRequire(import.meta.url);
      const workerPath = req2.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      const fs = await import('fs');
      const workerSrc = 'data:application/javascript;base64,' + fs.readFileSync(workerPath).toString('base64');
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const pdf = await pdfjs.getDocument({ data: buffer.buffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return NextResponse.json({ type: 'text', text, name: file.name });
    }

    if (type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const text = buffer.toString('utf-8');
      return NextResponse.json({ type: 'text', text, name: file.name });
    }

    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

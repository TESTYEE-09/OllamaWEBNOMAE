import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'nomaebot NEW',
  description: 'Chat with nomaebot NEW',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

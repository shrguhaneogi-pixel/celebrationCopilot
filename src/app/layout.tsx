import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Celebration Copilot',
  description: 'Deterministic event planning powered by verified AI mutations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}

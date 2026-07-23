import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';

export const metadata: Metadata = {
  title: 'CampaignCell — Turkcell Kişiselleştirilmiş Kampanya ve Öneri Platformu',
  description: 'Turkcell CodeNight 2026 Final — AI Tabanlı Kişiselleştirilmiş Kampanya ve Öneri Platformu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="light">
      <body className="bg-slate-50 dark:bg-[#050810] text-slate-900 dark:text-slate-100 min-h-screen font-sans antialiased selection:bg-turkcell-yellow selection:text-turkcell-navy transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

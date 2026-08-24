import React from 'react';
import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { GlobalChatbot } from '@/components/global-chatbot';
import { LanguageProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { AnalysisProvider } from '@/lib/analysis-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'GeoLens — Conversational Earth Observation Intelligence',
  description: 'See Earth. Understand Better. Decide Smarter.',
  icons: {
    icon: '/geolens-logo.png',
    shortcut: '/geolens-logo.png',
    apple: '/geolens-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <AnalysisProvider>
              <AppShell>{children}</AppShell>
              <GlobalChatbot />
            </AnalysisProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

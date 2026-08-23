import React from 'react';
import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { LanguageProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme/theme-context';
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
            <AppShell>{children}</AppShell>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

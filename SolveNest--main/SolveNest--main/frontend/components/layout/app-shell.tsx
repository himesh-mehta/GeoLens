"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Home, Map, Columns, History, HelpCircle, Leaf, Globe, Upload, Satellite, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { LanguageSelector } from './language-selector';
import { useTranslation } from '@/lib/i18n';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const navigationItems = [
    { key: 'nav.home', name: t('nav.home'), href: '/', icon: Home },
    { key: 'nav.explorer', name: 'Map Explorer', href: '/explorer', icon: Globe },
    { key: 'nav.myAreas', name: t('nav.myAreas'), href: '/my-areas', icon: Map },
    { key: 'nav.compare', name: t('nav.compare'), href: '/compare', icon: Columns },
    { key: 'nav.imageAnalysis', name: 'Image Analysis', href: '/image-analysis', icon: Upload },
    { key: 'nav.history', name: t('nav.history'), href: '/history', icon: History },
    { key: 'nav.reports', name: 'Reports', href: '/reports', icon: FileText },
    { key: 'nav.help', name: t('nav.help'), href: '/help', icon: HelpCircle },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const getPageTitle = () => {
    const activeItem = navigationItems.find(item => isActive(item.href));
    return activeItem ? activeItem.name : 'SolveNest';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-brand-neutral-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 border-r border-brand-neutral-200 bg-white">
        {/* App Title / Logo */}
        <div className="flex items-center gap-2 h-16 px-6 border-b border-brand-neutral-200 bg-white">
          <Leaf className="h-5 w-5 text-brand-green-700" />
          <div>
            <h1 className="text-base font-bold text-brand-neutral-900 leading-none">SolveNest</h1>
            <span className="text-[9px] text-brand-neutral-700 tracking-wider uppercase font-semibold">Earth Observation</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-brand-md text-sm font-medium transition-colors",
                  {
                    "bg-brand-green-50 text-brand-green-800": active,
                    "text-brand-neutral-900 hover:bg-brand-neutral-100": !active,
                  }
                )}
              >
                <Icon className={clsx("h-5 w-5", { "text-brand-green-700": active, "text-brand-neutral-700": !active })} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Language selector above footer */}
        <div className="px-6 py-4 border-t border-brand-neutral-200 bg-white">
          <LanguageSelector />
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-brand-neutral-200 bg-white text-center">
          <p className="text-xs text-brand-neutral-700">SIH25170 Foundation v1.0</p>
        </div>
      </aside>

      {/* Mobile Drawer (Overlay and Menu) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-brand-neutral-900/40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer Menu */}
          <div className="relative flex flex-col w-72 max-w-xs bg-white border-r border-brand-neutral-200">
            {/* Header of Drawer */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-brand-neutral-200">
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-brand-green-700" />
                <span className="text-base font-bold text-brand-neutral-900">SolveNest</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-brand-md border border-brand-neutral-200 hover:bg-brand-neutral-100 text-brand-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Drawer Links */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {navigationItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-brand-md text-sm font-medium transition-colors",
                      {
                        "bg-brand-green-50 text-brand-green-800": active,
                        "text-brand-neutral-900 hover:bg-brand-neutral-100": !active,
                      }
                    )}
                  >
                    <Icon className={clsx("h-5 w-5", { "text-brand-green-700": active, "text-brand-neutral-700": !active })} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            {/* Mobile Drawer Language selector */}
            <div className="px-6 py-4 border-t border-brand-neutral-200">
              <LanguageSelector />
            </div>
            {/* Drawer Footer */}
            <div className="p-4 border-t border-brand-neutral-200 text-center">
              <p className="text-xs text-brand-neutral-700">SIH25170 Foundation v1.0</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header / Top bar */}
        <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-brand-neutral-200 bg-white">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-brand-md border border-brand-neutral-200 hover:bg-brand-neutral-100 text-brand-neutral-700 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-base md:text-lg font-semibold text-brand-neutral-900">{getPageTitle()}</h2>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
};

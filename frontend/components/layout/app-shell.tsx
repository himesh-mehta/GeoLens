"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Home, Map, Columns, History, HelpCircle, Globe, Upload, FileText, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import { LanguageSelector } from './language-selector';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/theme-context';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const isLight = theme === 'light';

  // Persist desktop sidebar collapsed state in localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('geolens_sidebar_collapsed');
      if (stored === 'true') {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('geolens_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  const navigationItems = [
    { key: 'nav.home', name: t('nav.home'), href: '/', icon: Home },
    { key: 'nav.explorer', name: 'Map Explorer', href: '/explorer', icon: Globe },
    { key: 'nav.myAreas', name: t('nav.myAreas'), href: '/my-areas', icon: Map },
    { key: 'nav.compare', name: t('nav.compare'), href: '/compare', icon: Columns },
    { key: 'nav.imageAnalysis', name: 'Image Analysis', href: '/image-analysis', icon: Upload },
    { key: 'nav.shapefileAnalysis', name: 'Shapefile Analysis', href: '/shapefile-analysis', icon: Map },
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
    return activeItem ? activeItem.name : 'GeoLens';
  };

  return (
    <div className={clsx("flex h-screen overflow-hidden transition-colors duration-200", isLight ? "bg-[#FAFAF7]" : "bg-[#0F172A]")}>
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          "hidden md:flex md:flex-col relative z-[999] transition-all duration-300 ease-in-out flex-shrink-0 border-r",
          isLight ? "bg-[#FFFFFF] border-[#E5E7DE]" : "bg-[#0B1120] border-[#1E293B]",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* App Title / Logo & Collapse Toggle */}
        <div className={clsx(
          "flex items-center h-20 transition-all duration-300 border-b",
          isLight ? "bg-[#FFFFFF] border-[#E5E7DE]" : "bg-[#0B1120] border-[#1E293B]",
          isSidebarCollapsed ? "justify-center px-2" : "justify-between px-5"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/geolens-logo.svg" alt="GeoLens Logo" className="h-10 w-10 object-contain rounded-full border border-[#4C7A3D]/30 shadow-xs flex-shrink-0" />
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className={clsx("text-xl font-extrabold leading-none tracking-tight truncate", isLight ? "text-[#2D3B27]" : "text-[#F1F5F9]")}>GeoLens</h1>
                <span className={clsx("text-[9px] tracking-wider uppercase font-semibold mt-1 block truncate", isLight ? "text-[#6B7568]" : "text-[#94A3B8]")}>Earth Intelligence</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={clsx(
              "hidden md:flex p-1.5 rounded-lg border transition-colors cursor-pointer flex-shrink-0",
              isLight ? "border-[#E5E7DE] hover:bg-[#F0F2EB] text-[#6B7568] hover:text-[#2D3B27]" : "border-[#1E293B] hover:bg-[#131B2E] text-[#94A3B8] hover:text-[#F1F5F9]"
            )}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2.5 py-5 space-y-1.5 overflow-y-auto">
          {navigationItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                title={isSidebarCollapsed ? item.name : undefined}
                className={clsx(
                  "flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7A3D]",
                  isSidebarCollapsed ? "justify-center px-0" : "px-3.5",
                  active
                    ? isLight
                      ? "bg-[#4C7A3D] text-white shadow-sm font-semibold"
                      : "bg-[#14B8A6] text-white shadow-sm font-semibold"
                    : isLight
                      ? "text-[#6B7568] hover:bg-[#F0F2EB] hover:text-[#2D3B27]"
                      : "text-[#94A3B8] hover:bg-[#131B2E] hover:text-[#F1F5F9]"
                )}
              >
                <Icon className={clsx("h-5 w-5 flex-shrink-0", active ? "text-white" : isLight ? "text-[#6B7568]" : "text-[#94A3B8]")} />
                {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Language selector & footer info — when open */}
        {!isSidebarCollapsed && (
          <>
            <div className={clsx("px-4 py-3 border-t", isLight ? "bg-[#FFFFFF] border-[#E5E7DE]" : "bg-[#0B1120] border-[#1E293B]")}>
              <LanguageSelector />
            </div>

            {/* Earth Observation Info Card */}
            <div className="px-3.5 pb-4 pt-1">
              <div className={clsx(
                "p-4 rounded-2xl border text-center flex flex-col items-center justify-center transition-colors shadow-2xs",
                isLight
                  ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#1E293B]"
                  : "bg-[#131B2E] border-[#1E293B] text-[#F1F5F9]"
              )}>
                {/* Centered GeoLens Logo (44px height) */}
                <div className="mb-2.5 flex items-center justify-center">
                  <img
                    src="/geolens-logo.svg"
                    alt="GeoLens Logo"
                    className="h-11 w-11 object-contain rounded-full border border-[#4C7A3D]/30 shadow-xs"
                  />
                </div>
                <h4 className="text-sm font-extrabold leading-snug mb-1.5 px-1">
                  {t('sidebarCard.heading')}
                </h4>
                <p className={clsx("text-xs leading-normal font-medium px-1", isLight ? "text-[#64748B]" : "text-[#94A3B8]")}>
                  {t('sidebarCard.subtext')}
                </p>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <div className={clsx("relative flex flex-col w-72 max-w-xs border-r", isLight ? "bg-[#FFFFFF] border-[#E5E7DE]" : "bg-[#0B1120] border-[#1E293B]")}>
            <div className={clsx("flex items-center justify-between h-20 px-5 border-b", isLight ? "border-[#E5E7DE]" : "border-[#1E293B]")}>
              <div className="flex items-center gap-3">
                <img src="/geolens-logo.svg" alt="GeoLens Logo" className="h-10 w-10 object-contain rounded-full border border-teal-500/30 shadow-xs" />
                <span className={clsx("text-xl font-extrabold", isLight ? "text-[#2D3B27]" : "text-[#F1F5F9]")}>GeoLens</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-lg border border-[#E5E7DE] text-[#6B7568]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
              {navigationItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? isLight ? "bg-[#4C7A3D] text-white font-semibold" : "bg-[#14B8A6] text-white font-semibold"
                        : isLight ? "text-[#6B7568] hover:bg-[#F0F2EB] hover:text-[#2D3B27]" : "text-[#94A3B8] hover:bg-[#131B2E] hover:text-[#F1F5F9]"
                    )}
                  >
                    <Icon className={clsx("h-5 w-5", active ? "text-white" : isLight ? "text-[#6B7568]" : "text-[#94A3B8]")} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className={clsx("px-5 py-4 border-t", isLight ? "border-[#E5E7DE]" : "border-[#1E293B]")}>
              <LanguageSelector />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={clsx("flex-1 flex flex-col overflow-hidden transition-colors duration-200", isLight ? "bg-[#FAFAF7]" : "bg-[#0F172A]")}>
        {/* Header / Top bar */}
        <header className={clsx(
          "flex items-center justify-between h-16 px-4 md:px-6 border-b transition-colors duration-200",
          isLight ? "bg-[#FFFFFF] border-[#E5E7DE]" : "bg-[#131B2E] border-[#1E293B]"
        )}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={clsx("p-1.5 rounded-lg border md:hidden", isLight ? "border-[#E5E7DE] bg-[#F5F5F0] text-[#2D3B27]" : "border-[#334155] bg-[#0F172A] text-[#94A3B8]")}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className={clsx("text-base md:text-lg font-bold", isLight ? "text-[#2D3B27]" : "text-[#F1F5F9]")}>{getPageTitle()}</h2>
          </div>

          {/* Theme Toggle Button (Light/Dark) */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={isLight ? "Switch to Dark Navy Theme" : "Switch to Agriculture Earth Light Theme"}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs",
                isLight
                  ? "bg-[#F0F2EB] hover:bg-[#E5E7DE] border-[#D8DCCF] text-[#4C7A3D]"
                  : "bg-[#0F172A] hover:bg-[#1E293B] border-[#334155] text-[#14B8A6]"
              )}
            >
              {isLight ? (
                <>
                  <Sun className="h-4 w-4 text-[#4C7A3D]" />
                  <span>Earth Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-[#14B8A6]" />
                  <span>Navy Dark</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className={clsx("flex-1 focus:outline-none", pathname === '/explorer' ? 'overflow-hidden p-0 flex flex-col' : 'overflow-y-auto p-4 md:p-6')}>
          {children}
        </main>
      </div>
    </div>
  );
};

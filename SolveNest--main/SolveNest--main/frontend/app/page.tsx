"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin, Map, Upload, ArrowRight, BarChart2, GitCompare,
  Globe, Cpu, Layers, Bot, Sparkles, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { areasService, HistoryItem } from '@/services/areas-service';
import { useTheme } from '@/lib/theme/theme-context';
import { useTranslation } from '@/lib/i18n';

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const items = areasService.getHistory().slice(0, 3);
      setRecentHistory(items);
    } catch {
      setRecentHistory([]);
    }
  }, []);

  const features = [
    {
      icon: <Layers className="h-6 w-6" />,
      title: t('home.feat1Title') || 'Land Cover Classification',
      desc: t('home.feat1Desc') || 'Identify vegetation, water, built-up areas, agriculture, and barren land with AI-powered analysis.',
      color: isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50',
    },
    {
      icon: <GitCompare className="h-6 w-6" />,
      title: t('home.feat2Title') || 'Multi-Temporal Comparison',
      desc: t('home.feat2Desc') || 'Compare any two time periods to detect changes in land use and vegetation health.',
      color: isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-950/30 text-blue-400 border-blue-900/50',
    },
    {
      icon: <Bot className="h-6 w-6" />,
      title: t('home.feat3Title') || 'AI-Powered Insights',
      desc: t('home.feat3Desc') || 'Ask questions in plain language and get scientific explanations from our GPT-OSS assistant.',
      color: isLight ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-teal-950/30 text-teal-400 border-teal-900/50',
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: t('home.feat4Title') || 'Multilingual Support',
      desc: t('home.feat4Desc') || 'Available in English, Hindi, and Marathi, making Earth observation accessible to everyone.',
      color: isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-950/30 text-purple-400 border-purple-900/50',
    },
  ];

  return (
<<<<<<< Updated upstream
    <div className={`w-full max-w-7xl mx-auto space-y-10 py-6 px-4 md:px-6 transition-colors duration-200 ${
      isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'
    }`}>
      {/* ── HERO SECTION ── */}
      <section className="text-center space-y-5 pt-2">
        <h1 className={`text-4xl md:text-5xl font-black tracking-tight ${
          isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'
        }`}>
          Analyze Anywhere in India
        </h1>
        <p className={`text-base md:text-lg max-w-3xl mx-auto leading-relaxed ${
          isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'
        }`}>
          Perform dynamic location-based land-cover inference using Google Earth Engine and Sentinel-2 multispectral imagery.
        </p>

        {/* Live Status Indicators */}
        <div className="flex flex-wrap justify-center gap-2.5 pt-2">
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
            isLight ? 'text-[#4C7A3D] bg-[#4C7A3D]/10 border-[#4C7A3D]/30' : 'text-[#14B8A6] bg-[#14B8A6]/10 border-[#14B8A6]/30'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isLight ? 'bg-[#4C7A3D]' : 'bg-[#14B8A6]'}`} />
            GEE Connected
          </span>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
            isLight ? 'text-[#4C7A3D] bg-[#4C7A3D]/10 border-[#4C7A3D]/30' : 'text-[#14B8A6] bg-[#14B8A6]/10 border-[#14B8A6]/30'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isLight ? 'bg-[#4C7A3D]' : 'bg-[#14B8A6]'}`} />
            Sentinel-2 Available
          </span>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
            isLight ? 'text-[#4C7A3D] bg-[#4C7A3D]/10 border-[#4C7A3D]/30' : 'text-[#14B8A6] bg-[#14B8A6]/10 border-[#14B8A6]/30'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isLight ? 'bg-[#4C7A3D]' : 'bg-[#14B8A6]'}`} />
            ML Model Ready
          </span>
        </div>

        <div className="pt-1">
=======
    <div className="max-w-6xl mx-auto space-y-12 py-8 md:py-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 pt-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#0f172a]">
          Explore your area
        </h1>
        <p className="text-lg text-[#334155] max-w-2xl mx-auto leading-relaxed">
          Understand what is changing around you using satellite imagery.
        </p>
        <p className="text-sm text-[#64748b]">
          No technical knowledge required.
        </p>
        <div className="pt-2">
>>>>>>> Stashed changes
          <Link href="/explorer">
            <Button variant="link" className={`font-bold text-sm ${
              isLight ? 'text-[#4C7A3D] hover:text-[#3D6330]' : 'text-[#14B8A6] hover:text-teal-300'
            }`}>
              Open Map Explorer <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── TRUST / STATS BAR ── */}
      <section className={`p-4 rounded-2xl border transition-colors shadow-2xs ${
        isLight ? 'bg-[#FAFAF7] border-[#E5E7DE]' : 'bg-[#0F172A] border-[#1E293B]'
      }`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center divide-x-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="p-2 space-y-1">
            <span className="text-xl font-extrabold text-[#4C7A3D] dark:text-[#14B8A6] flex items-center justify-center gap-1.5">
              <Sparkles className="h-5 w-5" /> 26
            </span>
            <p className={`text-xs font-medium ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              {t('home.statsIndices') || '26 Spectral Indices'}
            </p>
          </div>

          <div className="p-2 space-y-1">
            <span className="text-xl font-extrabold text-[#4C7A3D] dark:text-[#14B8A6] flex items-center justify-center gap-1.5">
              <Layers className="h-5 w-5" /> Sentinel-2
            </span>
            <p className={`text-xs font-medium ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              {t('home.statsSatellite') || 'Sentinel-2 Satellite Data'}
            </p>
          </div>

          <div className="p-2 space-y-1">
            <span className="text-xl font-extrabold text-[#4C7A3D] dark:text-[#14B8A6] flex items-center justify-center gap-1.5">
              <Cpu className="h-5 w-5" /> GEE
            </span>
            <p className={`text-xs font-medium ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              {t('home.statsEngine') || 'Powered by Google Earth Engine'}
            </p>
          </div>

          <div className="p-2 space-y-1">
            <span className="text-xl font-extrabold text-[#4C7A3D] dark:text-[#14B8A6] flex items-center justify-center gap-1.5">
              <Globe className="h-5 w-5" /> 3 Languages
            </span>
            <p className={`text-xs font-medium ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
              {t('home.statsLanguages') || '3 Languages Supported'}
            </p>
          </div>
        </div>
      </section>

      {/* ── ACTION CARDS ── */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
<<<<<<< Updated upstream
          {/* Card 1: Analyze Location */}
          <Link href="/explorer" className="block group cursor-pointer">
            <Card className={`transition-all duration-300 h-full shadow-2xs overflow-hidden border rounded-2xl ${
              isLight
                ? 'bg-white border-[#E5E7DE] hover:border-[#4C7A3D] hover:shadow-lg'
                : 'bg-[#0F172A] border-[#1E293B] hover:border-[#14B8A6] hover:shadow-lg'
            }`}>
              <div className="relative h-44 w-full overflow-hidden border-b border-slate-200 dark:border-slate-800">
                <img
                  src="/card-select-area.jpg"
                  alt="Analyze Location"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 bg-[#4C7A3D] dark:bg-[#14B8A6] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Point Inference
                </span>
              </div>
              <CardContent className="p-5 space-y-2">
                <CardTitle className={`text-base font-extrabold flex items-center justify-between ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
                  <span>{t('home.selectAreaTitle') || 'Analyze Location'}</span>
                  <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${
                    isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
                  }`} />
                </CardTitle>
                <CardDescription className={`text-xs leading-relaxed ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                  {t('home.selectAreaDesc') || 'Enter coordinates or click on the interactive map to compute Sentinel-2 predictions.'}
=======
          <Link href="/explorer" className="block cursor-pointer">
            <Card className="hover:shadow-lg transition-shadow border-[#e2e8f0] h-full">
              <CardHeader className="space-y-2 text-center h-full flex flex-col justify-center items-center py-10">
                <div className="w-16 h-16 rounded-full bg-[#ecfdf5] flex items-center justify-center mb-2">
                  <MapPin className="h-8 w-8 text-[#10b981]" />
                </div>
                <CardTitle className="text-xl">📍 Choose a location</CardTitle>
                <CardDescription className="text-base">
                  Enter coordinates or click the map
>>>>>>> Stashed changes
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          {/* Card 2: Explore & Draw */}
          <Link href="/explorer" className="block group cursor-pointer">
            <Card className={`transition-all duration-300 h-full shadow-2xs overflow-hidden border rounded-2xl ${
              isLight
                ? 'bg-white border-[#E5E7DE] hover:border-[#4C7A3D] hover:shadow-lg'
                : 'bg-[#0F172A] border-[#1E293B] hover:border-[#14B8A6] hover:shadow-lg'
            }`}>
              <div className="relative h-44 w-full overflow-hidden border-b border-slate-200 dark:border-slate-800">
                <img
                  src="/card-explore-draw.jpg"
                  alt="Explore & Draw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 bg-[#4C7A3D] dark:bg-[#14B8A6] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Map className="h-3 w-3" /> Polygon AOI
                </span>
              </div>
              <CardContent className="p-5 space-y-2">
                <CardTitle className={`text-base font-extrabold flex items-center justify-between ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
                  <span>Explore & Draw</span>
                  <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${
                    isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
                  }`} />
                </CardTitle>
                <CardDescription className={`text-xs leading-relaxed ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                  Draw a custom polygon boundary over farms, rivers, or towns to evaluate aggregated statistics.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          {/* Card 3: Upload Imagery */}
          <Link href="/image-analysis" className="block group cursor-pointer">
            <Card className={`transition-all duration-300 h-full shadow-2xs overflow-hidden border rounded-2xl ${
              isLight
                ? 'bg-white border-[#E5E7DE] hover:border-[#4C7A3D] hover:shadow-lg'
                : 'bg-[#0F172A] border-[#1E293B] hover:border-[#14B8A6] hover:shadow-lg'
            }`}>
              <div className="relative h-44 w-full overflow-hidden border-b border-slate-200 dark:border-slate-800">
                <img
                  src="/card-upload-imagery.jpg"
                  alt="Upload Imagery"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 bg-[#4C7A3D] dark:bg-[#14B8A6] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Upload className="h-3 w-3" /> GeoTIFF & Imagery
                </span>
              </div>
              <CardContent className="p-5 space-y-2">
                <CardTitle className={`text-base font-extrabold flex items-center justify-between ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
                  <span>{t('home.uploadTitle') || 'Upload Imagery'}</span>
                  <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${
                    isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
                  }`} />
                </CardTitle>
                <CardDescription className={`text-xs leading-relaxed ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                  {t('home.uploadDesc') || 'Upload Sentinel-2 GeoTIFF band files (B02, B03, B04, B08) or custom RGB images.'}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

        </div>
      </section>

      {/* ── RECENT ACTIVITY ── */}
      {recentHistory.length > 0 && (
        <section className={`space-y-4 pt-4 border-t ${isLight ? 'border-[#E5E7DE]' : 'border-[#1E293B]'}`}>
          <div className="flex items-center justify-between">
            <h4 className={`text-lg font-extrabold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
              {t('home.recentActivity') || 'Recent Activity'}
            </h4>
            <Button
              variant="link"
              onClick={() => router.push('/history')}
              className={`text-xs font-bold ${isLight ? 'text-[#4C7A3D] hover:text-[#3D6330]' : 'text-[#14B8A6] hover:text-teal-300'}`}
            >
              {t('home.viewAllHistory') || 'View all'} <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>

          <Card className={`border rounded-2xl ${isLight ? 'bg-white border-[#E5E7DE]' : 'bg-[#0F172A] border-[#1E293B]'}`}>
            <CardContent className="p-0">
              <ul className={`divide-y ${isLight ? 'divide-[#E5E7DE]' : 'divide-[#1E293B]'}`}>
                {recentHistory.map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        if (item.type === 'analysis') {
                          router.push(`/viewer?area=${item.areaId}`);
                        } else {
                          router.push(`/compare?area=${item.areaId}`);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors group cursor-pointer ${
                        isLight ? 'hover:bg-[#FAFAF7]' : 'hover:bg-[#131B2E]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={
                          item.type === 'analysis'
                            ? isLight ? 'p-2 bg-[#4C7A3D]/10 text-[#4C7A3D] rounded-xl border border-[#4C7A3D]/30' : 'p-2 bg-[#14B8A6]/10 text-[#14B8A6] rounded-xl border border-[#14B8A6]/30'
                            : isLight ? 'p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-200' : 'p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/30'
                        }>
                          {item.type === 'analysis' ? <BarChart2 className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
                        </div>
                        <div>
                          <span className={`text-sm font-bold block ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
                            {item.areaName}
                          </span>
                          <span className={`text-xs ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                            {item.type === 'analysis' ? 'Analysis' : 'Comparison'}
                            {item.date ? ` · ${item.date}` : ''}
                            {item.beforeDate && item.afterDate ? ` · ${item.beforeDate} → ${item.afterDate}` : ''}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className={`h-4 w-4 transition-colors ${
                        isLight ? 'text-[#6B7568] group-hover:text-[#4C7A3D]' : 'text-[#64748B] group-hover:text-[#14B8A6]'
                      }`} />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── WHAT GEOLENS CAN DO FEATURE GRID ── */}
      <section className={`space-y-4 pt-6 border-t ${isLight ? 'border-[#E5E7DE]' : 'border-[#1E293B]'}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-5 w-5 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
          <h3 className={`text-lg font-extrabold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
            {t('home.featureGridHeading') || 'What GeoLens Can Do'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all space-y-3 shadow-2xs ${
                isLight
                  ? 'bg-white border-[#E5E7DE] hover:border-[#4C7A3D]/50'
                  : 'bg-[#0F172A] border-[#1E293B] hover:border-[#14B8A6]/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${feat.color}`}>
                {feat.icon}
              </div>
              <h4 className={`text-sm font-extrabold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
                {feat.title}
              </h4>
              <p className={`text-xs leading-relaxed ${isLight ? 'text-[#6B7568]' : 'text-slate-400'}`}>
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Map, Upload, ArrowRight, BarChart2, GitCompare, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { areasService, HistoryItem } from '@/services/areas-service';

export default function HomePage() {
  const router = useRouter();
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const items = areasService.getHistory().slice(0, 3);
      setRecentHistory(items);
    } catch {
      setRecentHistory([]);
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8 md:py-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 pt-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0f172a]">
          Analyze Anywhere in India
        </h1>
        <p className="text-lg md:text-xl text-[#334155] max-w-3xl mx-auto leading-relaxed">
          Perform dynamic location-based land-cover inference using Google Earth Engine and Sentinel-2 imagery.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {/* Status Indicators */}
          <div className="w-full flex items-center justify-center gap-4 mb-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-brand-green-700 bg-brand-green-50 px-3 py-1 rounded-full border border-brand-green-200">
              <span className="w-2 h-2 rounded-full bg-brand-green-500 animate-pulse" />
              GEE Connected
            </span>
            <span className="flex items-center gap-1.5 text-brand-green-700 bg-brand-green-50 px-3 py-1 rounded-full border border-brand-green-200">
              <span className="w-2 h-2 rounded-full bg-brand-green-500 animate-pulse" />
              Sentinel-2 Available
            </span>
            <span className="flex items-center gap-1.5 text-brand-green-700 bg-brand-green-50 px-3 py-1 rounded-full border border-brand-green-200">
              <span className="w-2 h-2 rounded-full bg-brand-green-500 animate-pulse" />
              ML Model Ready
            </span>
          </div>
        </div>
        
        <div className="pt-2">
          <Link href="/explorer">
            <Button variant="link" className="text-[#0f172a] hover:text-[#3b82f6]">
              Open Map Explorer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Action Cards */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <Link href="/explorer" className="block cursor-pointer">
            <Card className="hover:shadow-lg transition-shadow border-[#e2e8f0] h-full">
              <CardHeader className="space-y-2 text-center h-full flex flex-col justify-center items-center py-10">
                <div className="w-16 h-16 rounded-full bg-[#ecfdf5] flex items-center justify-center mb-2">
                  <MapPin className="h-8 w-8 text-[#10b981]" />
                </div>
                <CardTitle className="text-xl">📍 Analyze Location</CardTitle>
                <CardDescription className="text-base">
                  Enter coordinates or click map
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/explorer" className="block cursor-pointer">
            <Card className="hover:shadow-lg transition-shadow border-[#e2e8f0] h-full">
              <CardHeader className="space-y-2 text-center h-full flex flex-col justify-center items-center py-10">
                <div className="w-16 h-16 rounded-full bg-[#eff6ff] flex items-center justify-center mb-2">
                  <Map className="h-8 w-8 text-[#3b82f6]" />
                </div>
                <CardTitle className="text-xl">🗺 Explore & Draw</CardTitle>
                <CardDescription className="text-base">
                  Select a polygon and analyze an area
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/image-analysis" className="block cursor-pointer">
            <Card className="hover:shadow-lg transition-shadow border-[#e2e8f0] h-full">
              <CardHeader className="space-y-2 text-center h-full flex flex-col justify-center items-center py-10">
                <div className="w-16 h-16 rounded-full bg-[#fef2f2] flex items-center justify-center mb-2">
                  <Upload className="h-8 w-8 text-[#ef4444]" />
                </div>
                <CardTitle className="text-xl">🛰 Upload Imagery</CardTitle>
                <CardDescription className="text-base">
                  Upload compatible satellite imagery
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

        </div>
      </section>

      {/* Recent Activity */}
      {recentHistory.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-bold text-[#0f172a]">
              Recent Activity
            </h4>
            <Button
              variant="link"
              onClick={() => router.push('/history')}
              className="text-[#3b82f6]"
            >
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <Card className="border-[#e2e8f0]">
            <CardContent className="p-0">
              <ul className="divide-y divide-[#e2e8f0]">
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
                      className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-[#f8fafc] transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={
                          item.type === 'analysis'
                            ? 'p-2 bg-[#eff6ff] text-[#3b82f6] rounded-full'
                            : 'p-2 bg-[#fdf4ff] text-[#d946ef] rounded-full'
                        }>
                          {item.type === 'analysis' ? <BarChart2 className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
                        </div>
                        <div>
                          <span className="text-base font-semibold text-[#0f172a] block">
                            {item.areaName}
                          </span>
                          <span className="text-sm text-[#64748b]">
                            {item.type === 'analysis' ? 'Analysis' : 'Comparison'}
                            {item.date ? ` · ${item.date}` : ''}
                            {item.beforeDate && item.afterDate ? ` · ${item.beforeDate} → ${item.afterDate}` : ''}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-[#cbd5e1] group-hover:text-[#3b82f6] transition-colors" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

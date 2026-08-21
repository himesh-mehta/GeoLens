"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { Download, FileText, Calendar, Filter, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { areasService, SavedArea } from '@/services/areas-service';

function ReportsContent() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reports, setReports] = useState<SavedArea[]>([]);

  const loadReports = () => {
    let saved = areasService.getSavedAreas();
    
    // Filter if area ID is in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const areaId = params.get('area');
      if (areaId) {
        saved = saved.filter(s => s.id === areaId);
      }
    }
    
    setReports(saved);
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDownload = (area: SavedArea, format: 'pdf' | 'csv') => {
    const id = `${area.id}-${format}`;
    setDownloadingId(id);
    
    setTimeout(() => {
      let content = "";
      let filename = "";
      let mimeType = "";
      
      const analysis = area.latestAnalysis;
      const ndvi = analysis?.ndvi ?? 'N/A';
      const ndwi = analysis?.ndwi ?? 'N/A';
      const ndbi = analysis?.ndbi ?? 'N/A';
      const pred = analysis?.predClass ?? 'Unknown';
      const conf = analysis?.confidence ?? 'N/A';
      const verif = analysis?.verification ?? 'Unknown';
      const date = new Date(area.lastAnalyzedDate || area.createdAt).toLocaleDateString();

      if (format === 'csv') {
        content = `Region,Latitude,Longitude,LandCover,Confidence,Verification,NDVI,NDWI,NDBI,AnalysisDate
`;
        content += `"${area.name}",${area.latitude},${area.longitude},"${pred}",${conf},"${verif}",${ndvi},${ndwi},${ndbi},${date}
`;
        filename = `${area.name.replace(/[^a-zA-Z0-9]/g, '_')}_Data.csv`;
        mimeType = "text/csv;charset=utf-8;";
      } else {
        content = `SOLVENEST EARTH OBSERVATION REPORT\n`;
        content += `=================================\n\n`;
        content += `Location Name: ${area.name}\n`;
        content += `Coordinates: ${area.latitude.toFixed(5)}, ${area.longitude.toFixed(5)}\n`;
        content += `Analysis Date: ${date}\n\n`;
        
        content += `ANALYSIS RESULTS\n`;
        content += `---------------------------------------------------\n`;
        content += `Land Cover Classification: ${pred}\n`;
        content += `Prediction Confidence: ${typeof conf === 'number' ? (conf * 100).toFixed(1) + '%' : conf}\n`;
        content += `Verification Status: ${verif}\n\n`;
        
        content += `SPECTRAL INDICES\n`;
        content += `---------------------------------------------------\n`;
        content += `NDVI (Normalized Difference Vegetation Index): ${ndvi}\n`;
        content += `NDWI (Normalized Difference Water Index): ${ndwi}\n`;
        content += `NDBI (Normalized Difference Built-up Index): ${ndbi}\n\n`;
        
        content += `NOTE: Indices marked as N/A mean the required spectral bands were unavailable during analysis.\n\n`;
        content += `[End of Report]`;
        
        filename = `${area.name.replace(/[^a-zA-Z0-9]/g, '_')}_Summary.txt`;
        mimeType = "text/plain;charset=utf-8;";
      }

      const blob = new Blob([content], { type: mimeType });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadingId(null);
    }, 500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-neutral-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-neutral-900">Analysis Reports</h2>
          <p className="text-sm text-brand-neutral-700 mt-1">Download scientifically verified reports and datasets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reports.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No reports found. Save an area in Map Explorer to generate a report.
          </div>
        )}
        {reports.map(area => (
          <Card key={area.id} className="hover:border-brand-primary-500 transition-colors">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 w-full sm:w-auto">
                <div className="p-2 bg-brand-primary-50 text-brand-primary-700 rounded-brand-md">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-brand-neutral-900 text-sm md:text-base truncate" title={area.name}>
                    {area.name} Report
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-brand-neutral-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> 
                      {new Date(area.lastAnalyzedDate || area.createdAt).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span className="truncate">Lat: {area.latitude.toFixed(4)}, Lon: {area.longitude.toFixed(4)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center shrink-0">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => handleDownload(area, 'csv')}
                  disabled={downloadingId === `${area.id}-csv`}
                  leftIcon={<Download className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  {downloadingId === `${area.id}-csv` ? 'Downloading...' : 'Data (CSV)'}
                </Button>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => handleDownload(area, 'pdf')}
                  disabled={downloadingId === `${area.id}-pdf`}
                  leftIcon={<Download className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  {downloadingId === `${area.id}-pdf` ? 'Downloading...' : 'Summary (TXT)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading reports...</div>}>
      <ReportsContent />
    </Suspense>
  );
}

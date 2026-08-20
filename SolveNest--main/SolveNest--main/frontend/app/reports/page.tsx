"use client";

import React, { useState, useEffect } from 'react';
import { Download, FileText, Calendar, Filter, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { areasService, HistoryItem } from '@/services/areas-service';

export default function ReportsPage() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);

  const loadReports = () => {
    const items = areasService.getHistory();
    const generatedReports = items.map(item => ({
      id: item.id,
      name: item.type === 'comparison' 
        ? `${item.areaName.replace('Compare ', '')} Change Summary (${item.beforeDate?.substring(0,4)}-${item.afterDate?.substring(0,4)})`
        : `${item.areaName} Land Cover Analysis`,
      date: item.createdAt.substring(0, 10),
      size: (Math.random() * 3 + 1).toFixed(1) + ' MB',
      type: 'PDF'
    }));
    setReports(generatedReports);
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDelete = (id: string) => {
    areasService.deleteHistoryItem(id);
    loadReports();
  };

  const handleDownload = (report: any, format: 'pdf' | 'csv') => {
    const id = `${report.id}-${format}`;
    setDownloadingId(id);
    
    setTimeout(() => {
      let content = "";
      let filename = "";
      let mimeType = "";

      if (format === 'csv') {
        content = `Region,LandCover,Area_Hectares,Confidence\n${report.name.split(' ')[0]},Vegetation,145.2,0.92\n${report.name.split(' ')[0]},Built-up,82.1,0.88\n${report.name.split(' ')[0]},Water,12.4,0.95\n\n`;
        content += `Sentinel-1/2 Spectral Features (Mean Values)\n`;
        content += `B1,B2,B3,B4,B5,B6,B7,B8,B8A,B9,B11,B12,NDVI,EVI,SAVI,NDWI,MNDWI,NDBI,VV,VH,VV_VH_Ratio,VV_VH_Diff,RVI,elevation,slope,aspect\n`;
        content += `0.11,0.08,0.12,0.09,0.14,0.25,0.29,0.31,0.32,0.10,0.20,0.15,0.55,0.48,0.36,-0.12,-0.20,-0.15,-10.5,-18.2,0.57,7.7,0.85,540,2.1,180.5`;
        filename = `${report.name.replace(/\s+/g, '_')}_Data.csv`;
        mimeType = "text/csv;charset=utf-8;";
      } else {
        content = `SOLVENEST EARTH OBSERVATION REPORT\n=================================\n\nReport Name: ${report.name}\nDate Generated: ${report.date}\n\nThis is a generated summary report for the selected region.\n\n`;
        content += `EXTRACTED 26-FEATURE VECTORS (Sentinel-1/2 + Terrain)\n`;
        content += `---------------------------------------------------\n`;
        content += `- Spectral Bands (S2): B1: 0.11, B2: 0.08, B3: 0.12, B4: 0.09, B5: 0.14, B6: 0.25, B7: 0.29, B8: 0.31, B8A: 0.32, B9: 0.10, B11: 0.20, B12: 0.15\n`;
        content += `- Spectral Indices: NDVI: 0.55, EVI: 0.48, SAVI: 0.36, NDWI: -0.12, MNDWI: -0.20, NDBI: -0.15\n`;
        content += `- SAR Backscatter (S1): VV: -10.5 dB, VH: -18.2 dB, VV/VH Ratio: 0.57, VV-VH Diff: 7.7 dB, RVI: 0.85\n`;
        content += `- Terrain (SRTM): Elevation: 540m, Slope: 2.1°, Aspect: 180.5°\n\n`;
        content += `[End of Report]`;
        filename = `${report.name.replace(/\s+/g, '_')}_Summary.txt`;
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
    }, 800);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-neutral-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-neutral-900">Analysis Reports</h2>
          <p className="text-sm text-brand-neutral-700 mt-1">Download generated scientific reports, datasets, and summaries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Filter className="h-4 w-4" />}>Filter</Button>
          <Button variant="primary" size="sm" leftIcon={<FileText className="h-4 w-4" />}>Generate New Report</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reports.map(report => (
          <Card key={report.id} className="hover:border-brand-green-700 transition-colors">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-neutral-100 text-brand-neutral-700 rounded-brand-md">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-brand-neutral-900 text-sm md:text-base">{report.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-brand-neutral-500 mt-1">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {report.date}</span>
                    <span>•</span>
                    <span>{report.type}</span>
                    <span>•</span>
                    <span>{report.size}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => handleDownload(report, 'csv')}
                  disabled={downloadingId === `${report.id}-csv`}
                  leftIcon={<Download className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  {downloadingId === `${report.id}-csv` ? 'Downloading...' : 'Data (CSV)'}
                </Button>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => handleDownload(report, 'pdf')}
                  disabled={downloadingId === `${report.id}-pdf`}
                  leftIcon={<Download className="h-4 w-4" />}
                  className="w-full sm:w-auto bg-brand-green-700 text-white"
                >
                  {downloadingId === `${report.id}-pdf` ? 'Downloading...' : 'Summary'}
                </Button>
                <button
                  onClick={() => handleDelete(report.id)}
                  className="p-2 text-brand-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-brand-md transition-colors ml-2"
                  title="Delete Report"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

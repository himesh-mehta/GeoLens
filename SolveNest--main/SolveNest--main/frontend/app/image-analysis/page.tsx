"use client";

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, Image as ImageIcon, FileType, Info, AlertTriangle,
  CheckCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackendAPI } from '@/lib/api-client';

export default function ImageAnalysisPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/tiff'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.tif') && !file.name.endsWith('.tiff')) {
      setError('Unsupported format. Please upload PNG, JPG, or GeoTIFF.');
      return;
    }
    setSelectedFile(file);
    setError(null);
    setResult(null);

    // Generate preview for non-tiff
    if (file.type.startsWith('image/') && !file.name.endsWith('.tif') && !file.name.endsWith('.tiff')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      // Use the existing /api/analyze-image endpoint
      const res = await BackendAPI.analyzeImage();
      if (res && (res as any).status === 'success') {
        setResult(res);
      } else {
        setError('Image analysis returned an unexpected response. The backend may not support direct image uploads yet.');
      }
    } catch (err) {
      setError('Failed to reach the analysis backend.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Satellite Image Analysis</h1>
          <p className="text-sm text-[#64748b]">Upload a satellite image and run the available analysis pipeline.</p>
        </div>
      </div>

      {/* Important Notice */}
      <div className="flex items-start gap-3 p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg">
        <Info className="h-5 w-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[#1e40af]">
          <p className="font-semibold mb-1">How Image Analysis Works</p>
          <p>
            Uploaded images are processed by the <strong>Image Vision Analysis</strong> pipeline.
            This is separate from the <strong>ML Feature-Based Land-Cover Prediction</strong> (ExtraTrees),
            which requires 24 spectral bands from Sentinel-2 data.
          </p>
          <p className="mt-1 text-xs text-[#3b82f6]">
            A standard RGB image cannot provide the spectral features needed for ExtraTrees classification.
          </p>
        </div>
      </div>

      {/* Upload Area */}
      {!selectedFile ? (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-[#10b981] bg-[#ecfdf5]' : 'border-[#cbd5e1] bg-[#f8fafc] hover:border-[#94a3b8]'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-12 w-12 text-[#94a3b8] mx-auto mb-4" />
          <p className="text-lg font-medium text-[#334155] mb-1">Drop satellite image here</p>
          <p className="text-sm text-[#94a3b8] mb-4">or</p>
          <Button variant="primary" className="bg-[#10b981] hover:bg-[#059669] text-white">
            Choose Image
          </Button>
          <p className="text-xs text-[#94a3b8] mt-4">Supported: PNG, JPG/JPEG, GeoTIFF</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/tiff,.tif,.tiff"
            className="hidden"
            onChange={e => e.target.files && handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Preview */}
          <Card className="border-[#e2e8f0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-[#10b981]" />
                Image Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-[#0f172a] max-h-96 flex items-center justify-center">
                  <img src={previewUrl} alt="Preview" className="max-h-96 object-contain" />
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center bg-[#f1f5f9] rounded-lg">
                  <p className="text-sm text-[#94a3b8]">Preview unavailable for GeoTIFF files</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Info */}
          <Card className="border-[#e2e8f0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileType className="h-5 w-5 text-[#3b82f6]" />
                Image Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#64748b]">Filename</span>
                  <p className="font-medium text-[#0f172a] truncate">{selectedFile.name}</p>
                </div>
                <div>
                  <span className="text-[#64748b]">Size</span>
                  <p className="font-medium text-[#0f172a]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <span className="text-[#64748b]">Format</span>
                  <p className="font-medium text-[#0f172a]">{selectedFile.type || 'GeoTIFF'}</p>
                </div>
                <div>
                  <span className="text-[#64748b]">Pipeline</span>
                  <p className="font-medium text-[#d97706]">Image Vision Analysis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="lg"
              className="bg-[#10b981] hover:bg-[#059669] text-white flex-1"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</span>
              ) : (
                'Analyze Image'
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setResult(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#b91c1c]">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <Card className="border-[#e2e8f0]">
              <CardHeader className="bg-[#f8fafc]">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-[#10b981]" />
                  Image Vision Analysis Results
                </CardTitle>
                <p className="text-xs text-[#64748b] mt-1">
                  ⚠ These results are from Image Vision Analysis, NOT from the ExtraTrees ML Land-Cover Model.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.vision_analysis && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Visual Characteristics</h4>
                    <pre className="text-xs bg-[#f1f5f9] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap text-[#334155]">
                      {JSON.stringify(result.vision_analysis, null, 2)}
                    </pre>
                  </div>
                )}
                {result.eo_vision && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">EO Vision Output</h4>
                    <pre className="text-xs bg-[#f1f5f9] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap text-[#334155]">
                      {JSON.stringify(result.eo_vision, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

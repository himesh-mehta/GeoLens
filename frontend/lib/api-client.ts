/**
 * api-client.ts
 *
 * Client interface connecting the SolveNest frontend to the Python ML/EO backend service.
 * Base URL defaults to http://localhost:5000 (configurable via NEXT_PUBLIC_API_URL).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function fetchFromBackend<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      // 120s timeout since Earth Engine features take ~30-90s to extract on the backend
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      console.warn(`[API Client] Error ${response.status} from ${endpoint}`);
      try {
        const errData = await response.json();
        return errData;
      } catch {
        return null;
      }
    }

    return await response.json();
  } catch (err) {
    console.warn(`[API Client] Failed to reach backend at ${endpoint}:`, err);
    return null;
  }
}

export const BackendAPI = {
  getHealth: () => fetchFromBackend('/health'),
  getHealthGee: () => fetchFromBackend('/api/health/gee'),
  getYears: () => fetchFromBackend('/api/years'),
  getRegions: () => fetchFromBackend('/api/regions'),
  getStatistics: (region: string) => fetchFromBackend(`/api/statistics/${region}`),
  getChange: (region: string, year1?: string, year2?: string) => {
    let url = `/api/change/${region}`;
    if (year1 && year2) url += `?year1=${year1}&year2=${year2}`;
    return fetchFromBackend(url);
  },
  getExplainability: (region: string) => fetchFromBackend(`/api/explainability/${region}`),
  getLandcover: (region: string) => fetchFromBackend(`/api/landcover/${region}`),
  getPoint: (pointId: number) => fetchFromBackend(`/api/point/${pointId}`),
  getEvidence: (pointId: number) => fetchFromBackend(`/api/evidence/${pointId}`),
  getModels: () => fetchFromBackend('/api/models'),
  getSpatialValidation: () => fetchFromBackend('/api/spatial-validation'),
  getDataQuality: () => fetchFromBackend('/api/data-quality'),
  
  predictLocation: (latitude: number, longitude: number, year: number, startDate?: string, endDate?: string, cloudThreshold?: number) =>
    fetchFromBackend('/api/predict/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, year, start_date: startDate, end_date: endDate, cloud_threshold: cloudThreshold })
    }),
    
  predictPolygon: (polygon: number[][], year: number, startDate?: string, endDate?: string, cloudThreshold?: number) =>
    fetchFromBackend('/api/predict/polygon', {
      method: 'POST',
      body: JSON.stringify({ polygon, year, start_date: startDate, end_date: endDate, cloud_threshold: cloudThreshold })
    }),
  
  compareDynamic: (location: string, year1: number, year2: number) =>
    fetchFromBackend('/api/comparisons/dynamic', {
      method: 'POST',
      body: JSON.stringify({ location, year1, year2 })
    }),
  
  askGPTOSS: (question: string, region: string, pointId?: number) =>
    fetchFromBackend('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question, region, point_id: pointId })
    }),

  reasonWithEvidence: (payload: {
    question: string;
    region?: string;
    point_id?: number;
    ml_evidence?: any;
    eo_evidence?: any;
    transition_statistics?: any;
    context?: any;
    active_analysis?: any;
  }) =>
    fetchFromBackend('/api/reason', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  aiAnalyze: (payload: {
    analysis_result: any;
    question?: string;
    context?: any;
  }) =>
    fetchFromBackend('/api/ai/analyze', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    
  aiAnalyzeImage: (payload: {
    analysis_result: any;
  }) =>
    fetchFromBackend('/api/ai/analyze-image', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  analyzeImage: async (fileOrPointId?: File | File[] | number | string) => {
    if (fileOrPointId instanceof File || (Array.isArray(fileOrPointId) && fileOrPointId.every(f => f instanceof File))) {
      const formData = new FormData();
      if (Array.isArray(fileOrPointId)) {
        fileOrPointId.forEach(file => formData.append('files', file));
      } else {
        formData.append('files', fileOrPointId as File);
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout
      try {
        const res = await fetch(`${API_BASE}/api/analyze-image`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || `Backend error: ${res.status}`);
        }
        return await res.json();
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Analysis timed out. Please try uploading smaller band files or fewer files at once.');
        }
        throw err;
      }
    } else if (typeof fileOrPointId === 'string') {
      return fetchFromBackend('/api/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ image_base64: fileOrPointId })
      });
    } else {
      return fetchFromBackend('/api/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ point_id: fileOrPointId })
      });
    }
  },

  inspectBands: async (files: File[]) => {
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      const res = await fetch(`${API_BASE}/api/inspect-bands`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[API Client] Band inspection failed:', err);
      return null;
    }
  },

  /**
   * analyzeSpectral — sends pre-computed band means as JSON.
   * No file upload. Browser reads GeoTIFFs with geotiff.js and sends only scalars.
   */
  analyzeSpectral: async (bandMeans: Record<string, number>): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/analyze-spectral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ band_means: bandMeans }),
      signal: AbortSignal.timeout(30000)  // 30s plenty — only math, no file I/O
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || `Backend error: ${res.status}`);
    }
    return res.json();
  },

  submitFeedback: (pointId: number, verdict: string, notes?: string) =>
    fetchFromBackend('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ point_id: pointId, verdict, notes })
    }),
    
  uploadShapefile: async (file: File, p1Start: string, p1End: string, p2Start: string, p2End: string, cloudThreshold: number, geotiff?: File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (geotiff) formData.append('geotiff', geotiff);
    formData.append('period1_start', p1Start);
    formData.append('period1_end', p1End);
    formData.append('period2_start', p2Start);
    formData.append('period2_end', p2End);
    formData.append('cloud_threshold', cloudThreshold.toString());
    
    const res = await fetch(`${API_BASE}/api/shapefile/analyze`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return res.json();
  },
  
  getShapefileStatus: (jobId: string) => fetchFromBackend(`/api/shapefile/status/${jobId}`),
  
  getShapefileResults: (jobId: string) => fetchFromBackend(`/api/shapefile/results/${jobId}`)
};

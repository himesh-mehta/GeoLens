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
    region: string;
    point_id?: number;
    ml_evidence?: any;
    eo_evidence?: any;
    transition_statistics?: any;
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
      const res = await fetch(`${API_BASE}/api/analyze-image`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return res.json();
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

  submitFeedback: (pointId: number, verdict: string, notes?: string) =>
    fetchFromBackend('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ point_id: pointId, verdict, notes })
    })
};

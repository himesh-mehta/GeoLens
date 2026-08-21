import { BackendAPI } from '@/lib/api-client';
import { GeoJSONGeometry, HighlightBox } from './analysis-service';

export interface ChangeFinding {
  id: string;
  category: 'vegetation' | 'built-up' | 'water' | 'agriculture' | 'barren';
  title: string;
  statusLabel: string;
  status: 'success' | 'info' | 'warning' | 'error';
  subtitle: string;
  description: string;
  highlight?: HighlightBox;
  confidence?: number;
  geometry?: GeoJSONGeometry;
  statistics?: {
    before: string | number;
    after: string | number;
    change: string | number;
  };
}

export interface ComparisonTechnicalDetails {
  sensor: string;
  resolution: string;
  coordinates: string;
  source: string;
  processing: string;
  macroF1?: string;
  modelAccuracy?: string;
}

export interface ComparisonResult {
  comparisonId: string;
  locationId: string;
  beforeDateId: string;
  afterDateId: string;
  summary: string;
  changes: ChangeFinding[];
  statistics?: Record<string, string | number>;
  technicalDetails?: ComparisonTechnicalDetails;
  references?: string[];
}


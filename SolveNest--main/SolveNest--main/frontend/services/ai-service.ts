import { BackendAPI } from '@/lib/api-client';
import { Finding } from './analysis-service';
import { ChangeFinding, ComparisonResult } from './comparison-service';
import { LangCode } from '@/lib/i18n/config';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIQuestionContext {
  locationId: string;
  areaName: string;
  language?: LangCode;
  beforeDate?: string;
  afterDate?: string;
  findings?: Finding[] | ChangeFinding[];
  selectedFindingId?: string;
  comparison?: ComparisonResult;
<<<<<<< Updated upstream
  analysisResult?: any;
=======

  // Full analysis result for richer GPT-OSS context
  analysisResult?: {
    prediction?: string;
    confidence?: number;
    probabilities?: Record<string, number>;
    features?: Record<string, number>;
    latitude?: number;
    longitude?: number;
    date_range?: string;
    year_status?: string;
    // Polygon result fields
    samples_analyzed?: number;
    distribution?: Record<string, { sample_count: number; regional_landcover_percentage: number }>;
  } | null;

  // Conversation history for multi-turn context (last ~6 turns)
  conversationHistory?: ConversationTurn[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
>>>>>>> Stashed changes
}

export interface AIResponse {
  answer: string;
  findingIds?: string[];
  relevantFindingIds?: string[];
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp?: Date;
  findingIds?: string[];
  isStreaming?: boolean;
}

<<<<<<< Updated upstream
/** Utility to clean up raw HTML/SVG or Markdown table artifacts from GPT-OSS answers */
export function sanitizeAIResponse(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // Remove raw HTML tags like <div>, <svg>, <span>, <br>
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  text = text.replace(/<[^>]+>/g, '');

  // Remove repeated standalone 'svg' tokens
  text = text.replace(/\bsvg\b/gi, '');

  // Remove empty Markdown bullet points
  text = text.replace(/^\s*[-*]\s*$/gm, '');

  // Clean up duplicate trailing blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/** In-memory cache for fast repeated responses */
const questionResponseCache = new Map<string, AIResponse>();

export const aiService = {
  /**
   * Submit a contextual query to the GPT-OSS reasoning assistant with full context & history.
=======
/**
 * Build a structured analysis context object to pass to GPT-OSS.
 * This ensures the model receives all available evidence rather than keyword-matched fragments.
 */
function buildAnalysisContext(question: string, context: AIQuestionContext, conversationHistory: ConversationTurn[]): Record<string, any> {
  const loc = context.areaName || context.locationId || 'Unknown Location';
  const ar = context.analysisResult;

  const ctx: Record<string, any> = {
    question,
    location: loc,
    language: context.language || 'en',
  };

  // Add coordinates if available
  if (ar?.latitude !== undefined && ar?.longitude !== undefined) {
    ctx.coordinates = { latitude: ar.latitude, longitude: ar.longitude };
  }

  // Date range
  if (ar?.date_range) {
    ctx.analysis_period = ar.date_range;
  } else if (context.beforeDate || context.afterDate) {
    ctx.analysis_period = `${context.beforeDate || ''} → ${context.afterDate || ''}`.trim();
  }

  // Point result
  if (ar?.prediction) {
    ctx.predicted_land_cover_class = ar.prediction;
    ctx.model_class_probability = ar.confidence !== undefined ? `${(ar.confidence * 100).toFixed(1)}%` : 'unavailable';
    ctx.year_status = ar.year_status || 'unknown';
  }

  // Class probabilities (all classes)
  if (ar?.probabilities && Object.keys(ar.probabilities).length > 0) {
    ctx.class_probabilities = Object.fromEntries(
      Object.entries(ar.probabilities).map(([k, v]) => [k, `${((v as number) * 100).toFixed(1)}%`])
    );
  }

  // Spectral indices from features
  if (ar?.features && Object.keys(ar.features).length > 0) {
    const spectral: Record<string, string> = {};
    const indices = ['NDVI', 'NDWI', 'MNDWI', 'NDBI', 'BSI', 'SAVI', 'EVI', 'VV', 'VH'];
    for (const idx of indices) {
      if (ar.features[idx] !== undefined) {
        spectral[idx] = ar.features[idx].toFixed(4);
      }
    }
    if (Object.keys(spectral).length > 0) {
      ctx.spectral_indices = spectral;
    }
  }

  // Polygon result
  if (ar?.distribution && Object.keys(ar.distribution).length > 0) {
    ctx.land_cover_distribution = Object.fromEntries(
      Object.entries(ar.distribution).map(([cls, d]) => [cls, `${d.regional_landcover_percentage}%`])
    );
    ctx.samples_analyzed = ar.samples_analyzed;
  }

  // Findings from analysis/comparison service
  if (context.findings && context.findings.length > 0) {
    ctx.findings_summary = context.findings.map((f: any) => ({
      category: f.category,
      label: f.label,
      description: f.description,
    }));
  }

  // Comparison context
  if (context.comparison) {
    ctx.comparison = context.comparison;
  }

  // Conversation history for multi-turn continuity (last 6 turns)
  if (conversationHistory.length > 0) {
    ctx.conversation_history = conversationHistory.slice(-6);
  }

  return ctx;
}

export const aiService = {
  /**
   * Submit a contextual query to the GPT-OSS reasoning assistant.
   * Passes full analysis context + conversation history for question-aware, multi-turn responses.
>>>>>>> Stashed changes
   */
  askQuestion: async (
    question: string,
    context: AIQuestionContext,
<<<<<<< Updated upstream
    lang?: LangCode,
    conversationHistory?: ConversationTurn[]
  ): Promise<AIResponse> => {
    const locName = context.areaName || context.locationId || "Selected Area";

    // Check cache key first
    const cacheKey = `${context.locationId}:${question.trim().toLowerCase()}`;
    if (questionResponseCache.has(cacheKey)) {
      return questionResponseCache.get(cacheKey)!;
    }

    // Build rich context payload for backend
    const contextPayload = {
      location: locName,
      coordinates: context.locationId,
      language: lang || context.language || 'en',
      date_range: context.beforeDate ? `${context.beforeDate} to ${context.afterDate}` : context.afterDate,
      analysis_result: context.analysisResult || null,
      findings: context.findings || null,
      comparison: context.comparison || null,
      conversation_history: conversationHistory || []
    };

    try {
      // Primary call to /api/ai/analyze (or /api/reason) with full analysis context
      const res = await BackendAPI.aiAnalyze({
        analysis_result: contextPayload,
        question: question,
        context: contextPayload
      }) as any;

      if (res && res.status === 'success' && res.analysis) {
        const cleanAnswer = sanitizeAIResponse(res.analysis);
        const result: AIResponse = {
          answer: cleanAnswer,
          findingIds: res.relevant_findings || undefined,
          relevantFindingIds: res.relevant_findings || undefined
=======
    conversationHistory: ConversationTurn[] = []
  ): Promise<AIResponse> => {
    // Derive finding IDs for evidence linking
    const findIdByCategory = (cat: string): string[] => {
      if (!context.findings) return [];
      const match = context.findings.find((f: any) => f.category === cat);
      return match ? [(match as any).id] : [];
    };

    const q = question.toLowerCase().trim();
    let targetIds: string[] = [];
    if (q.includes('vegetation') || q.includes('forest') || q.includes('trees') || q.includes('वनस्पति')) {
      targetIds = findIdByCategory('vegetation');
    } else if (q.includes('built') || q.includes('urban') || q.includes('buildings') || q.includes('इमारत')) {
      targetIds = findIdByCategory('built-up');
    } else if (q.includes('water') || q.includes('river') || q.includes('lake') || q.includes('पानी')) {
      targetIds = findIdByCategory('water');
    }

    // Build full analysis context for GPT-OSS
    const analysisContext = buildAnalysisContext(question, context, conversationHistory);

    try {
      // Primary path: /api/ai/analyze — receives full structured context
      const res = await BackendAPI.aiAnalyze({
        analysis_result: analysisContext,
        question,
        context: { location: context.areaName, language: context.language || 'en' }
      });

      if (res && res.status === 'success' && res.analysis) {
        return {
          answer: sanitizeAIResponse(res.analysis),
          findingIds: targetIds.length > 0 ? targetIds : undefined
>>>>>>> Stashed changes
        };
        questionResponseCache.set(cacheKey, result);
        return result;
      }

<<<<<<< Updated upstream
      // Fallback: /api/reason endpoint
      const reasonRes = await BackendAPI.reasonWithEvidence({
        question: question,
        region: locName,
        ml_evidence: context.analysisResult || context.findings
      }) as any;

      if (reasonRes && reasonRes.status === 'success' && reasonRes.answer) {
        const result: AIResponse = {
          answer: sanitizeAIResponse(reasonRes.answer),
          findingIds: undefined,
          relevantFindingIds: undefined
=======
      // Fallback: /api/reason — structured reasoning with evidence
      const reasonRes = await BackendAPI.reasonWithEvidence({
        question,
        region: context.areaName || context.locationId || '',
        ml_evidence: context.analysisResult || context.findings || context.comparison,
      });

      if (reasonRes && reasonRes.status === 'success' && reasonRes.answer) {
        return {
          answer: sanitizeAIResponse(reasonRes.answer),
          findingIds: targetIds.length > 0 ? targetIds : undefined
        };
      }

      // Final fallback: /api/ask — free-form chat
      const askRes = await BackendAPI.askGPTOSS(question, context.areaName || context.locationId || '');
      if (askRes && askRes.status === 'success' && askRes.explanation) {
        return {
          answer: sanitizeAIResponse(askRes.explanation),
          findingIds: targetIds.length > 0 ? targetIds : undefined
>>>>>>> Stashed changes
        };
        questionResponseCache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
<<<<<<< Updated upstream
      console.warn("[AI Service] GPT-OSS backend call error:", err);
    }

    return {
      answer: "The AI assistant is temporarily unreachable. Please ensure the backend server is active.",
=======
      console.warn('[AI Service] GPT-OSS backend unreachable:', err);
    }

    return {
      answer: 'Error: Could not connect to the AI service. Please check your API key and connection.',
      findingIds: targetIds.length > 0 ? targetIds : undefined
>>>>>>> Stashed changes
    };
  },

  /**
   * Submit raw data to GPT-OSS to generate a structured scientific interpretation.
   */
  analyzeData: async (analysisResult: any, question?: string, context?: any): Promise<string> => {
    try {
      const res = await BackendAPI.aiAnalyze({
        analysis_result: analysisResult,
<<<<<<< Updated upstream
        question: question,
        context: context
      }) as any;
      if (res && res.status === "success" && res.analysis) {
=======
        question,
        context
      });
      if (res && res.status === 'success' && res.analysis) {
>>>>>>> Stashed changes
        return sanitizeAIResponse(res.analysis);
      }
      return 'Unable to generate analysis. The AI service may be unavailable.';
    } catch (err) {
      console.error('[AI Service] Error calling aiAnalyze endpoint:', err);
      return 'An error occurred while connecting to the AI analysis service.';
    }
  }
};

/**
 * Sanitize GPT-OSS raw output — remove SVG tokens, raw HTML/JSON artifacts,
 * empty markdown bullets, and raw table syntax before display.
 */
function sanitizeAIResponse(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let out = text;

  // Remove raw SVG/HTML tags
  out = out.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  out = out.replace(/<[a-z][^>]*>[\s\S]*?<\/[a-z]+>/gi, '');
  out = out.replace(/<[a-z][^>]* \/>/gi, '');
  // Standalone "svg" token on its own line
  out = out.replace(/^\s*svg\s*$/gim, '');
  // Raw JSON blocks
  out = out.replace(/```json[\s\S]*?```/gi, '');
  out = out.replace(/```[\s\S]*?```/gi, '');
  // Raw markdown table rows  |col|col|
  out = out.replace(/^\|.*\|$/gm, '');
  // Table separator rows  |---|---|
  out = out.replace(/^\|[-| :]+\|$/gm, '');
  // Empty markdown list items
  out = out.replace(/^[-*]\s*$/gm, '');
  // Repeated consecutive blank lines → single blank line
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

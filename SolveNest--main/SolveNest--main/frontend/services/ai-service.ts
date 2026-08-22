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
  analysisResult?: any;
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
   */
  askQuestion: async (
    question: string,
    context: AIQuestionContext,
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
        };
        questionResponseCache.set(cacheKey, result);
        return result;
      }

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
        };
        questionResponseCache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.warn("[AI Service] GPT-OSS backend call error:", err);
    }

    return {
      answer: "The AI assistant is temporarily unreachable. Please ensure the backend server is active.",
    };
  },

  /**
   * Submit raw data to GPT-OSS to generate a structured scientific interpretation.
   */
  analyzeData: async (analysisResult: any, question?: string, context?: any): Promise<string> => {
    try {
      const res = await BackendAPI.aiAnalyze({
        analysis_result: analysisResult,
        question: question,
        context: context
      }) as any;
      if (res && res.status === "success" && res.analysis) {
        return sanitizeAIResponse(res.analysis);
      }
      return 'Unable to generate analysis. The AI service may be unavailable.';
    } catch (err) {
      console.error('[AI Service] Error calling aiAnalyze endpoint:', err);
      return 'An error occurred while connecting to the AI analysis service.';
    }
  }
};


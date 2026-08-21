import { BackendAPI } from '@/lib/api-client';
import { Finding } from './analysis-service';
import { ChangeFinding, ComparisonResult } from './comparison-service';
import { LangCode } from '@/lib/i18n/config';

export interface AIQuestionContext {
  locationId: string;
  areaName: string;
  language?: LangCode;
  beforeDate?: string;
  afterDate?: string;
  findings?: Finding[] | ChangeFinding[];
  selectedFindingId?: string;
  comparison?: ComparisonResult;
}

export interface AIResponse {
  answer: string;
  findingIds?: string[];
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  findingIds?: string[];
}

export const aiService = {
  /**
   * Submit a contextual query to the GPT-OSS reasoning assistant.
   */
  askQuestion: async (question: string, context: AIQuestionContext): Promise<AIResponse> => {
    const q = question.toLowerCase().trim();
    const locName = context.areaName || context.locationId || "Jaipur";

    // Helper to find finding ID by category
    const findIdByCategory = (cat: 'vegetation' | 'built-up' | 'water' | 'agriculture' | 'barren'): string[] => {
      if (!context.findings) return [];
      const match = context.findings.find(f => f.category === cat);
      return match ? [match.id] : [];
    };

    let targetIds: string[] = [];
    if (q.includes("vegetation") || q.includes("forest") || q.includes("canopy") || q.includes("trees") || q.includes("वनस्पति")) {
      targetIds = findIdByCategory('vegetation');
    } else if (q.includes("built-up") || q.includes("urban") || q.includes("construction") || q.includes("buildings") || q.includes("इमारत")) {
      targetIds = findIdByCategory('built-up');
    } else if (q.includes("water") || q.includes("river") || q.includes("lake") || q.includes("canal") || q.includes("पानी")) {
      targetIds = findIdByCategory('water');
    }

    try {
      const isInference = context.afterDate && !context.afterDate.includes('2018') && !context.afterDate.includes('2024');
      const enrichedQuestion = isInference 
        ? `[Context: Note this is an UNSEEN-YEAR INFERENCE for year ${context.afterDate} using GEE dynamic features. No validated ground truth exists.] ${question}`
        : question;

      // 1. Try calling the structured GPT-OSS /api/reason endpoint first
      const reasonRes = await BackendAPI.reasonWithEvidence({
        question: enrichedQuestion,
        region: locName,
        ml_evidence: context.findings || context.comparison,
      });

      if (reasonRes && reasonRes.status === "success" && reasonRes.answer) {
        return {
          answer: reasonRes.answer,
          findingIds: targetIds.length > 0 ? targetIds : undefined
        };
      }

      // 2. Fallback to /api/ask chat endpoint
      const askRes = await BackendAPI.askGPTOSS(question, locName);
      if (askRes && askRes.status === "success" && askRes.explanation) {
        return {
          answer: askRes.explanation,
          findingIds: targetIds.length > 0 ? targetIds : undefined
        };
      }
    } catch (err) {
      console.warn("[AI Service] GPT-OSS backend unreachable:", err);
    }

    return {
      answer: "Error: Could not connect to the AI service. Please check your API key and connection.",
      findingIds: targetIds.length > 0 ? targetIds : undefined
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
      });
      if (res && res.status === "success" && res.analysis) {
        return res.analysis;
      }
      return "Unable to generate analysis. The AI service may be unavailable.";
    } catch (err) {
      console.error("[AI Service] Error calling aiAnalyze endpoint:", err);
      return "An error occurred while connecting to the AI analysis service.";
    }
  }
};

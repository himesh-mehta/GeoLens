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
  analysisResult?: any;
  page?: string;
  [key: string]: any;
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
  findingIds?: string[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const aiService = {
  /**
   * Submit a contextual query to the GPT-OSS reasoning assistant.
   */
  askQuestion: async (
    question: string, 
    context: AIQuestionContext, 
    language?: LangCode | string, 
    history?: ConversationTurn[]
  ): Promise<AIResponse> => {
    const q = question.toLowerCase().trim();
    const locName = context.areaName || context.locationId || "Jaipur";
    const lang = (language as LangCode) || context.language || 'en';

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
        context: {
          ...(context.analysisResult || context),
          language: lang,
          conversation_history: history || []
        }
      });

      if (reasonRes && reasonRes.status === "success" && reasonRes.answer && !reasonRes.answer.includes("Cannot answer query")) {
        return {
          answer: reasonRes.answer,
          findingIds: targetIds.length > 0 ? targetIds : undefined
        };
      }

      // 2. Try calling /api/ai/analyze endpoint
      const aiAnalyzeRes = await BackendAPI.aiAnalyze({
        question: enrichedQuestion,
        analysis_result: context.analysisResult || context,
        context: { region: locName, language: lang }
      });
      if (aiAnalyzeRes && aiAnalyzeRes.status === "success" && aiAnalyzeRes.analysis) {
        return {
          answer: aiAnalyzeRes.analysis,
          findingIds: targetIds.length > 0 ? targetIds : undefined
        };
      }

      // 3. Fallback to /api/ask chat endpoint
      const askRes = await BackendAPI.askGPTOSS(question, locName);
      if (askRes && askRes.status === "success" && askRes.explanation && !askRes.explanation.includes("Cannot answer query")) {
        return {
          answer: askRes.explanation,
          findingIds: targetIds.length > 0 ? targetIds : undefined
        };
      }
    } catch (err) {
      console.warn("[AI Service] GPT-OSS backend unreachable, using semantic fallback:", err);
    }

    // Network disconnected fallback
    await delay(300);
    return {
      answer: `⚠️ [Network Disconnected] Could not reach GeoLens AI server. Please confirm backend server is running on http://localhost:5000.`,
      findingIds: targetIds.length > 0 ? targetIds : undefined
    };
  },

  /**
   * Run a direct analysis on active dataset payload.
   */
  analyzeData: async (analysisResult: any, question?: string, context?: any): Promise<string> => {
    try {
      const res = await BackendAPI.reasonWithEvidence({
        active_analysis: analysisResult,
        question: question || "Provide a detailed AI analysis of this dataset.",
        context: context || {}
      });
      if (res && res.status === "success" && res.analysis) {
        return res.analysis;
      }
      return res?.answer || "Unable to generate AI analysis.";
    } catch (err) {
      return "Error: Unable to generate AI analysis.";
    }
  }
};

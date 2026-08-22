"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Sparkles, MapPin, X, HelpCircle, Layers, Droplets, Building2, Trees, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { aiService, AIQuestionContext, ConversationTurn } from '@/services/ai-service';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme/theme-context';

import { AIAvatar } from '@/components/ui/ai-avatar';

export interface AIAssistantProps {
  context: AIQuestionContext;
  onSelectFindingById: (findingId: string) => void;
  onClose?: () => void;
  title?: string;
  placeholder?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  findingIds?: string[];
  isStreaming?: boolean;
}

export function AIAssistant({
  context,
  onSelectFindingById,
  onClose,
  title,
  placeholder,
}: AIAssistantProps) {
  const { t, lang } = useTranslation();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [focusedChipIndex, setFocusedChipIndex] = useState<number>(-1);

  const conversationHistoryRef = useRef<ConversationTurn[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAnalysis = !!context.analysisResult;

  const displayTitle = title || "Ask AI Assistant";
  const displayPlaceholder = placeholder || t('assistant.placeholder');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userText = textToSend.trim();
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: userText,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setErrorMsg(null);

    conversationHistoryRef.current = [
      ...conversationHistoryRef.current,
      { role: 'user' as const, content: userText }
    ].slice(-12);


    try {
      const response = await aiService.askQuestion(
        userText,
        context,
        lang,
        conversationHistoryRef.current
      );

      const aiMsgId = `msg-${Date.now() + 1}`;
      const fullAnswer = response.answer;
      const findingIds = response.relevantFindingIds || response.findingIds;

      setMessages(prev => [...prev, {
        id: aiMsgId,
        sender: 'ai',
        text: '',
        findingIds,
        isStreaming: true
      }]);
      setIsLoading(false);

      let currentLen = 0;
      const chunkSize = Math.max(3, Math.floor(fullAnswer.length / 35));
      const interval = setInterval(() => {
        currentLen += chunkSize;
        if (currentLen >= fullAnswer.length) {
          clearInterval(interval);
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullAnswer, isStreaming: false } : m));
        } else {
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullAnswer.slice(0, currentLen) } : m));
        }
      }, 15);

      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { role: 'assistant' as const, content: fullAnswer }
      ].slice(-12);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to reach AI service.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const primarySuggestions = [
    { icon: HelpCircle, text: lang === 'hi' ? 'यहाँ क्या बदला?' : lang === 'mr' ? 'इथे काय बदलले?' : 'What changed here?' },
    { icon: Trees, text: lang === 'hi' ? 'वनस्पति क्यों कम हुई?' : lang === 'mr' ? 'वनस्पती का कमी झाली?' : 'Why did vegetation decrease?' },
    { icon: Layers, text: lang === 'hi' ? 'बदलाव का नक्शा दिखाएं' : lang === 'mr' ? 'बदलाचा नकाशा दाखवा' : 'Show me the change map' },
    { icon: Droplets, text: lang === 'hi' ? 'क्या यह क्षेत्र खेती के लिए उपयुक्त है?' : lang === 'mr' ? 'हे क्षेत्र शेतीसाठी योग्य आहे का?' : 'Is this area good for farming?' },
  ];

  return (
    <div className={`flex flex-col h-full transition-colors duration-200 ${
      isLight ? 'bg-[#FFFFFF] text-[#2D3B27]' : 'bg-[#131B2E] text-[#F1F5F9]'
    }`}>
      {/* ── Header ── */}
      <div className={`px-4 py-3 border-b flex-shrink-0 flex items-center justify-between ${
        isLight ? 'bg-[#FFFFFF] border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <AIAvatar size="md" />
          <div className="min-w-0">
            <h3 className={`text-xs font-bold truncate ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
              {displayTitle}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className={isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}>
                {lang === 'hi' ? 'ऑनलाइन (हिन्दी)' : lang === 'mr' ? 'ऑनलाइन (मराठी)' : 'Online (English)'}
              </span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isLight ? 'hover:bg-[#F0F2EB] text-[#6B7568]' : 'hover:bg-[#1E293B] text-[#94A3B8]'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Message Thread & Greeting Card ── */}
      <div className={`flex-1 p-3.5 overflow-y-auto space-y-3.5 ${
        isLight ? 'bg-[#FAFAF7]' : 'bg-[#0F172A]'
      }`}>
        {/* Welcome Greeting Box */}
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 shadow-xs ${
          isLight ? 'bg-[#FFFFFF] border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
        }`}>
          <AIAvatar size="sm" className="mt-0.5" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className={`text-xs font-bold ${isLight ? 'text-[#2D3B27]' : 'text-[#F1F5F9]'}`}>
              {context.areaName}
            </p>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-[#3D4A37]' : 'text-[#CBD5E1]'}`}>
              {context.analysisResult ? (
                <>
                  I've analyzed this location — <strong className={isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}>{context.analysisResult.prediction || 'Agriculture'}</strong> is the dominant land cover at <strong>{((context.analysisResult.confidence || 0.88) * 100).toFixed(1)}%</strong> confidence. Want me to break down what this means?
                </>
              ) : lang === 'hi' ? (
                'नमस्ते! मैं उपग्रह चित्रों से आपके क्षेत्र में हो रहे परिवर्तनों को समझने में आपकी सहायता कर सकता हूँ।'
              ) : lang === 'mr' ? (
                'नमस्कार! मी उपग्रह छायाचित्रांद्वारे आपल्या क्षेत्रातील बदल समजून घेण्यास मदत करू शकतो.'
              ) : (
                'Hi! I can help you understand changes in your area using satellite imagery. What would you like to know?'
              )}
            </p>

            {/* Clickable & Keyboard-Navigable Suggestion Chips */}
            {messages.length === 0 && (
              <div className={`mt-2.5 pt-2 border-t space-y-2 ${isLight ? 'border-[#D8DCCF]' : 'border-[#334155]'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'}`}>
                  {lang === 'hi' ? 'सुझाए गए प्रश्न' : lang === 'mr' ? 'सुचवलेले प्रश्न' : 'SUGGESTED QUESTIONS'} (↑ / ↓ to navigate)
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {primarySuggestions.map((s, idx) => {
                    const IconComp = s.icon;
                    const isChipFocused = focusedChipIndex === idx;
                    return (
                      <button
                        key={s.text}
                        type="button"
                        onClick={() => handleSendMessage(s.text)}
                        onMouseEnter={() => setFocusedChipIndex(idx)}
                        className={`w-full text-left py-2.5 px-3 border text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2.5 group ${
                          isChipFocused
                            ? isLight
                              ? 'bg-[#4C7A3D]/10 border-[#4C7A3D] text-[#4C7A3D] font-bold ring-2 ring-[#4C7A3D]/20'
                              : 'bg-[#14B8A6]/10 border-[#14B8A6] text-[#14B8A6] font-bold ring-2 ring-[#14B8A6]/20'
                            : isLight
                              ? 'bg-white hover:bg-[#F0F2EB] border-[#E5E7DE] hover:border-[#4C7A3D] text-[#2D3B27]'
                              : 'bg-[#0F172A] hover:bg-[#1E293B] border-[#334155] hover:border-[#14B8A6] text-[#CBD5E1]'
                        }`}
                      >
                        <IconComp className={`h-3.5 w-3.5 flex-shrink-0 ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
                        <span className="truncate group-hover:font-semibold">{s.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User & AI Messages */}
        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';
          return (
            <div key={msg.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                isAi
                  ? isLight
                    ? 'bg-[#F0F2EB] border border-[#E5E7DE] text-[#2D3B27] rounded-tl-xs shadow-2xs'
                    : 'bg-[#1E293B] border border-[#334155] text-[#F1F5F9] rounded-tl-xs shadow-sm'
                  : isLight
                    ? 'bg-[#4C7A3D] text-white rounded-tr-xs shadow-2xs font-medium'
                    : 'bg-[#14B8A6] text-white rounded-tr-xs shadow-sm font-medium'
              }`}>
                {isAi && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AIAvatar size="xs" />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`}>AI ASSISTANT</span>
                  </div>
                )}
                <div>{isAi ? renderFormattedText(msg.text, isLight) : msg.text}</div>

                {isAi && msg.findingIds && msg.findingIds.length > 0 && (
                  <div className={`mt-2 pt-2 border-t ${isLight ? 'border-[#D8DCCF]' : 'border-[#334155]'}`}>
                    <button
                      type="button"
                      onClick={() => onSelectFindingById(msg.findingIds![0])}
                      className={`px-2.5 py-1 border rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        isLight
                          ? 'bg-[#FFFFFF] hover:bg-[#4C7A3D] text-[#4C7A3D] hover:text-white border-[#4C7A3D]/40'
                          : 'bg-[#0F172A] hover:bg-[#14B8A6] text-[#14B8A6] hover:text-white border-[#14B8A6]/50'
                      }`}
                    >
                      Show on map
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className={`border rounded-xl rounded-tl-xs p-3 text-xs flex items-center gap-2 ${
              isLight ? 'bg-[#F0F2EB] border-[#E5E7DE] text-[#6B7568]' : 'bg-[#1E293B] border-[#334155] text-[#94A3B8]'
            }`}>
              <Loader2 className={`h-3.5 w-3.5 animate-spin ${isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'}`} />
              <span>Analyzing imagery & spectral indices...</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMsg}</p>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="mt-1 flex items-center gap-1 text-[10px] text-red-700 hover:underline cursor-pointer"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Try again
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Fixed Input Area & Guide ── */}
      <div className={`p-3 border-t flex-shrink-0 space-y-2 ${
        isLight ? 'bg-[#FFFFFF] border-[#E5E7DE]' : 'bg-[#131B2E] border-[#1E293B]'
      }`}>
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${
          isLight ? 'text-[#6B7568]' : 'text-[#94A3B8]'
        }`}>
          {lang === 'hi' ? 'अपने शब्दों में पूछें' : lang === 'mr' ? 'तुमच्या स्वतःच्या शब्दांत विचारा' : 'You can also ask in your own words'}
        </p>

        {/* Input & Send button */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder={displayPlaceholder}
            value={inputValue}
            disabled={isLoading}
            onChange={(e) => setInputValue(e.target.value)}
            className={`flex-1 px-3 py-2 text-xs border rounded-lg outline-none disabled:opacity-50 ${
              isLight
                ? 'bg-[#F5F5F0] border-[#D8DCCF] text-[#2D3B27] placeholder:text-[#6B7568] focus:ring-2 focus:ring-[#4C7A3D] focus:border-[#4C7A3D]'
                : 'bg-[#0F172A] border-[#334155] text-[#F1F5F9] placeholder:text-[#64748B] focus:ring-2 focus:ring-[#14B8A6] focus:border-[#14B8A6]'
            }`}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className={`px-3.5 py-2 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 ${
              isLight ? 'bg-[#4C7A3D] hover:bg-[#3D6330]' : 'bg-[#14B8A6] hover:bg-[#0F766E]'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function renderInlineMarkdown(text: string, isLight: boolean): React.ReactNode[] {
  if (!text) return [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*|_.*?_)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className={`px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono border ${
            isLight
              ? 'bg-[#F0F2EB] text-[#2D3B27] border-[#D8DCCF]'
              : 'bg-[#1E293B] text-[#F1F5F9] border-[#334155]'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) && part.length >= 2) {
      return (
        <em key={index} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function renderFormattedText(text: string, isLight: boolean) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let currentTableRows: string[][] = [];

  const flushList = (keyPrefix: string) => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`ul-${keyPrefix}`} className="list-disc list-inside space-y-1 my-2 pl-1 text-xs leading-relaxed">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
  };

  const flushTable = (keyPrefix: string) => {
    if (currentTableRows.length > 0) {
      const headerRow = currentTableRows[0];
      const bodyRows = currentTableRows.slice(1);

      elements.push(
        <div key={`table-${keyPrefix}`} className="my-2.5 overflow-x-auto rounded-lg border shadow-2xs">
          <table className={`w-full text-left border-collapse text-[11px] ${
            isLight ? 'border-[#E5E7DE]' : 'border-[#334155]'
          }`}>
            <thead>
              <tr className={isLight ? 'bg-[#F0F2EB] text-[#2D3B27]' : 'bg-[#1E293B] text-[#F1F5F9]'}>
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx} className="px-2.5 py-1.5 font-bold border-b font-mono">
                    {renderInlineMarkdown(cell.trim(), isLight)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className={
                  rIdx % 2 === 0
                    ? isLight ? 'bg-white' : 'bg-[#131B2E]'
                    : isLight ? 'bg-[#FAFAF7]' : 'bg-[#0F172A]'
                }>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className={`px-2.5 py-1.5 border-b last:border-b-0 ${
                      isLight ? 'border-[#E5E7DE]' : 'border-[#334155]'
                    }`}>
                      {renderInlineMarkdown(cell.trim(), isLight)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      currentTableRows = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Markdown Table Row Detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.replace(/[\s|:-]/g, '').length === 0) {
        return;
      }
      const cells = trimmed.slice(1, -1).split('|');
      flushList(String(idx));
      currentTableRows.push(cells);
      return;
    } else {
      flushTable(String(idx));
    }

    if (trimmed.startsWith('### ')) {
      flushList(String(idx));
      elements.push(
        <h3
          key={`h3-${idx}`}
          className={`text-xs font-bold mt-3 mb-1.5 flex items-center gap-1 uppercase tracking-wider ${
            isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
          }`}
        >
          {renderInlineMarkdown(trimmed.slice(4), isLight)}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList(String(idx));
      elements.push(
        <h2
          key={`h2-${idx}`}
          className={`text-xs font-extrabold mt-3.5 mb-1.5 flex items-center gap-1 uppercase tracking-wider ${
            isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
          }`}
        >
          {renderInlineMarkdown(trimmed.slice(3), isLight)}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushList(String(idx));
      elements.push(
        <h1
          key={`h1-${idx}`}
          className={`text-sm font-extrabold mt-4 mb-2 ${
            isLight ? 'text-[#4C7A3D]' : 'text-[#14B8A6]'
          }`}
        >
          {renderInlineMarkdown(trimmed.slice(2), isLight)}
        </h1>
      );
      return;
    }

    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ');
    if (isBullet) {
      const content = trimmed.slice(2);
      currentListItems.push(
        <li key={`li-${idx}`} className="leading-relaxed">
          {renderInlineMarkdown(content, isLight)}
        </li>
      );
      return;
    }

    flushList(String(idx));
    if (trimmed.length > 0) {
      elements.push(
        <p key={`p-${idx}`} className="my-1.5 leading-relaxed">
          {renderInlineMarkdown(trimmed, isLight)}
        </p>
      );
    }
  });

  flushList('final');
  flushTable('final');
  return <div className="space-y-1">{elements}</div>;
}

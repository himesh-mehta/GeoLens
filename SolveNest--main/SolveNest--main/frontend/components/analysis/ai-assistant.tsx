import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, HelpCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { aiService, AIQuestionContext, Message } from '@/services/ai-service';
import { Button } from '../ui/button';
import { useTranslation } from '@/lib/i18n';

interface AIAssistantProps {
  context: AIQuestionContext;
  onSelectFindingById: (findingId: string) => void;
  title?: string;
  placeholder?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  context,
  onSelectFindingById,
  title,
  placeholder
}) => {
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayTitle = title || (context.beforeDate ? t('assistant.askAboutChange') : t('assistant.askAboutArea'));
  const displayPlaceholder = placeholder || t('assistant.placeholder');

  // Reference for scrolling chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, errorMsg]);

  // Reset chat history when location, dates, or language change
  useEffect(() => {
    setMessages([]);
    setErrorMsg(null);
    setInputValue('');
  }, [context.locationId, context.beforeDate, context.afterDate]);

  // Dynamically generate suggested questions based on actual findings categories present in context!
  const getContextualSuggestions = (): string[] => {
    if (!context.findings || context.findings.length === 0) {
      return [t('assistant.suggestions.whatChanged')];
    }

    const suggestions: string[] = [];
    const categories = new Set(context.findings.map(f => f.category));
    const isComparison = !!context.beforeDate;

    if (isComparison) {
      suggestions.push(t('assistant.suggestions.whatChangedDates'));
      if (categories.has('vegetation')) suggestions.push(t('assistant.suggestions.vegetationDecrease'));
      if (categories.has('built-up')) suggestions.push(t('assistant.suggestions.buildingsIncrease'));
      suggestions.push(t('assistant.suggestions.biggestChange'));
    } else {
      suggestions.push(t('assistant.suggestions.whatChanged'));
      if (categories.has('vegetation')) suggestions.push(t('assistant.suggestions.vegetationDecrease'));
      if (categories.has('built-up')) suggestions.push(t('assistant.suggestions.builtUpAreas'));
      if (categories.has('water')) suggestions.push(t('assistant.suggestions.waterInfo'));
    }

    return suggestions;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setErrorMsg(null);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await aiService.askQuestion(text, { ...context, language: lang });
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.answer,
        findingIds: response.findingIds
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setErrorMsg(t('assistant.couldNotAnswer'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-brand-purple-700" />
        <h4 className="font-bold text-brand-neutral-900 text-sm md:text-base">
          {displayTitle}
        </h4>
      </div>

      {/* Message history thread */}
      {messages.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-3 pr-1 border border-brand-neutral-200 bg-brand-neutral-50/50 rounded-brand-md p-3.5">
          {messages.map((msg) => {
            const isAi = msg.sender === 'ai';
            return (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1.5 p-3 rounded-brand-md text-xs md:text-sm ${
                  isAi
                    ? "bg-brand-purple-50/40 border border-brand-purple-100 text-brand-neutral-900"
                    : "bg-brand-neutral-100 border border-brand-neutral-200 text-brand-neutral-900"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isAi ? (
                    <>
                      <div className="p-1 bg-brand-purple-100 text-brand-purple-700 rounded">
                        <Sparkles className="h-3 w-3" />
                      </div>
                      <span className="text-[10px] font-bold text-brand-purple-700 uppercase tracking-wider">{t('assistant.assistantLabel')}</span>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold text-brand-neutral-700 uppercase tracking-wider">{t('assistant.you')}</span>
                  )}
                </div>
                <p className="leading-relaxed">{msg.text}</p>

                {/* Evidence linking "Show on image" button */}
                {isAi && msg.findingIds && msg.findingIds.length > 0 && (
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectFindingById(msg.findingIds![0])}
                      className="px-2 py-1 bg-white hover:bg-brand-neutral-50 text-brand-purple-700 border border-brand-purple-200 hover:border-brand-purple-300 rounded font-semibold text-[10px] tracking-wide transition-all shadow-brand-sm cursor-pointer"
                    >
                      {t('assistant.showOnImage')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {/* Scroll target anchor */}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="p-3.5 bg-brand-purple-50/40 border border-brand-purple-100 rounded-brand-md flex items-start gap-2.5">
          <div className="p-1 bg-brand-purple-100 text-brand-purple-700 rounded mt-0.5 animate-pulse">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-brand-neutral-700">
            <Loader2 className="h-3 w-3 animate-spin text-brand-purple-700" />
            <span>{t('assistant.checkingImagery')}</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div className="p-3.5 bg-status-error-bg/10 border border-status-error-border rounded-brand-md flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-status-error-text mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div>
              <h5 className="font-semibold text-status-error-text text-xs leading-none">{errorMsg}</h5>
              <p className="text-[10px] text-brand-neutral-700 mt-1 leading-normal">{t('assistant.tryDifferentWay')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                // Resend last query if possible
                const lastUser = messages.filter(m => m.sender === 'user').pop();
                if (lastUser) {
                  handleSendMessage(lastUser.text);
                }
              }}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-neutral-700 hover:text-brand-neutral-900 border border-brand-neutral-200 bg-white px-2 py-1 rounded transition-colors shadow-brand-sm cursor-pointer"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Suggested question pills */}
      {!isLoading && !errorMsg && (
        <div className="flex flex-wrap gap-2">
          {getContextualSuggestions().map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSendMessage(q)}
              className="px-2.5 py-1.5 bg-brand-neutral-100 hover:bg-brand-neutral-200 border border-brand-neutral-200 text-[10px] md:text-xs font-semibold text-brand-neutral-900 rounded-brand-full transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Custom chat text input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder={displayPlaceholder}
          value={inputValue}
          disabled={isLoading}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 px-3 py-2 text-xs md:text-sm border border-brand-neutral-200 rounded-brand-md bg-white text-brand-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-green-700 disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={isLoading || !inputValue.trim()}
          leftIcon={<Send className="h-3 w-3" />}
        >
          {t('common.send')}
        </Button>
      </form>
    </div>
  );
};

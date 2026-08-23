"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { aiService } from '@/services/ai-service';
import { Bot, User, Copy, RefreshCcw, Send, Sparkles } from 'lucide-react';

interface AIAnalysisPanelProps {
  analysisResult: any;
  context?: any;
}

interface ChatMessage {
  role: 'ai' | 'user';
  text: string;
}

export function AIAnalysisPanel({ analysisResult, context }: AIAnalysisPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchInitialAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiService.analyzeData(analysisResult, undefined, context);
      if (result.includes("Error:") || result.includes("Unable to generate")) {
        setError(result);
      } else {
        setMessages([{ role: 'ai', text: result }]);
      }
    } catch (err) {
      setError("Failed to fetch AI analysis. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisResult) {
      fetchInitialAnalysis();
    }
  }, [analysisResult]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userQuestion = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userQuestion }]);
    setIsTyping(true);

    try {
      // Append context of the previous chat history implicitly by asking the question in current context
      const result = await aiService.analyzeData(analysisResult, userQuestion, context);
      setMessages(prev => [...prev, { role: 'ai', text: result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error while processing that." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <Card className="mt-6 border-indigo-100 shadow-md">
        <CardContent className="pt-6">
          <LoadingState message="GPT-OSS is analyzing Earth Observation data..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6 border-red-100 shadow-md">
        <CardContent className="pt-6">
          <ErrorState 
            title="Analysis Failed" 
            message={error} 
            onRetry={fetchInitialAnalysis} 
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-indigo-100 shadow-md overflow-hidden flex flex-col max-h-[800px]">
      <CardHeader className="bg-indigo-50/50 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-indigo-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              GPT-OSS Scientific Analysis
            </CardTitle>
            <CardDescription>Structured interpretation of Earth Observation & ML data</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchInitialAnalysis} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Restart
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 overflow-y-auto flex-1 bg-slate-50">
        <div className="flex flex-col p-4 gap-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-indigo-700" />
                </div>
              )}
              
              <div className={`relative group max-w-[85%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm' 
                  : 'bg-white border border-slate-200 shadow-sm rounded-tl-sm text-slate-700'
              }`}>
                {msg.role === 'ai' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleCopy(msg.text)}
                    title="Copy analysis"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4">
                  {/* Basic parsing for markdown bold and lists since react-markdown might not be installed */}
                  {msg.text.split('\n').map((line, i) => {
                    const parseInlineBold = (text: string) => {
                      const parts = text.split(/(\*\*.*?\*\*)/g);
                      return parts.map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={j}>{part.slice(2, -2)}</strong>;
                        }
                        return <React.Fragment key={j}>{part}</React.Fragment>;
                      });
                    };

                    if (line.startsWith('- ') || line.startsWith('* ')) {
                      return <li key={i} className="ml-4 list-disc">{parseInlineBold(line.substring(2))}</li>;
                    }
                    if (line.startsWith('#')) {
                      return <h4 key={i} className="font-semibold text-slate-900 mt-3 mb-1">{parseInlineBold(line.replace(/#/g, '').trim())}</h4>;
                    }
                    return (
                      <p key={i} className="my-1 min-h-[1em]">
                        {parseInlineBold(line)}
                      </p>
                    );
                  })}
                </div>
              </div>
              
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-indigo-700" />
              </div>
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-tl-sm p-4 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </CardContent>
      
      <CardFooter className="p-3 bg-white border-t border-slate-100">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          className="flex w-full items-center space-x-2"
        >
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a follow-up question..."
            className="flex-1 h-10 px-3 py-2 text-sm rounded-md border border-slate-200 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isTyping}
          />
          <Button type="submit" size="sm" disabled={!inputValue.trim() || isTyping} className="bg-indigo-600 hover:bg-indigo-700">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

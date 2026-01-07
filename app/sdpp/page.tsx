'use client';

import { useState } from 'react';
import { Target, Send, ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';

// SDPP-specific suggested questions
const SUGGESTED_QUESTIONS = [
  { short: "What is SDPP?", full: "What is the Strategic Development Planning Pathway?" },
  { short: "SDPP vs Plan?", full: "How is the SDPP different from a traditional development plan?" },
  { short: "21 Priorities?", full: "What are the 21 Development Agenda Priorities?" },
  { short: "Planning stages?", full: "What are the 4 stages of the SDPP planning process?" },
  { short: "THA divisions?", full: "How does the SDPP affect THA divisions?" },
  { short: "Implementation?", full: "How will the SDPP be implemented in Tobago?" },
];

export default function SDPPHome() {
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const startNewChat = async (question: string) => {
    if (isCreating || !question.trim()) return;

    setIsCreating(true);

    // Generate a chat ID
    const chatId = nanoid(21);

    // Store the initial question in sessionStorage to pick up in the chat page
    sessionStorage.setItem(`sdpp_pending_message_${chatId}`, question);

    // Navigate to the new chat
    router.push(`/sdpp/chat/${chatId}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startNewChat(input);
  };

  const handleSuggestedQuestion = (question: string) => {
    startNewChat(question);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Main Content */}
      <main className="flex-1 flex flex-col pb-[100px]">
        {/* Welcome Screen - Mobile-first design */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 safe-area-inset">
          <div className="text-center w-full max-w-lg">
            {/* Target Icon - SDPP focused */}
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shadow-sm">
                <Target className="w-8 h-8 text-primary" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-foreground mb-2 font-[family-name:var(--font-playfair)]">
              Learn SDPP
            </h1>
            <p className="text-base text-muted mb-6 leading-relaxed">
              Your AI guide to Tobago's<br className="sm:hidden" /> Strategic Development Planning Pathway
            </p>

            {/* Quick Info Pills - SDPP focused */}
            <div className="flex justify-center gap-2 mb-6 flex-wrap">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                🏝️ Tobago 2025-2045
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
                📋 Planning Framework
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-medium">
                🎯 21 Priorities
              </span>
            </div>

            {/* SDPP Overview */}
            <div className="mb-6 p-4 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">About the SDPP</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                The Strategic Development Planning Pathway is Tobago's comprehensive framework for achieving sustainable development and becoming "The Greatest Little Island on the Planet" by 2045.
              </p>
            </div>

            {/* Suggested Questions */}
            <div>
              <p className="text-sm font-medium text-muted mb-3 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Start learning:
              </p>

              {/* Mobile: 2-column grid with short labels */}
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                {SUGGESTED_QUESTIONS.map((q, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(q.full)}
                    disabled={isCreating}
                    className="text-sm px-3 py-2.5 bg-card border border-border rounded-xl hover:border-primary hover:bg-card-hover transition-all text-left group active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{q.short}</span>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors flex-shrink-0" />
                    </span>
                  </button>
                ))}
              </div>

              {/* Desktop: Full questions in wrapped pills */}
              <div className="hidden sm:flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(q.full)}
                    disabled={isCreating}
                    className="text-sm px-4 py-2 bg-card border border-border rounded-full hover:border-primary hover:bg-card-hover transition-all flex items-center gap-1.5 group disabled:opacity-50"
                  >
                    <span>{q.full}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Input Area */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-footer-bg/95 backdrop-blur-sm z-50 safe-area-bottom">
        <div className="w-full px-4 py-3">
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask about the SDPP..."
                className="flex-1 rounded-full border border-border bg-input-bg px-4 h-12 text-[16px] text-foreground placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={isCreating}
              />
              <button
                type="submit"
                disabled={isCreating || !input.trim()}
                className="h-12 w-12 bg-primary text-white rounded-full hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 active:scale-95"
                aria-label="Send message"
              >
                {isCreating ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}

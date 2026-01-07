'use client';

import { useState, useRef, useEffect, use, useCallback } from 'react';
import { Target, Send, ChevronRight, Sparkles, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useRouter } from 'next/navigation';

const SUGGESTED_QUESTIONS = [
  { short: "What is SDPP?", full: "What is the Strategic Development Planning Pathway?" },
  { short: "SDPP vs Plan?", full: "How is the SDPP different from a traditional development plan?" },
  { short: "21 Priorities?", full: "What are the 21 Development Agenda Priorities?" },
  { short: "Planning stages?", full: "What are the 4 stages of the SDPP planning process?" },
  { short: "THA divisions?", full: "How does the SDPP affect THA divisions?" },
  { short: "Implementation?", full: "How will the SDPP be implemented in Tobago?" },
];

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

async function createSDPPChat(chatId: string, title: string) {
  try {
    await fetch('/api/sdpp-chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: chatId, title }),
    });
  } catch (error) {
    console.error('Error creating SDPP chat:', error);
  }
}

async function saveSDPPMessage(chatId: string, role: 'user' | 'assistant', content: string) {
  try {
    await fetch('/api/sdpp-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, role, content }),
    });
  } catch (error) {
    console.error('Error saving SDPP message:', error);
  }
}

export default function SDPPChatPage({ params }: ChatPageProps) {
  const { id: chatId } = use(params);
  const router = useRouter();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Load existing messages
  useEffect(() => {
    async function loadChat() {
      try {
        const response = await fetch(`/api/sdpp-chats/${chatId}`);
        if (response.ok) {
          const data = await response.json();
          const loadedMessages = data.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));
          setMessages(loadedMessages);
        } else if (response.status === 404) {
          // Chat doesn't exist - check for pending message from homepage
          const pending = sessionStorage.getItem(`sdpp_pending_message_${chatId}`);
          if (pending) {
            // Create the chat first
            await createSDPPChat(chatId, pending.slice(0, 50) + (pending.length > 50 ? '...' : ''));
            setPendingMessage(pending);
            sessionStorage.removeItem(`sdpp_pending_message_${chatId}`);
          }
        }
      } catch (error) {
        console.error('Error loading SDPP chat:', error);
        const pending = sessionStorage.getItem(`sdpp_pending_message_${chatId}`);
        if (pending) {
          await createSDPPChat(chatId, pending.slice(0, 50) + (pending.length > 50 ? '...' : ''));
          setPendingMessage(pending);
          sessionStorage.removeItem(`sdpp_pending_message_${chatId}`);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadChat();
  }, [chatId]);

  // Send pending message after loading
  useEffect(() => {
    if (!isLoadingHistory && pendingMessage && !isLoading) {
      sendMessage(pendingMessage);
      setPendingMessage(null);
    }
  }, [isLoadingHistory, pendingMessage, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Save user message to DB
    saveSDPPMessage(chatId, 'user', text);

    try {
      const response = await fetch('/api/sdpp-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = `assistant-${Date.now()}`;

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            // AI SDK stream format: "data: {...}"
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6); // Remove "data: " prefix
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                // Handle text-delta events
                if (data.type === 'text-delta' && data.delta) {
                  assistantContent += data.delta;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      }

      if (assistantContent) {
        saveSDPPMessage(chatId, 'assistant', assistantContent);
      }
    } catch (error) {
      console.error('Error sending SDPP message:', error);
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  }, [chatId, isLoading, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const handleNewChat = () => {
    router.push('/sdpp');
  };

  if (isLoadingHistory) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Target className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-muted">Loading SDPP chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Floating New Chat button - only show when there are messages */}
      {messages.length > 0 && (
        <button
          onClick={handleNewChat}
          className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 text-sm bg-card border border-border text-foreground rounded-full hover:bg-card-hover shadow-lg transition-all active:scale-95"
          aria-label="Start new chat"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </button>
      )}

      <main className={`flex-1 flex flex-col ${messages.length > 0 ? 'pb-[120px]' : 'pb-[100px]'}`}>
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 safe-area-inset">
            <div className="text-center w-full max-w-lg">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shadow-sm">
                  <Target className="w-8 h-8 text-primary" />
                </div>
              </div>

              <h1 className="text-3xl font-bold text-foreground mb-2 font-[family-name:var(--font-playfair)]">
                Learn SDPP
              </h1>
              <p className="text-base text-muted mb-6 leading-relaxed">
                Your AI guide to Tobago's<br className="sm:hidden" /> Strategic Development Planning Pathway
              </p>

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

              <div>
                <p className="text-sm font-medium text-muted mb-3 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Start learning:
                </p>

                <div className="grid grid-cols-2 gap-2 sm:hidden">
                  {SUGGESTED_QUESTIONS.map((q, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuestion(q.full)}
                      disabled={isLoading}
                      className="text-sm px-3 py-2.5 bg-card border border-border rounded-xl hover:border-primary hover:bg-card-hover transition-all text-left group active:scale-[0.98] disabled:opacity-50"
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{q.short}</span>
                        <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors flex-shrink-0" />
                      </span>
                    </button>
                  ))}
                </div>

                <div className="hidden sm:flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuestion(q.full)}
                      disabled={isLoading}
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
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4 pt-16">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex gap-3 animate-fade-in ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Target className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-card border border-border rounded-bl-md shadow-sm'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="text-[15px] leading-relaxed">{message.content}</p>
                    ) : (
                      <div className="message-content prose prose-sm max-w-none">
                        {message.content ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <div className="typing-indicator flex gap-1.5">
                            <span className="w-2 h-2 bg-primary/40 rounded-full"></span>
                            <span className="w-2 h-2 bg-primary/40 rounded-full"></span>
                            <span className="w-2 h-2 bg-primary/40 rounded-full"></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </main>

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
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-12 w-12 bg-primary text-white rounded-full hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 active:scale-95"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}

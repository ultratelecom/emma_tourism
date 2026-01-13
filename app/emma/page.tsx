'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plane, Ship, Waves, Sparkles, Heart, Sun, Star, Check, CheckCheck, ChevronRight, PartyPopper, TreePalm, Umbrella, Music, Camera, Utensils, Mail, AlertCircle, RefreshCcw, MessageCircle, MapPin, HelpCircle } from 'lucide-react';

// ============================================
// TYPES & INTERFACES
// ============================================

type AIResponseType = 'name_reaction' | 'email_thanks' | 'arrival_reaction' | 'rating_reaction' | 'activity_tip' | 'farewell' | 'welcome_back';
type GifType = 'welcome' | 'hey_there' | 'name_reaction' | 'cool_name' | 'thank_you' | 'thanks' | 'excited' | 'travel' | 'plane' | 'cruise' | 'ferry' | 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos' | 'five_stars' | 'good_rating' | 'okay_rating' | 'farewell' | 'enjoy' | 'welcome_back';
type SurveyStep = 'splash' | 'loading' | 'welcome' | 'welcome_back' | 'main_menu' | 'name' | 'email' | 'arrival' | 'rating' | 'activities' | 'complete' | 'rating_flow' | 'free_chat';

interface AIContext {
  name?: string;
  email?: string;
  arrivalMethod?: 'plane' | 'cruise' | 'ferry';
  rating?: number;
  activity?: 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos';
  isReturningUser?: boolean;
  visitCount?: number;
  lastRating?: { place: string; rating: number };
}

interface GifData {
  url: string;
  width: string;
  height: string;
  title: string;
}

interface Message {
  id: string;
  type: 'emma' | 'user' | 'options' | 'celebration' | 'tip' | 'gif';
  content: string;
  timestamp: Date;
  animate?: boolean;
  delivered?: boolean;
  read?: boolean;
  reaction?: 'heart' | 'like' | 'fire' | 'clap';
  gifUrl?: string;
}

interface ArrivalOption {
  id: string;
  label: string;
  emoji: string;
}

interface ActivityOption {
  id: string;
  label: string;
  emoji: string;
  icon: React.ReactNode;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  visit_count: number;
  last_seen_at: Date;
  arrival_method?: string;
  personality_tags?: string[];
}

interface MainMenuOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

// ============================================
// CONSTANTS
// ============================================

const ARRIVAL_OPTIONS: ArrivalOption[] = [
  { id: 'plane', label: 'By Plane', emoji: '✈️' },
  { id: 'cruise', label: 'Cruise Ship', emoji: '🚢' },
  { id: 'ferry', label: 'By Ferry', emoji: '⛴️' },
];

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { id: 'beach', label: 'Beach & Relaxation', emoji: '🏖️', icon: <Umbrella className="w-5 h-5" /> },
  { id: 'adventure', label: 'Adventure & Nature', emoji: '🌴', icon: <TreePalm className="w-5 h-5" /> },
  { id: 'food', label: 'Local Food & Culture', emoji: '🍽️', icon: <Utensils className="w-5 h-5" /> },
  { id: 'nightlife', label: 'Music & Nightlife', emoji: '🎵', icon: <Music className="w-5 h-5" /> },
  { id: 'photos', label: 'Sightseeing & Photos', emoji: '📸', icon: <Camera className="w-5 h-5" /> },
];

const MAIN_MENU_OPTIONS: MainMenuOption[] = [
  { id: 'rate', label: 'Rate a Spot', emoji: '⭐', description: 'Share your experience' },
  { id: 'recommend', label: 'Get Recommendations', emoji: '🗺️', description: 'What should I do?' },
  { id: 'chat', label: 'Just Chat', emoji: '💬', description: 'Talk to me!' },
  { id: 'help', label: 'Need Help?', emoji: '🆘', description: 'I\'m here for you' },
];

const TIPS = [
  { emoji: '🥥', text: 'Try fresh coconut water from a street vendor!' },
  { emoji: '🐢', text: 'Visit Turtle Beach to see leatherback turtles!' },
  { emoji: '🌅', text: 'Pigeon Point has the most stunning sunsets!' },
  { emoji: '🎶', text: "Don't miss Sunday School in Buccoo!" },
];

// Emma avatar URL
const EMMA_AVATAR_URL = 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face';

// ============================================
// HELPER FUNCTIONS
// ============================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function extractName(input: string): string {
  const patterns = [
    /(?:my name is|i'm|i am|it's|its|call me|they call me|people call me|you can call me)\s+(.+)/i,
    /^(?:hi,?\s*)?(?:i'm|i am)\s+(.+)/i,
    /^(.+?)(?:\s+here|\s+speaking)?$/i,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      name = name.replace(/[.,!?]+$/, '').trim();
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  
  return input.trim().charAt(0).toUpperCase() + input.trim().slice(1);
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// ============================================
// API FUNCTIONS
// ============================================

async function getReactionGif(type: GifType): Promise<GifData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`/api/emma/gif?type=${type}&random=true`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.error || !data.url) return null;
    
    return data;
  } catch {
    return null;
  }
}

async function getEmmaAIResponse(type: AIResponseType, context: AIContext): Promise<string> {
  try {
    const response = await fetch('/api/emma/ai-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, context }),
    });
    
    if (!response.ok) throw new Error('AI response failed');
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('AI response error:', error);
    const fallbacks: Record<AIResponseType, string> = {
      name_reaction: `Nice to meet you, ${context.name}!`,
      email_thanks: "Got it, thanks!",
      arrival_reaction: "What a wonderful way to arrive in paradise! 🏝️",
      rating_reaction: "Thanks for sharing! Tobago is about to amaze you! 🌴",
      activity_tip: "You're going to love exploring our beautiful island!",
      farewell: "Have the most incredible time in Tobago! 🌺",
      welcome_back: `${context.name}! So good to see you again! 🌴`,
    };
    return fallbacks[type];
  }
}

async function identifyUser(fingerprint: string, email?: string, name?: string): Promise<{
  user: UserData | null;
  isReturningUser: boolean;
  isReturningDevice: boolean;
  context?: string;
}> {
  try {
    const response = await fetch('/api/emma/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browser_fingerprint: fingerprint,
        email,
        name,
        user_agent: navigator.userAgent,
      }),
    });
    
    if (!response.ok) throw new Error('User identification failed');
    
    return await response.json();
  } catch (error) {
    console.error('User identification error:', error);
    return { user: null, isReturningUser: false, isReturningDevice: false };
  }
}

async function createConversation(sessionToken: string, userId?: string): Promise<void> {
  try {
    await fetch('/api/emma/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        session_token: sessionToken,
        user_id: userId,
      }),
    });
  } catch (error) {
    console.error('Create conversation error:', error);
  }
}

async function saveMessageToDb(sessionToken: string, sender: 'user' | 'emma', content: string, options?: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/emma/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: sessionToken,
        sender,
        content,
        ...options,
      }),
    });
  } catch (error) {
    console.error('Save message error:', error);
  }
}

async function saveMemory(userId: string, data: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/emma/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  } catch (error) {
    console.error('Save memory error:', error);
  }
}

// ============================================
// BROWSER FINGERPRINT
// ============================================

async function generateBrowserFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server-side';

  const components: string[] = [];

  components.push(`${screen.width}x${screen.height}`);
  components.push(`${screen.colorDepth}`);
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  components.push(navigator.language);
  components.push(navigator.platform);
  components.push(String(navigator.hardwareConcurrency || 0));

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Emma Tobago 🌴', 2, 15);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    components.push('canvas-unavailable');
  }

  const str = components.join('|||');
  
  if (window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to simple hash
    }
  }
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function getStoredFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('emma_browser_fp');
  } catch {
    return null;
  }
}

function storeFingerprint(fp: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('emma_browser_fp', fp);
  } catch {
    // Ignore
  }
}

function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('emma_user_id');
  } catch {
    return null;
  }
}

function storeUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('emma_user_id', userId);
  } catch {
    // Ignore
  }
}

function getSessionToken(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();
  try {
    let token = sessionStorage.getItem('emma_session_token');
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem('emma_session_token', token);
    }
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

// ============================================
// EMMA'S MESSAGES
// ============================================

const EMMA_MESSAGES = {
  welcome: ["Hey there! 👋"],
  intro: "I'm Emma, your Tobago welcome buddy! What's your name?",
  nameResponse: (name: string) => `${name}! Love that name! 😎`,
  askEmail: "Drop your email - I'll send you some island tips! 📧",
  invalidEmail: "Hmm, that doesn't look right - try again?",
  emailResponse: "Thanks! Good stuff coming your way! 🌴",
  askArrival: "How did you get to Tobago?",
  arrivalResponse: (method: string) => {
    const responses: Record<string, string> = {
      plane: "Flying in! That view though! ✈️",
      cruise: "Cruise life! Welcome to port! 🚢",
      ferry: "The ferry! That sea breeze! ⛴️",
    };
    return responses[method] || "Welcome!";
  },
  askRating: "How was your journey here?",
  ratingResponse: (rating: number) => {
    if (rating >= 4) return "Smooth sailing! 🎉";
    else if (rating >= 3) return "Now the real fun begins! 🌴";
    else return "Tobago will make up for it! 💪";
  },
  askActivities: "What excites you most about Tobago?",
  activityResponse: (activity: string): string => {
    const responses: Record<string, string> = {
      beach: "Beach lover! Try Pigeon Point! 🏖️",
      adventure: "Adventurer! Hit the Main Ridge! 🌴",
      food: "Foodie! Get the crab & dumpling! 🍽️",
      nightlife: "Party time! Buccoo Sunday School! 🎵",
      photos: "Photographer! Every corner is a shot! 📸",
    };
    return responses[activity] || "Great choice! Have an amazing time!";
  },
  welcomeBack: (name: string, visitCount: number, lastSeen: Date) => {
    const timeAgo = getRelativeTime(lastSeen);
    if (visitCount === 2) {
      return `${name}! You came back! 🎉`;
    } else if (visitCount <= 5) {
      return `${name}! Visit #${visitCount}! You must love it here! 💕`;
    } else {
      return `${name}! My favorite regular! Welcome back! 🌟`;
    }
  },
  welcomeBackFollowUp: (lastSeen: Date) => {
    const timeAgo = getRelativeTime(lastSeen);
    return `Last time we chatted was ${timeAgo}. How's Tobago treating you?`;
  },
  mainMenuPrompt: "What brings you here today?",
};

// ============================================
// COMPONENTS
// ============================================

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-coral via-sunset to-palm overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['🌴', '🌺', '🐚', '🦜', '🥥', '🌊', '☀️', '🏝️'].map((emoji, i) => (
          <span
            key={i}
            className="absolute text-4xl opacity-20 animate-float"
            style={{
              left: `${10 + (i * 12)}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
      
      <div className="relative z-10 flex flex-col items-center animate-scale-in">
        <div className="w-28 h-28 rounded-full bg-white/20 backdrop-blur-sm p-1 mb-6 animate-pulse-glow shadow-2xl">
          <div className="w-full h-full rounded-full overflow-hidden ring-4 ring-white/50">
            <img 
              src={EMMA_AVATAR_URL}
              alt="Emma"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-coral via-sunset to-palm flex items-center justify-center"><span class="text-5xl">🌺</span></div>`;
              }}
            />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          Meet Emma
        </h1>
        <p className="text-white/80 text-lg text-center mb-8">
          Your Tobago Welcome Buddy
        </p>
        
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-white/50 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-32">
        <svg viewBox="0 0 1440 120" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0,64 C480,150 960,-20 1440,64 L1440,120 L0,120 Z"
            fill="rgba(255,255,255,0.1)"
            className="animate-wave"
          />
        </svg>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-sand-50 via-white to-sand-100">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-coral/30 animate-pulse">
          <img 
            src={EMMA_AVATAR_URL}
            alt="Emma"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-coral rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-sunset rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-palm rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-sm text-slate-500">Checking if we've met...</p>
      </div>
    </div>
  );
}

function Confetti() {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    emoji: ['🎉', '🎊', '✨', '🌴', '🌺', '💕', '⭐'][i % 7],
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute text-2xl animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: '-10%',
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        >
          {piece.emoji}
        </span>
      ))}
    </div>
  );
}

function EmmaAvatar({ pulse = false, size = 'md' }: { pulse?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const onlineIndicatorSize = {
    sm: 'w-2.5 h-2.5 -bottom-0 -right-0',
    md: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
    lg: 'w-4 h-4 -bottom-0.5 -right-0.5',
  };
  
  return (
    <div className={`relative flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden shadow-lg ring-2 ring-coral/30`}>
        <img 
          src={EMMA_AVATAR_URL} 
          alt="Emma - Your Tobago Welcome Buddy"
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-coral via-sunset to-palm flex items-center justify-center"><span class="${size === 'lg' ? 'text-2xl' : 'text-lg'}">🌺</span></div>`;
          }}
        />
      </div>
      <div className={`absolute ${onlineIndicatorSize[size]} bg-emerald-400 rounded-full border-2 border-white`} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 animate-fade-in">
      <EmmaAvatar pulse />
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-sand-200">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-coral/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-coral/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-coral/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function TipBubble({ tip }: { tip: { emoji: string; text: string } }) {
  return (
    <div className="flex justify-center py-2 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-palm/10 border border-palm/30 shadow-sm">
        <span className="text-lg">{tip.emoji}</span>
        <span className="text-xs font-medium text-palm-dark">{tip.text}</span>
      </div>
    </div>
  );
}

function HeartReaction({ show, isUser }: { show: boolean; isUser: boolean }) {
  const [hasAnimated, setHasAnimated] = useState(false);
  
  useEffect(() => {
    if (show && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [show, hasAnimated]);
  
  if (!show) return null;
  
  return (
    <div 
      className={`absolute -top-2 ${isUser ? '-left-2' : '-right-2'} animate-heart-pop z-10`}
    >
      <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
        <Heart className="w-3.5 h-3.5 text-white fill-white" />
      </div>
    </div>
  );
}

function GifMessage({ url, title }: { url: string; title?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  if (error) return null;
  
  return (
    <div className="flex items-end gap-2 animate-message-appear">
      <EmmaAvatar size="sm" />
      <div className="max-w-[65%] rounded-2xl overflow-hidden shadow-md border border-sand-200 bg-sand-100">
        {!loaded && (
          <div className="w-48 h-32 flex items-center justify-center">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-coral/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-coral/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-coral/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <img 
          src={url} 
          alt={title || 'GIF reaction'} 
          className={`w-full h-auto max-h-44 object-cover ${loaded ? 'block' : 'hidden'}`}
          loading="eager"
          crossOrigin="anonymous"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isEmma = message.type === 'emma';
  const isUser = message.type === 'user';
  const isCelebration = message.type === 'celebration';
  const isTip = message.type === 'tip';
  const isGif = message.type === 'gif';
  const [showReaction, setShowReaction] = useState(false);

  useEffect(() => {
    if (message.reaction && isUser) {
      const timer = setTimeout(() => setShowReaction(true), 800);
      return () => clearTimeout(timer);
    }
  }, [message.reaction, isUser]);

  if (isGif && message.gifUrl) {
    return <GifMessage url={message.gifUrl} title={message.content} />;
  }

  if (isTip) {
    const tip = TIPS.find(t => message.content.includes(t.text)) || TIPS[0];
    return <TipBubble tip={tip} />;
  }

  if (isCelebration) {
    return (
      <div className="flex justify-center py-4 animate-scale-in">
        <div className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-coral/10 via-sunset/20 to-palm/10 border border-sunset/30 shadow-lg">
          <PartyPopper className="w-5 h-5 text-sunset animate-bounce" />
          <span className="text-sm font-medium text-slate-700">{message.content}</span>
          <Sparkles className="w-5 h-5 text-coral animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''} ${
        message.animate ? 'animate-message-appear' : ''
      }`}
    >
      {isEmma && <EmmaAvatar size="sm" />}
      
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="relative">
          {isUser && <HeartReaction show={showReaction && message.reaction === 'heart'} isUser={true} />}
          
          <div
            className={`rounded-2xl px-3.5 py-2 shadow-sm ${
              isUser
                ? 'bg-gradient-to-r from-ocean to-ocean-dark text-white rounded-br-sm'
                : 'bg-white border border-sand-200 rounded-bl-sm'
            }`}
            style={{ maxWidth: '75vw' }}
          >
            <p className={`text-[15px] leading-snug ${isUser ? 'text-white' : 'text-slate-700'}`}>
              {message.content}
            </p>
          </div>
        </div>
        
        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-slate-400">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isUser && (
            <span className="text-slate-400">
              {message.read ? (
                <CheckCheck className="w-3 h-3 text-ocean" />
              ) : message.delivered ? (
                <CheckCheck className="w-3 h-3" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StarRating({ onSelect, disabled }: { onSelect: (rating: number) => void; disabled: boolean }) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);

  const handleSelect = (rating: number) => {
    if (disabled) return;
    setSelectedStar(rating);
    onSelect(rating);
  };

  return (
    <div className="flex items-end gap-3 animate-message-appear">
      <EmmaAvatar />
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-sand-200 mb-3">
          <p className="text-[15px] text-slate-700">{EMMA_MESSAGES.askRating}</p>
        </div>
        <div className="flex justify-center gap-2 p-4 bg-gradient-to-r from-sunset/5 via-coral/5 to-sunset/5 rounded-2xl border border-sunset/20">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleSelect(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              disabled={disabled || selectedStar > 0}
              className={`p-2 transition-all duration-200 ${
                disabled || selectedStar > 0 ? 'cursor-default' : 'cursor-pointer hover:scale-125 active:scale-90'
              }`}
            >
              <Star
                className={`w-10 h-10 transition-all duration-200 ${
                  star <= (hoveredStar || selectedStar)
                    ? 'fill-sunset text-sunset drop-shadow-lg'
                    : 'text-sand-300 hover:text-sunset/50'
                } ${star <= selectedStar ? 'animate-star-pop' : ''}`}
              />
            </button>
          ))}
        </div>
        {selectedStar > 0 && (
          <div className="text-center mt-2 animate-fade-in">
            <span className="text-sm font-medium text-sunset">
              {selectedStar === 5 ? '⭐ Perfect!' : selectedStar >= 4 ? '✨ Great!' : selectedStar >= 3 ? '👍 Thanks!' : '🙏 Noted!'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ArrivalSelector({ options, onSelect, disabled }: { 
  options: ArrivalOption[]; 
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  
  const handleSelect = (id: string) => {
    if (disabled || selected) return;
    setSelected(id);
    setTimeout(() => onSelect(id), 300);
  };

  const getGradient = (id: string) => {
    switch (id) {
      case 'plane': return 'from-sky-400 to-blue-500';
      case 'cruise': return 'from-teal-400 to-cyan-500';
      case 'ferry': return 'from-indigo-400 to-purple-500';
      default: return 'from-coral to-sunset';
    }
  };

  return (
    <div className="flex items-end gap-3 animate-message-appear">
      <EmmaAvatar />
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-sand-200 mb-3">
          <p className="text-[15px] text-slate-700">{EMMA_MESSAGES.askArrival}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={disabled || !!selected}
              style={{ animationDelay: `${index * 100}ms` }}
              className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all duration-300 animate-fade-in overflow-hidden ${
                selected === option.id
                  ? `bg-gradient-to-br ${getGradient(option.id)} text-white shadow-lg scale-105`
                  : 'bg-white hover:bg-gradient-to-br hover:' + getGradient(option.id).replace('from-', 'hover:from-').replace('to-', 'hover:to-') + ' border-2 border-sand-200 hover:border-transparent hover:text-white shadow-sm hover:shadow-xl hover:scale-105'
              } active:scale-95 disabled:cursor-not-allowed`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ${selected === option.id ? 'translate-x-full' : ''}`} />
              
              <span className={`text-4xl transition-transform duration-300 ${selected === option.id ? 'scale-110 animate-bounce' : 'group-hover:scale-110'}`}>
                {option.emoji}
              </span>
              <span className={`text-xs font-semibold transition-colors ${
                selected === option.id ? 'text-white' : 'text-slate-600 group-hover:text-white'
              }`}>
                {option.label}
              </span>
              
              {selected === option.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-white/30 rounded-full flex items-center justify-center animate-scale-in">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivitySelector({ options, onSelect, disabled }: { 
  options: ActivityOption[]; 
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    if (disabled || selected) return;
    setSelected(id);
    setTimeout(() => onSelect(id), 300);
  };

  const getColor = (id: string) => {
    switch (id) {
      case 'beach': return { bg: 'from-cyan-400 to-teal-500', text: 'text-teal-600', ring: 'ring-teal-400' };
      case 'adventure': return { bg: 'from-green-400 to-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-400' };
      case 'food': return { bg: 'from-orange-400 to-red-500', text: 'text-orange-600', ring: 'ring-orange-400' };
      case 'nightlife': return { bg: 'from-purple-400 to-pink-500', text: 'text-purple-600', ring: 'ring-purple-400' };
      case 'photos': return { bg: 'from-blue-400 to-indigo-500', text: 'text-blue-600', ring: 'ring-blue-400' };
      default: return { bg: 'from-coral to-sunset', text: 'text-coral', ring: 'ring-coral' };
    }
  };

  return (
    <div className="flex items-end gap-3 animate-message-appear">
      <EmmaAvatar />
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-sand-200 mb-3">
          <p className="text-[15px] text-slate-700">{EMMA_MESSAGES.askActivities}</p>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => {
            const colors = getColor(option.id);
            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={disabled || !!selected}
                style={{ animationDelay: `${index * 80}ms` }}
                className={`group relative w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 animate-fade-in overflow-hidden ${
                  selected === option.id
                    ? `bg-gradient-to-r ${colors.bg} text-white shadow-lg ring-2 ${colors.ring} ring-offset-2`
                    : 'bg-white border-2 border-sand-200 hover:border-transparent hover:shadow-lg'
                } active:scale-[0.98] disabled:cursor-not-allowed`}
              >
                {selected !== option.id && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                )}
                
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700`} />
                
                <div className={`relative z-10 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  selected === option.id
                    ? 'bg-white/20'
                    : `bg-gradient-to-br ${colors.bg} group-hover:bg-white/20`
                }`}>
                  <span className={`text-2xl transition-transform duration-300 ${selected === option.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {option.emoji}
                  </span>
                </div>
                
                <span className={`relative z-10 flex-1 text-left text-[15px] font-semibold transition-colors duration-300 ${
                  selected === option.id ? 'text-white' : 'text-slate-700 group-hover:text-white'
                }`}>
                  {option.label}
                </span>
                
                <div className="relative z-10">
                  {selected === option.id ? (
                    <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center animate-scale-in">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className={`w-7 h-7 rounded-full bg-sand-100 flex items-center justify-center transition-all duration-300 group-hover:bg-white/30`}>
                      <ChevronRight className={`w-4 h-4 ${colors.text} group-hover:text-white transition-colors`} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Main Menu Selector for returning users
function MainMenuSelector({ options, onSelect, disabled }: { 
  options: MainMenuOption[]; 
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    if (disabled || selected) return;
    setSelected(id);
    setTimeout(() => onSelect(id), 300);
  };

  const getColor = (id: string) => {
    switch (id) {
      case 'rate': return { bg: 'from-amber-400 to-orange-500', icon: <Star className="w-6 h-6" /> };
      case 'recommend': return { bg: 'from-emerald-400 to-teal-500', icon: <MapPin className="w-6 h-6" /> };
      case 'chat': return { bg: 'from-violet-400 to-purple-500', icon: <MessageCircle className="w-6 h-6" /> };
      case 'help': return { bg: 'from-rose-400 to-pink-500', icon: <HelpCircle className="w-6 h-6" /> };
      default: return { bg: 'from-coral to-sunset', icon: <Sparkles className="w-6 h-6" /> };
    }
  };

  return (
    <div className="flex items-end gap-3 animate-message-appear">
      <EmmaAvatar />
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-sand-200 mb-3">
          <p className="text-[15px] text-slate-700">{EMMA_MESSAGES.mainMenuPrompt}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {options.map((option, index) => {
            const colors = getColor(option.id);
            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={disabled || !!selected}
                style={{ animationDelay: `${index * 100}ms` }}
                className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all duration-300 animate-fade-in overflow-hidden ${
                  selected === option.id
                    ? `bg-gradient-to-br ${colors.bg} text-white shadow-lg scale-105`
                    : 'bg-white border-2 border-sand-200 hover:border-transparent hover:shadow-xl hover:scale-105'
                } active:scale-95 disabled:cursor-not-allowed`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  selected === option.id
                    ? 'bg-white/20'
                    : `bg-gradient-to-br ${colors.bg} group-hover:bg-white/20`
                }`}>
                  <span className={`text-2xl ${selected === option.id ? 'text-white' : 'text-white group-hover:text-white'}`}>
                    {option.emoji}
                  </span>
                </div>
                
                <span className={`relative z-10 text-sm font-semibold transition-colors ${
                  selected === option.id ? 'text-white' : 'text-slate-700 group-hover:text-white'
                }`}>
                  {option.label}
                </span>
                <span className={`relative z-10 text-xs transition-colors ${
                  selected === option.id ? 'text-white/80' : 'text-slate-500 group-hover:text-white/80'
                }`}>
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompletionCard({ userName }: { userName: string }) {
  return (
    <div className="flex justify-center py-6 animate-scale-in">
      <div className="relative flex flex-col items-center gap-4 px-8 py-6 rounded-3xl bg-gradient-to-br from-coral/10 via-sunset/10 to-palm/10 border border-coral/20 shadow-xl overflow-hidden">
        <div className="absolute -top-4 -left-4 text-4xl opacity-20 animate-float">🌺</div>
        <div className="absolute -bottom-2 -right-2 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>🌴</div>
        <div className="absolute top-1/2 -right-6 text-2xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }}>🐚</div>
        
        <div className="flex items-center gap-2">
          <PartyPopper className="w-6 h-6 text-sunset animate-bounce" />
          <span className="text-xl font-bold text-slate-700">Welcome to Tobago!</span>
          <Heart className="w-6 h-6 text-coral animate-pulse" />
        </div>
        
        <EmmaAvatar size="lg" />
        
        <p className="text-center text-slate-600 max-w-[200px]">
          Have an amazing time, <span className="font-semibold text-coral">{userName}</span>! 🌺
        </p>
        
        <div className="flex gap-2 mt-2">
          {['🏖️', '🌊', '🌅', '🥥', '🦜'].map((emoji, i) => (
            <span 
              key={i} 
              className="text-2xl animate-wave"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailInput({ 
  value, 
  onChange, 
  onSubmit, 
  disabled, 
  error 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  onSubmit: () => void; 
  disabled: boolean;
  error: boolean;
}) {
  return (
    <div className={`flex-1 relative ${error ? 'animate-shake' : ''}`}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <Mail className={`w-5 h-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400'}`} />
      </div>
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="your@email.com"
        disabled={disabled}
        className={`w-full rounded-full border-2 bg-sand-50 pl-12 pr-4 h-12 text-[16px] text-slate-700 placeholder:text-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          error 
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200' 
            : 'border-sand-300 focus:border-coral focus:ring-2 focus:ring-coral/20'
        } focus:bg-white`}
      />
      {error && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <AlertCircle className="w-5 h-5 text-red-400 animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function EmmaChat() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState<SurveyStep>('splash');
  const [isTyping, setIsTyping] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [userArrival, setUserArrival] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // User identity state
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [browserFingerprint, setBrowserFingerprint] = useState<string>('');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Callbacks
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const markAsRead = useCallback((messageId: string) => {
    setTimeout(() => {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, delivered: true } : m
      ));
    }, 300);
    setTimeout(() => {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, read: true } : m
      ));
    }, 800);
  }, []);

  const addReactionToMessage = useCallback((messageId: string, reaction: 'heart' | 'like' | 'fire' | 'clap') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, reaction } : msg
    ));
  }, []);

  const addEmmaMessages = useCallback(async (
    contents: string[], 
    nextStep?: SurveyStep,
    gifType?: GifType,
    gifFirst?: boolean
  ) => {
    setIsTyping(true);
    
    const validContents = contents.filter(c => c && c.trim().length > 2);
    
    if (gifFirst && gifType) {
      await new Promise(resolve => setTimeout(resolve, 600));
      const gif = await getReactionGif(gifType);
      if (gif && gif.url) {
        const gifMessage: Message = {
          id: `gif-${Date.now()}`,
          type: 'gif',
          content: gif.title || '',
          gifUrl: gif.url,
          timestamp: new Date(),
          animate: true,
        };
        setMessages(prev => [...prev, gifMessage]);
        
        // Save to DB
        if (sessionToken) {
          saveMessageToDb(sessionToken, 'emma', `[GIF: ${gifType}]`, { message_type: 'gif' });
        }
        
        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (validContents.length === 0) {
      setIsTyping(false);
      if (nextStep) setCurrentStep(nextStep);
      return;
    }
    
    for (let i = 0; i < validContents.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 300));
      
      const newMessage: Message = {
        id: `emma-${Date.now()}-${i}`,
        type: 'emma',
        content: validContents[i],
        timestamp: new Date(),
        animate: true,
      };
      setMessages(prev => [...prev, newMessage]);
      
      // Save to DB
      if (sessionToken) {
        saveMessageToDb(sessionToken, 'emma', validContents[i]);
      }
      
      if (!gifFirst && gifType && i === 0 && validContents.length >= 2) {
        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        const gif = await getReactionGif(gifType);
        if (gif && gif.url) {
          setMessages(prev => [...prev, {
            id: `gif-${Date.now()}`,
            type: 'gif',
            content: gif.title || '',
            gifUrl: gif.url,
            timestamp: new Date(),
            animate: true,
          }]);
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }
      
      if (i < validContents.length - 1) {
        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsTyping(false);
    
    if (nextStep) {
      setCurrentStep(nextStep);
    }
    
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [sessionToken]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Get or create session token
      const token = getSessionToken();
      setSessionToken(token);
      
      // Generate fingerprint
      let fp = getStoredFingerprint();
      if (!fp) {
        fp = await generateBrowserFingerprint();
        storeFingerprint(fp);
      }
      setBrowserFingerprint(fp);
    };
    
    init();
  }, []);

  // Check for returning user after splash
  const checkReturningUser = useCallback(async () => {
    if (!browserFingerprint) return;
    
    setCurrentStep('loading');
    
    try {
      const result = await identifyUser(browserFingerprint);
      
      if (result.user && result.isReturningUser) {
        setCurrentUser(result.user);
        setIsReturningUser(true);
        setUserName(result.user.name);
        setUserEmail(result.user.email);
        storeUserId(result.user.id);
        
        // Create conversation linked to user
        await createConversation(sessionToken, result.user.id);
        
        setCurrentStep('welcome_back');
        
        // Welcome back flow
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const welcomeMsg = EMMA_MESSAGES.welcomeBack(
          result.user.name,
          result.user.visit_count,
          result.user.last_seen_at
        );
        const followUp = EMMA_MESSAGES.welcomeBackFollowUp(result.user.last_seen_at);
        
        await addEmmaMessages([welcomeMsg, followUp], 'main_menu', 'welcome_back', true);
        
      } else {
        // New user flow
        await createConversation(sessionToken);
        setCurrentStep('welcome');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        await addEmmaMessages([EMMA_MESSAGES.welcome[0], EMMA_MESSAGES.intro], 'name', 'hey_there', true);
      }
    } catch (error) {
      console.error('User check failed:', error);
      // Fall back to new user flow
      await createConversation(sessionToken);
      setCurrentStep('welcome');
      await new Promise(resolve => setTimeout(resolve, 300));
      await addEmmaMessages([EMMA_MESSAGES.welcome[0], EMMA_MESSAGES.intro], 'name', 'hey_there', true);
    }
  }, [browserFingerprint, sessionToken, addEmmaMessages]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userInput = input.trim();

    if (currentStep === 'email') {
      if (!isValidEmail(userInput)) {
        setEmailError(true);
        setTimeout(() => setEmailError(false), 2000);
        return;
      }
    }

    setInput('');
    setEmailError(false);

    const userMessageId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMessageId,
      type: 'user',
      content: userInput,
      timestamp: new Date(),
      animate: true,
      delivered: false,
      read: false,
    }]);
    markAsRead(userMessageId);
    
    // Save to DB
    if (sessionToken) {
      saveMessageToDb(sessionToken, 'user', userInput);
    }

    if (currentStep === 'name') {
      const extractedName = extractName(userInput);
      setUserName(extractedName);
      
      setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 600);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      const nameReaction = EMMA_MESSAGES.nameResponse(extractedName);
      await addEmmaMessages([nameReaction, EMMA_MESSAGES.askEmail], 'email', 'cool_name', true);
      
    } else if (currentStep === 'email') {
      setUserEmail(userInput);
      
      // Check if this email belongs to existing user
      try {
        const result = await identifyUser(browserFingerprint, userInput, userName);
        
        if (result.user && result.isReturningUser && !isReturningUser) {
          // They're a returning user on a new device!
          setCurrentUser(result.user);
          setIsReturningUser(true);
          storeUserId(result.user.id);
          
          setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 600);
          
          await new Promise(resolve => setTimeout(resolve, 600));
          await addEmmaMessages([
            `Wait... ${result.user.name}! I remember you! 🎉`,
            `You came back! This is visit #${result.user.visit_count}!`
          ], 'main_menu', 'welcome_back', true);
          
          return;
        } else if (result.user) {
          // New user created
          setCurrentUser(result.user);
          storeUserId(result.user.id);
        }
      } catch (error) {
        console.error('Email check failed:', error);
      }
      
      setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 600);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      await addEmmaMessages([EMMA_MESSAGES.emailResponse, EMMA_MESSAGES.askArrival], 'arrival', 'thank_you', true);
      
    } else if (currentStep === 'free_chat') {
      // Free chat mode - use AI
      setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 600);
      
      setIsTyping(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For now, simple responses - Phase 3 will enhance this
      const responses = [
        "That's interesting! Tell me more about your Tobago experience! 🌴",
        "Love hearing about your adventures! What else is on your mind?",
        "Sounds amazing! Tobago really is special, isn't it? 🌺",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      await addEmmaMessages([randomResponse], 'free_chat');
    }
  };

  // Handle arrival selection
  const handleArrivalSelect = async (arrivalId: string) => {
    const option = ARRIVAL_OPTIONS.find(o => o.id === arrivalId);
    if (!option) return;

    setUserArrival(arrivalId);

    const userMessageId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMessageId,
      type: 'user',
      content: `${option.emoji} ${option.label}`,
      timestamp: new Date(),
      animate: true,
      delivered: false,
      read: false,
    }]);
    markAsRead(userMessageId);
    
    if (sessionToken) {
      saveMessageToDb(sessionToken, 'user', `${option.emoji} ${option.label}`, { 
        message_type: 'selection',
        selection_value: arrivalId 
      });
    }
    
    setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 500);

    await new Promise(resolve => setTimeout(resolve, 600));
    const arrivalReaction = EMMA_MESSAGES.arrivalResponse(arrivalId);
    await addEmmaMessages([arrivalReaction, EMMA_MESSAGES.askRating], 'rating', arrivalId as GifType, true);
  };

  // Handle rating selection
  const handleRatingSelect = async (rating: number) => {
    setUserRating(rating);
    
    const userMessageId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMessageId,
      type: 'user',
      content: `${'⭐'.repeat(rating)} (${rating}/5)`,
      timestamp: new Date(),
      animate: true,
      delivered: false,
      read: false,
    }]);
    markAsRead(userMessageId);
    
    if (sessionToken) {
      saveMessageToDb(sessionToken, 'user', `${rating}/5 stars`, { 
        message_type: 'rating',
        rating_value: rating 
      });
    }

    setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 500);
    
    const gifType: GifType = rating >= 5 ? 'five_stars' : rating >= 4 ? 'good_rating' : 'okay_rating';
    
    await new Promise(resolve => setTimeout(resolve, 600));
    const ratingReaction = EMMA_MESSAGES.ratingResponse(rating);
    await addEmmaMessages([ratingReaction, EMMA_MESSAGES.askActivities], 'activities', gifType, true);
  };

  // Handle activity selection
  const handleActivitySelect = async (activityId: string) => {
    const option = ACTIVITY_OPTIONS.find(o => o.id === activityId);
    if (!option) return;

    const userMessageId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMessageId,
      type: 'user',
      content: `${option.emoji} ${option.label}`,
      timestamp: new Date(),
      animate: true,
      delivered: false,
      read: false,
    }]);
    markAsRead(userMessageId);
    
    if (sessionToken) {
      saveMessageToDb(sessionToken, 'user', `${option.emoji} ${option.label}`, { 
        message_type: 'selection',
        selection_value: activityId 
      });
    }
    
    setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 500);
    
    await new Promise(resolve => setTimeout(resolve, 600));
    const activityReaction = EMMA_MESSAGES.activityResponse(activityId);
    await addEmmaMessages([activityReaction, `Have an amazing time, ${userName}! 🌴`], 'complete', activityId as GifType, true);
    
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);

    // Save survey to database
    try {
      await fetch('/api/emma/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionToken,
          name: userName,
          email: userEmail,
          arrival_method: userArrival,
          journey_rating: userRating,
          activity_interest: activityId,
        }),
      });
      console.log('✅ Survey saved!');
      
      // Save memory about their preferences
      if (currentUser) {
        await saveMemory(currentUser.id, {
          memory_type: 'preference',
          category: activityId,
          raw_text: `Interested in ${option.label}`,
          sentiment: 'positive',
          importance: 7,
        });
      }
    } catch (error) {
      console.error('Failed to save survey:', error);
    }
  };

  // Handle main menu selection (returning users)
  const handleMainMenuSelect = async (menuId: string) => {
    const option = MAIN_MENU_OPTIONS.find(o => o.id === menuId);
    if (!option) return;

    const userMessageId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMessageId,
      type: 'user',
      content: `${option.emoji} ${option.label}`,
      timestamp: new Date(),
      animate: true,
      delivered: false,
      read: false,
    }]);
    markAsRead(userMessageId);

    setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 500);

    switch (menuId) {
      case 'rate':
        await new Promise(resolve => setTimeout(resolve, 600));
        await addEmmaMessages([
          "Let's hear about your experience! 🌟",
          "What did you check out? A restaurant, beach, activity...?"
        ], 'rating_flow', 'excited', true);
        break;
        
      case 'recommend':
        await new Promise(resolve => setTimeout(resolve, 600));
        await addEmmaMessages([
          "I love helping with recommendations! 🗺️",
          "What are you in the mood for today?"
        ], 'activities', 'excited', true);
        break;
        
      case 'chat':
        await new Promise(resolve => setTimeout(resolve, 600));
        await addEmmaMessages([
          "I'm all ears! 💬",
          "What's on your mind? How's your Tobago adventure going?"
        ], 'free_chat', 'excited', true);
        break;
        
      case 'help':
        await new Promise(resolve => setTimeout(resolve, 600));
        await addEmmaMessages([
          "I'm here to help! 🆘",
          "What do you need? Directions, emergency info, recommendations?"
        ], 'free_chat', 'excited', true);
        break;
    }
  };

  // Get placeholder text
  const getPlaceholder = () => {
    switch (currentStep) {
      case 'name': return 'Type your name...';
      case 'email': return 'your@email.com';
      case 'free_chat': return 'Chat with Emma...';
      case 'rating_flow': return 'Describe what you visited...';
      default: return 'Type a message...';
    }
  };

  // Check if input should be disabled
  const isInputDisabled = isTyping || 
    currentStep === 'arrival' || 
    currentStep === 'rating' || 
    currentStep === 'activities' || 
    currentStep === 'complete' || 
    currentStep === 'welcome' ||
    currentStep === 'welcome_back' ||
    currentStep === 'main_menu' ||
    currentStep === 'splash' ||
    currentStep === 'loading';

  // Get step number for progress
  const getStepNumber = () => {
    const steps: SurveyStep[] = ['name', 'email', 'arrival', 'rating', 'activities'];
    const index = steps.indexOf(currentStep);
    return index >= 0 ? index : (currentStep === 'complete' ? steps.length : -1);
  };

  // Render splash screen
  if (currentStep === 'splash') {
    return <SplashScreen onComplete={checkReturningUser} />;
  }

  // Render loading screen
  if (currentStep === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-sand-50 via-white to-sand-50">
      {showConfetti && <Confetti />}
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-sand-200 safe-area-inset">
        <div className="flex items-center gap-3 px-4 py-3">
          <EmmaAvatar />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              Emma
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Online
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              {isReturningUser ? `Welcome back, ${userName}! 🌴` : 'Your Tobago Welcome Buddy 🌴'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="w-5 h-5 text-sunset animate-spin-slow" />
            <span className="text-lg">🏝️</span>
          </div>
        </div>
      </header>

      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-4 text-6xl opacity-10 animate-float">🌺</div>
        <div className="absolute top-40 right-8 text-4xl opacity-10 animate-float" style={{ animationDelay: '1s' }}>🌴</div>
        <div className="absolute top-60 left-1/4 text-5xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>🐚</div>
        <div className="absolute bottom-40 right-1/4 text-4xl opacity-10 animate-float" style={{ animationDelay: '0.5s' }}>🌊</div>
        <div className="absolute bottom-60 left-12 text-5xl opacity-10 animate-float" style={{ animationDelay: '1.5s' }}>🦜</div>
      </div>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto smooth-scroll px-4 py-4 space-y-4 pb-28">
        <div className="flex justify-center">
          <span className="px-3 py-1 rounded-full bg-sand-100 text-xs text-slate-500 font-medium">
            Today
          </span>
        </div>

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isTyping && <TypingIndicator />}

        {/* Conditional UI elements */}
        {currentStep === 'main_menu' && !isTyping && (
          <MainMenuSelector 
            options={MAIN_MENU_OPTIONS} 
            onSelect={handleMainMenuSelect}
            disabled={isTyping}
          />
        )}

        {currentStep === 'arrival' && !isTyping && (
          <ArrivalSelector 
            options={ARRIVAL_OPTIONS} 
            onSelect={handleArrivalSelect}
            disabled={isTyping}
          />
        )}

        {currentStep === 'rating' && !isTyping && (
          <StarRating 
            onSelect={handleRatingSelect}
            disabled={isTyping}
          />
        )}

        {currentStep === 'activities' && !isTyping && (
          <ActivitySelector 
            options={ACTIVITY_OPTIONS} 
            onSelect={handleActivitySelect}
            disabled={isTyping}
          />
        )}

        {currentStep === 'complete' && !isTyping && (
          <CompletionCard userName={userName} />
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-sand-200 safe-area-bottom">
        <div className="px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            {currentStep === 'email' ? (
              <EmailInput
                value={input}
                onChange={setInput}
                onSubmit={() => handleSubmit()}
                disabled={isInputDisabled}
                error={emailError}
              />
            ) : (
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={getPlaceholder()}
                  disabled={isInputDisabled}
                  className="w-full rounded-full border-2 border-sand-300 bg-sand-50 px-4 h-12 text-[16px] text-slate-700 placeholder:text-slate-400 focus:border-coral focus:ring-2 focus:ring-coral/20 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={isTyping || !input.trim() || isInputDisabled}
              className="h-12 w-12 bg-gradient-to-r from-coral to-sunset text-white rounded-full hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center flex-shrink-0 active:scale-95 shadow-md"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          
          {/* Progress indicator - only show during survey */}
          {getStepNumber() >= 0 && (
            <div className="flex justify-center gap-2 mt-3">
              {['name', 'email', 'arrival', 'rating', 'activities'].map((step, index) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    getStepNumber() === index
                      ? 'w-8 bg-gradient-to-r from-coral to-sunset'
                      : getStepNumber() > index || currentStep === 'complete'
                      ? 'w-4 bg-palm'
                      : 'w-4 bg-sand-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plane, Ship, Waves, Sparkles, Heart, Sun, Star, Check, CheckCheck, ChevronRight, PartyPopper, TreePalm, Umbrella, Music, Camera, Utensils, Mail, AlertCircle } from 'lucide-react';

// AI Response helper - fetches personalized responses from Emma
type AIResponseType = 'name_reaction' | 'email_thanks' | 'arrival_reaction' | 'rating_reaction' | 'activity_tip' | 'farewell';

interface AIContext {
  name?: string;
  email?: string;
  arrivalMethod?: 'plane' | 'cruise' | 'ferry';
  rating?: number;
  activity?: 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos';
}

// GIF types matching our API
type GifType = 'welcome' | 'name_reaction' | 'thank_you' | 'excited' | 'travel' | 'plane' | 'cruise' | 'ferry' | 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos' | 'five_stars' | 'good_rating' | 'okay_rating' | 'farewell';

interface GifData {
  url: string;
  width: string;
  height: string;
  title: string;
}

// Fetch a GIF reaction with timeout
async function getReactionGif(type: GifType): Promise<GifData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`/api/emma/gif?type=${type}&random=true`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.error || !data.url) return null;
    
    return data;
  } catch (error) {
    console.error('GIF fetch error:', error);
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
    // Fallback responses - simple and human
    const fallbacks: Record<AIResponseType, string> = {
      name_reaction: `Nice to meet you, ${context.name}!`,
      email_thanks: "Got it, thanks!",
      arrival_reaction: "What a wonderful way to arrive in paradise! 🏝️",
      rating_reaction: "Thanks for sharing! Tobago is about to amaze you! 🌴",
      activity_tip: "You're going to love exploring our beautiful island!",
      farewell: "Have the most incredible time in Tobago! 🌺",
    };
    return fallbacks[type];
  }
}

// Survey steps
type SurveyStep = 'splash' | 'welcome' | 'name' | 'email' | 'arrival' | 'rating' | 'activities' | 'complete';

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

const TIPS = [
  { emoji: '🥥', text: 'Try fresh coconut water from a street vendor!' },
  { emoji: '🐢', text: 'Visit Turtle Beach to see leatherback turtles!' },
  { emoji: '🌅', text: 'Pigeon Point has the most stunning sunsets!' },
  { emoji: '🎶', text: "Don't miss Sunday School in Buccoo!" },
];

// Email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Extract name from various formats
function extractName(input: string): string {
  const lowered = input.toLowerCase().trim();
  
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

// Emma's personality messages
const EMMA_MESSAGES = {
  welcome: [
    "Hey there! 🌴",
    "I'm Emma, your personal Tobago welcome buddy!",
    "Welcome to paradise! 🏝️ Before we get started on your amazing island adventure, let's have a quick chat!",
  ],
  askName: "What's your name, lovely traveler? ✨",
  nameResponse: (name: string) => [
    `${name}! 💕`,
    "What a beautiful name! So wonderful to meet you!",
  ],
  askEmail: "Mind sharing your email? I'll send you some exclusive island tips! 📧✨",
  invalidEmail: "Oops! 😅 That doesn't look quite right. Can you double-check your email?",
  emailResponse: "Perfect! Get ready for some tropical goodness in your inbox! 🌺",
  askArrival: "So tell me... how did you arrive at our beautiful island? 🏝️",
  arrivalResponse: (method: string) => {
    const responses: Record<string, string[]> = {
      plane: ["Ooh, flying in! ✈️", "I bet that aerial view of our turquoise waters was breathtaking!"],
      cruise: ["A cruise! How luxurious! 🚢", "There's nothing quite like sailing into Scarborough harbour!"],
      ferry: ["The ferry experience! ⛴️", "That sea breeze must have been refreshing!"],
    };
    return responses[method] || ["Wonderful! Welcome to Tobago!"];
  },
  askRating: "Quick question! How would you rate your journey getting here? ⭐",
  ratingResponse: (rating: number) => {
    if (rating >= 4) {
      return ["Amazing! So glad you had a smooth journey! 🎉", "That's the Tobago way - good vibes only! ✨"];
    } else if (rating >= 3) {
      return ["Thanks for sharing! 🙏", "Well, now the REAL adventure begins! 🌴"];
    } else {
      return ["Oh no! Sorry to hear that! 😔", "But don't worry - Tobago is about to make it all better! 💪🌺"];
    }
  },
  askActivities: "What are you MOST excited to experience in Tobago? 🤩",
  activityResponse: (activity: string) => {
    const responses: Record<string, string[]> = {
      beach: ["Beach lover! 🏖️", "You're in for a treat - Pigeon Point and Store Bay are absolute paradise!"],
      adventure: ["An adventurer! 🌴", "The Main Ridge Forest Reserve is calling your name - oldest protected rainforest in the Western Hemisphere!"],
      food: ["A foodie! 🍽️", "Crab & dumpling, bake & shark, fresh coconut water... your taste buds will thank you!"],
      nightlife: ["Party time! 🎵", "Buccoo and Crown Point have the best vibes - especially on Sunday School nights!"],
      photos: ["A photographer! 📸", "Tobago is SO photogenic - every corner is Instagram-worthy!"],
    };
    return responses[activity] || ["Great choice! You're going to have an amazing time!"];
  },
  complete: [
    "You're officially ready for Tobago! 🎊",
    "I hope you have the most INCREDIBLE time here!",
    "Remember: Lime slow, enjoy the journey, and soak up every moment! 🌅",
  ],
};

// Splash screen component
function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-coral via-sunset to-palm overflow-hidden">
      {/* Animated background elements */}
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
      
      {/* Main content */}
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
      
      {/* Wave decoration at bottom */}
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

// Confetti component
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

// Emma avatar component - Uses AI-generated Black female avatar
// Replace this URL with your own AI-generated avatar at public/emma-avatar.png
const EMMA_AVATAR_URL = 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face';

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
            // Fallback to gradient with emoji if image fails to load
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

// Typing indicator
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

// Tip bubble component
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

// Animated heart reaction component - positioned on bottom-left of user messages
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
      className={`absolute -bottom-3 ${isUser ? '-left-3' : '-right-3'} animate-heart-pop z-10`}
    >
      <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
        <Heart className="w-4 h-4 text-white fill-white" />
      </div>
    </div>
  );
}

// GIF message component with loading state
function GifMessage({ url, title }: { url: string; title?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  if (error) return null; // Don't show anything if GIF fails to load
  
  return (
    <div className="flex items-end gap-3 animate-message-appear">
      <EmmaAvatar />
      <div className="max-w-[70%] rounded-2xl overflow-hidden shadow-lg border-2 border-sand-200 bg-sand-100">
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
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
}

// Message bubble component
function MessageBubble({ message }: { message: Message }) {
  const isEmma = message.type === 'emma';
  const isUser = message.type === 'user';
  const isCelebration = message.type === 'celebration';
  const isTip = message.type === 'tip';
  const isGif = message.type === 'gif';
  const [showReaction, setShowReaction] = useState(false);

  // Animate reaction appearing
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
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''} ${
        message.animate ? 'animate-message-appear' : ''
      }`}
    >
      {isEmma && <EmmaAvatar />}
      
      <div className={`relative ${isUser ? 'max-w-[80%]' : 'max-w-[80%]'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-sm ${
            isUser
              ? 'bg-gradient-to-r from-ocean to-ocean-dark text-white rounded-br-sm'
              : 'bg-white border border-sand-200 rounded-bl-sm'
          }`}
        >
          <p className={`text-[15px] leading-relaxed ${isUser ? 'text-white' : 'text-slate-700'}`}>
            {message.content}
          </p>
          <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : ''}`}>
            <span className={`text-[10px] ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isUser && (
              <span className="text-white/70">
                {message.read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-ocean-dark" />
                ) : message.delivered ? (
                  <CheckCheck className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </div>
        </div>
        
        {/* Heart reaction - positioned on left for user messages */}
        {isUser && <HeartReaction show={showReaction && message.reaction === 'heart'} isUser={true} />}
      </div>
    </div>
  );
}

// Star rating component
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

// Arrival options selector - Premium card buttons
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
              {/* Shimmer effect */}
              <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ${selected === option.id ? 'translate-x-full' : ''}`} />
              
              <span className={`text-4xl transition-transform duration-300 ${selected === option.id ? 'scale-110 animate-bounce' : 'group-hover:scale-110'}`}>
                {option.emoji}
              </span>
              <span className={`text-xs font-semibold transition-colors ${
                selected === option.id ? 'text-white' : 'text-slate-600 group-hover:text-white'
              }`}>
                {option.label}
              </span>
              
              {/* Check mark when selected */}
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

// Activity options selector (multiple choice) - Premium list buttons
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
                {/* Hover gradient overlay */}
                {selected !== option.id && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                )}
                
                {/* Shimmer effect */}
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
                
                {/* Check mark or arrow */}
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

// Completion celebration component
function CompletionCard({ userName }: { userName: string }) {
  return (
    <div className="flex justify-center py-6 animate-scale-in">
      <div className="relative flex flex-col items-center gap-4 px-8 py-6 rounded-3xl bg-gradient-to-br from-coral/10 via-sunset/10 to-palm/10 border border-coral/20 shadow-xl overflow-hidden">
        {/* Animated background decorations */}
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

// Email input with validation
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

export default function EmmaChat() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Mark messages as read after a delay
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

  // Add Emma messages with typing delay - includes GIF when 2+ messages
  const addEmmaMessages = useCallback(async (
    contents: string[], 
    nextStep?: SurveyStep,
    gifType?: GifType
  ) => {
    setIsTyping(true);
    
    // Filter out empty or emoji-only messages
    const validContents = contents.filter(c => {
      if (!c || c.trim().length === 0) return false;
      // Skip if it's just 1-2 characters (likely just an emoji)
      if (c.trim().length <= 2) return false;
      return true;
    });
    
    if (validContents.length === 0) {
      setIsTyping(false);
      if (nextStep) setCurrentStep(nextStep);
      return;
    }
    
    // If 2+ messages, insert a GIF after the first message
    const shouldShowGif = validContents.length >= 2 || gifType;
    let gifInserted = false;
    
    for (let i = 0; i < validContents.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      
      setMessages(prev => [...prev, {
        id: `emma-${Date.now()}-${i}`,
        type: 'emma',
        content: validContents[i],
        timestamp: new Date(),
        animate: true,
      }]);
      
      // Insert GIF after first message if we have multiple messages
      if (shouldShowGif && i === 0 && !gifInserted) {
        gifInserted = true;
        setIsTyping(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Determine GIF type based on context or provided type
        const gType = gifType || (nextStep === 'name' ? 'welcome' : 
                                  nextStep === 'email' ? 'excited' :
                                  nextStep === 'arrival' ? 'travel' :
                                  nextStep === 'rating' ? 'excited' :
                                  nextStep === 'activities' ? 'excited' :
                                  nextStep === 'complete' ? 'farewell' : 'excited');
        
        const gif = await getReactionGif(gType);
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
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
    
    setIsTyping(false);
    
    if (nextStep) {
      setCurrentStep(nextStep);
    }
    
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Add celebration message
  const addCelebration = useCallback(async (content: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setMessages(prev => [...prev, {
      id: `celebration-${Date.now()}`,
      type: 'celebration',
      content,
      timestamp: new Date(),
      animate: true,
    }]);
  }, []);

  // Add tip message
  const addTip = useCallback(async (tip: { emoji: string; text: string }) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    setMessages(prev => [...prev, {
      id: `tip-${Date.now()}`,
      type: 'tip',
      content: tip.text,
      timestamp: new Date(),
      animate: true,
    }]);
  }, []);

  // Initialize welcome sequence after splash
  const startChat = useCallback(async () => {
    setCurrentStep('welcome');
    await new Promise(resolve => setTimeout(resolve, 300));
    await addEmmaMessages(EMMA_MESSAGES.welcome);
    await new Promise(resolve => setTimeout(resolve, 500));
    await addEmmaMessages([EMMA_MESSAGES.askName], 'name');
  }, [addEmmaMessages]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Handle user input submission
  // Helper to add a heart reaction to a message
  const addReactionToMessage = (messageId: string, reaction: 'heart' | 'like' | 'fire' | 'clap') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, reaction } : msg
    ));
  };

  // Helper to add a GIF message
  const addGifMessage = async (gifType: GifType) => {
    const gif = await getReactionGif(gifType);
    if (gif) {
      const gifMessage: Message = {
        id: `gif-${Date.now()}`,
        type: 'gif',
        content: gif.title,
        gifUrl: gif.url,
        timestamp: new Date(),
        animate: true,
      };
      setMessages(prev => [...prev, gifMessage]);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userInput = input.trim();

    // Email validation
    if (currentStep === 'email') {
      if (!isValidEmail(userInput)) {
        setEmailError(true);
        setTimeout(() => setEmailError(false), 2000);
        return;
      }
    }

    setInput('');
    setEmailError(false);

    // Add user message
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

    // Process based on current step
    if (currentStep === 'name') {
      const extractedName = extractName(userInput);
      setUserName(extractedName);
      
      // Add heart reaction to their name message
      setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 600);
      
      // Get AI-personalized response and ask for email together (with GIF)
      await new Promise(resolve => setTimeout(resolve, 800));
      const aiReaction = await getEmmaAIResponse('name_reaction', { name: extractedName });
      await addEmmaMessages([aiReaction, EMMA_MESSAGES.askEmail], 'email', 'name_reaction');
      
    } else if (currentStep === 'email') {
      setUserEmail(userInput);
      
      // Add heart reaction to their email
      setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 600);
      
      // Get AI-personalized email thanks with arrival question (with GIF)
      await new Promise(resolve => setTimeout(resolve, 800));
      const aiThanks = await getEmmaAIResponse('email_thanks', { name: userName, email: userInput });
      await addEmmaMessages([aiThanks, EMMA_MESSAGES.askArrival], 'arrival', 'thank_you');
    }
  };

  // Handle arrival option selection
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
    
    // Add heart reaction to their selection
    setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 500);

    // Get AI-personalized arrival reaction + rating question (with travel GIF)
    await new Promise(resolve => setTimeout(resolve, 700));
    const aiArrivalReaction = await getEmmaAIResponse('arrival_reaction', { 
      name: userName, 
      arrivalMethod: arrivalId as 'plane' | 'cruise' | 'ferry' 
    });
    await addEmmaMessages([aiArrivalReaction, EMMA_MESSAGES.askRating], 'rating', arrivalId as GifType);
  };

  // Handle star rating
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

    // Add heart reaction
    setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 500);
    
    // Determine GIF type based on rating
    const gifType: GifType = rating >= 5 ? 'five_stars' : rating >= 4 ? 'good_rating' : 'okay_rating';
    
    // Get AI-personalized rating reaction + activities question (with rating GIF)
    await new Promise(resolve => setTimeout(resolve, 700));
    const aiRatingReaction = await getEmmaAIResponse('rating_reaction', { 
      name: userName, 
      rating 
    });
    await addEmmaMessages([aiRatingReaction, EMMA_MESSAGES.askActivities], 'activities', gifType);
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
    
    // Add heart reaction
    setTimeout(() => addReactionToMessage(userMessageId, 'heart'), 500);
    
    // Get AI-personalized activity tip + farewell (with activity GIF then farewell GIF)
    await new Promise(resolve => setTimeout(resolve, 700));
    const aiActivityTip = await getEmmaAIResponse('activity_tip', { 
      name: userName, 
      activity: activityId as 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos',
      arrivalMethod: userArrival as 'plane' | 'cruise' | 'ferry'
    });
    
    const aiFarewell = await getEmmaAIResponse('farewell', { 
      name: userName, 
      activity: activityId as 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos',
      arrivalMethod: userArrival as 'plane' | 'cruise' | 'ferry'
    });
    
    // Send activity tip with activity-themed GIF
    await addEmmaMessages([aiActivityTip, aiFarewell], 'complete', activityId as GifType);
    
    // Show confetti!
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);

    // Save survey to database
    try {
      const response = await fetch('/api/emma/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: crypto.randomUUID(),
          name: userName,
          email: userEmail,
          arrival_method: userArrival,
          journey_rating: userRating,
          activity_interest: activityId,
        }),
      });
      
      if (response.ok) {
        console.log('✅ Survey saved successfully!');
      } else {
        const data = await response.json();
        console.log('Survey save response:', data);
      }
    } catch (error) {
      console.error('Failed to save survey:', error);
    }
  };

  // Get placeholder text based on step
  const getPlaceholder = () => {
    switch (currentStep) {
      case 'name': return 'Type your name...';
      case 'email': return 'your@email.com';
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
    currentStep === 'splash';

  // Get step number for progress indicator
  const getStepNumber = () => {
    const steps: SurveyStep[] = ['name', 'email', 'arrival', 'rating', 'activities'];
    const index = steps.indexOf(currentStep);
    return index >= 0 ? index : (currentStep === 'complete' ? steps.length : 0);
  };

  // Show splash screen
  if (currentStep === 'splash') {
    return <SplashScreen onComplete={startChat} />;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-sand-50 via-white to-sand-50">
      {/* Confetti */}
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
            <p className="text-xs text-slate-500">Your Tobago Welcome Buddy 🌴</p>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="w-5 h-5 text-sunset animate-spin-slow" />
            <span className="text-lg">🏝️</span>
          </div>
        </div>
      </header>

      {/* Chat Background Pattern */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-4 text-6xl opacity-10 animate-float">🌺</div>
        <div className="absolute top-40 right-8 text-4xl opacity-10 animate-float" style={{ animationDelay: '1s' }}>🌴</div>
        <div className="absolute top-60 left-1/4 text-5xl opacity-10 animate-float" style={{ animationDelay: '2s' }}>🐚</div>
        <div className="absolute bottom-40 right-1/4 text-4xl opacity-10 animate-float" style={{ animationDelay: '0.5s' }}>🌊</div>
        <div className="absolute bottom-60 left-12 text-5xl opacity-10 animate-float" style={{ animationDelay: '1.5s' }}>🦜</div>
      </div>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto smooth-scroll px-4 py-4 space-y-4 pb-28">
        {/* Date separator */}
        <div className="flex justify-center">
          <span className="px-3 py-1 rounded-full bg-sand-100 text-xs text-slate-500 font-medium">
            Today
          </span>
        </div>

        {/* Messages */}
        {messages.map((message) => (
          <MessageBubble 
            key={message.id} 
            message={message}
          />
        ))}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}

        {/* Arrival options */}
        {currentStep === 'arrival' && !isTyping && (
          <ArrivalSelector 
            options={ARRIVAL_OPTIONS} 
            onSelect={handleArrivalSelect}
            disabled={isTyping}
          />
        )}

        {/* Star rating */}
        {currentStep === 'rating' && !isTyping && (
          <StarRating 
            onSelect={handleRatingSelect}
            disabled={isTyping}
          />
        )}

        {/* Activity options */}
        {currentStep === 'activities' && !isTyping && (
          <ActivitySelector 
            options={ACTIVITY_OPTIONS} 
            onSelect={handleActivitySelect}
            disabled={isTyping}
          />
        )}

        {/* Completion celebration */}
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
          
          {/* Step indicator */}
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
        </div>
      </footer>
    </div>
  );
}

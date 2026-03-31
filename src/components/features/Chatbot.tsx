import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User,
  Minimize2,
  Maximize2,
  Loader2,
  History,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { ChatMessage } from '@/types';

const API_URL = 'http://localhost:3000/api';

interface ChatSession {
  id: string;
  preview: string;
  messages: ChatMessage[];
  timestamp: string;
}

const DEFAULT_WELCOME: ChatMessage = {
  id: '1',
  role: 'assistant',
  content: '🙏 Namaste! I\'m your NHMS Virtual Assistant.\n\nI can help you with:\n🛣️ Routes — "route from Mumbai to Pune"\n💰 Toll rates & costs\n🚗 Speed limits\n🚨 Emergency contacts\n📱 FASTag info\n\nJust ask me anything!',
  timestamp: new Date(),
};

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'history'>('chat');
  
  const [messages, setMessages] = useState<ChatMessage[]>([{ ...DEFAULT_WELCOME }]);
  
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('nhms_chat_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('nhms_chat_sessions', JSON.stringify(chatSessions));
  }, [chatSessions]);

  // Continuously sync active chat to history if user has sent messages
  useEffect(() => {
    if (messages.length > 1) {
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (!firstUserMessage) return;
      
      const sessionId = firstUserMessage.id;
      const preview = firstUserMessage.content.length > 30 
        ? firstUserMessage.content.substring(0, 30) + '...' 
        : firstUserMessage.content;
      
      setChatSessions(prev => {
        const existingIndex = prev.findIndex(s => s.id === sessionId);
        const sessionData: ChatSession = {
          id: sessionId,
          preview,
          messages: messages,
          timestamp: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
          // Update existing session
          const newSessions = [...prev];
          newSessions[existingIndex] = sessionData;
          return newSessions;
        } else {
          // Add new session to top
          return [sessionData, ...prev];
        }
      });
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current && currentView === 'chat') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, currentView]);

  const sendToBackend = useCallback(async (userMessage: string): Promise<string> => {
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send history for context (last 10 messages max)
        body: JSON.stringify({ 
          message: userMessage, 
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })) 
        }),
      });
      const data = await response.json();
      if (data.success && data.reply) {
        return data.reply;
      }
      return 'Sorry, I could not process that. Try asking about routes, tolls, or emergencies.';
    } catch (error) {
      console.error('Chat API error:', error);
      return 'I\'m having trouble connecting to the server. Please make sure the backend is running on port 3000.\n\nIn the meantime, dial 1033 for highway helpline support.';
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsTyping(true);

    const reply = await sendToBackend(userInput);

    const botResponse: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: reply,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, botResponse]);
    setIsTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    // Session is automatically saved into history by our useEffect
    
    // Reset state for next open
    setMessages([{ ...DEFAULT_WELCOME, timestamp: new Date() }]);
    setCurrentView('chat');
    setIsOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    // Convert string timestamps back to Date objects
    const restoredMessages = session.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
    setMessages(restoredMessages);
    setCurrentView('chat');
  };

  const clearHistory = () => {
    setChatSessions([]);
    localStorage.removeItem('nhms_chat_sessions');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-primary to-accent text-white rounded-full shadow-2xl hover:shadow-glow-primary transition-all duration-300 flex items-center justify-center z-50 hover:scale-110 group"
        aria-label="Open chat assistant"
      >
        <MessageCircle className="w-7 h-7 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 bg-card rounded-2xl shadow-2xl border border-border/50 z-50 transition-all duration-300 backdrop-blur-xl ${
        isMinimized ? 'w-80 h-14' : 'w-80 sm:w-96 h-[520px] flex flex-col'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/90 rounded-t-2xl shrink-0">
        <div className="flex items-center gap-3">
          {currentView === 'history' ? (
            <button 
              onClick={() => setCurrentView('chat')}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-colors text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h3 className="text-white font-bold text-sm">
              {currentView === 'history' ? 'Chat History' : 'NHMS Assistant'}
            </h3>
            {currentView === 'chat' && (
              <p className="text-white/70 text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse" />
                GenAI Active — Real Data
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {currentView === 'chat' && (
            <button
              onClick={() => setCurrentView('history')}
              title="View History"
              className="p-1.5 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10 hidden sm:block"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && currentView === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm border border-border/30'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <span className="text-[10px] opacity-50 mt-1 block text-right">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                      <User className="w-4 h-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2 justify-start animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 border border-border/30">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border/50 shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about routes, tolls, safety..."
                className="flex-1 text-sm rounded-full bg-muted/50 border-border/50 focus:ring-primary"
                disabled={isTyping}
              />
              <Button 
                onClick={handleSend} 
                size="icon" 
                disabled={isTyping || !input.trim()}
                className="rounded-full bg-primary hover:bg-primary/90 shrink-0 w-10 h-10"
              >
                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isMinimized && currentView === 'history' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {chatSessions.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-10">
                  <p>No past chat sessions found.</p>
                </div>
              ) : (
                chatSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className="w-full text-left p-4 rounded-xl border border-border/50 hover:bg-accent/5 hover:border-accent/30 transition-all flex flex-col gap-2 group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="font-semibold text-sm text-foreground line-clamp-1">{session.preview}</h4>
                      <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {session.messages.length} messages
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          
          {chatSessions.length > 0 && (
            <div className="p-3 border-t border-border/50 shrink-0 flex justify-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearHistory}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs w-full flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear All History
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

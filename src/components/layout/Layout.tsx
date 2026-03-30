import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { Chatbot } from '@/components/features/Chatbot';
import { BroadcastBanner } from './BroadcastBanner';

interface LayoutProps {
  children: ReactNode;
  showChatbot?: boolean;
}

export function Layout({ children, showChatbot = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BroadcastBanner />
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      {showChatbot && <Chatbot />}
    </div>
  );
}

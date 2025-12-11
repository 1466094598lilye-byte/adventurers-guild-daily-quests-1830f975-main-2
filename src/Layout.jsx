import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Scroll, BookOpen, Gem, User, LogIn } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/components/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { auth } from "@/api/auth";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { initAudioManager } from "@/components/AudioManager";

function LayoutContent({ children }) {
  const location = useLocation();
  const { t } = useLanguage();



  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        return await auth.me();
      } catch (error) {
        return null;
      }
    },
    retry: false,
    staleTime: 10000,
  });

  const tabs = [
    { name: 'QuestBoard', label: t('nav_questboard'), icon: Scroll },
    { name: 'Journal', label: t('nav_journal'), icon: BookOpen },
    { name: 'Treasures', label: t('nav_treasures'), icon: Gem },
    { name: 'Profile', label: t('nav_profile'), icon: User }
  ];

  const isActive = (pageName) => {
    return location.pathname === createPageUrl(pageName);
  };

  const handleLogin = () => {
    auth.signInWithGoogle().catch(console.error);
  };



  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F9FAFB' }}>
        {/* Guest Mode Warning Banner */}
        {!user && (
          <div 
            className="w-full py-3 px-4 flex items-center justify-between gap-3 sticky top-0 z-40"
            style={{
              backgroundColor: '#FFE66D',
              borderBottom: '5px solid #000',
              boxShadow: '0 5px 0px rgba(0,0,0,0.1)'
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm uppercase leading-tight">
                  {t('guest_mode_warning_title')}
                </p>
                <p className="font-bold text-xs leading-tight mt-0.5" style={{ color: '#666' }}>
                  {t('guest_mode_warning_subtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogin}
              className="flex-shrink-0 px-4 py-2 font-black uppercase text-sm flex items-center gap-2"
              style={{
                backgroundColor: '#4ECDC4',
                border: '3px solid #000',
                boxShadow: '3px 3px 0px #000'
              }}
            >
              <LogIn className="w-4 h-4" strokeWidth={3} />
              {t('login_button')}
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 pb-20">
          {children}
        </div>

        {/* Bottom Navigation */}
        <nav 
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{
            backgroundColor: '#000',
            borderTop: '5px solid #FFE66D'
          }}
        >
          <div className="max-w-2xl mx-auto flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.name);
              
              return (
                <Link
                  key={tab.name}
                  to={createPageUrl(tab.name)}
                  className="flex-1 py-3 flex flex-col items-center gap-1 transition-all"
                  style={{
                    backgroundColor: active ? '#FFE66D' : 'transparent',
                    borderLeft: active ? '3px solid #000' : 'none',
                    borderRight: active ? '3px solid #000' : 'none',
                  }}
                >
                  <Icon 
                    className="w-6 h-6" 
                    strokeWidth={3}
                    style={{ color: active ? '#000' : '#FFE66D' }}
                  />
                  <span 
                    className="text-xs font-black uppercase"
                    style={{ color: active ? '#000' : '#FFE66D' }}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Neo-Brutalism Global Styles */}
        <style>{`
          * {
            -webkit-tap-highlight-color: transparent;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            overflow-x: hidden;
          }

          input, textarea, button {
            outline: none;
          }

          input:focus, textarea:focus {
            outline: 3px solid #FF6B35;
            outline-offset: 2px;
          }

          button:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0px #000 !important;
          }

          ::selection {
            background: #FFE66D;
            color: #000;
          }

          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: #F0F0F0;
          }

          ::-webkit-scrollbar-thumb {
            background: #000;
            border: 2px solid #FFE66D;
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
}

export default function Layout({ children }) {
  return (
    <LanguageProvider>
      <LayoutContent children={children} />
    </LanguageProvider>
  );
}
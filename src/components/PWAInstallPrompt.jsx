import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageContext';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const { language, t } = useLanguage();

  useEffect(() => {
    // 检查是否已经安装
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // 已经安装，不显示提示
    }

    // 监听 beforeinstallprompt 事件
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // 显示安装提示
    deferredPrompt.prompt();
    
    // 等待用户响应
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('用户接受了安装提示');
    } else {
      console.log('用户拒绝了安装提示');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // 保存到 localStorage，24小时内不再显示
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // 检查是否在24小时内已关闭过
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const now = Date.now();
      const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
      
      if (hoursSinceDismissed < 24) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
      style={{
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      <div
        className="p-4 rounded-lg shadow-lg"
        style={{
          backgroundColor: '#9B59B6',
          border: '4px solid #000',
          boxShadow: '8px 8px 0px #000'
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-black text-white text-lg mb-2 uppercase">
              {language === 'zh' ? '📱 安装应用' : '📱 Install App'}
            </h3>
            <p className="text-white text-sm font-bold mb-3">
              {language === 'zh' 
                ? '将应用安装到设备，支持离线使用和快速访问！' 
                : 'Install the app on your device for offline use and quick access!'}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                className="flex-1 gap-2 font-black uppercase"
                style={{
                  backgroundColor: '#FFE66D',
                  color: '#000',
                  border: '3px solid #000'
                }}
              >
                <Download className="w-4 h-4" />
                {language === 'zh' ? '安装' : 'Install'}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="outline"
                className="px-3"
                style={{
                  backgroundColor: 'transparent',
                  color: '#FFF',
                  border: '2px solid #FFF'
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}


import { Shield, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageContext';

export default function StreakBreakDialog({ 
  incompleteDays, 
  currentStreak, 
  freezeTokenCount,
  onUseToken, 
  onBreakStreak,
  onClose 
}) {
  const { t, language } = useLanguage();

  const hasToken = freezeTokenCount > 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
    >
      <div 
        className="relative max-w-lg w-full p-8 transform"
        style={{
          backgroundColor: '#FF6B35',
          border: '6px solid #000',
          boxShadow: '15px 15px 0px #000'
        }}
      >
        {/* 关闭按钮 - 只在有冻结券时显示 */}
        {hasToken && (
          <button
            onClick={onClose}
            className="absolute -top-4 -right-4 w-12 h-12 flex items-center justify-center"
            style={{
              backgroundColor: '#000',
              border: '4px solid #FFE66D',
              boxShadow: '5px 5px 0px #FFE66D'
            }}
          >
            <X className="w-7 h-7" style={{ color: '#FFE66D' }} strokeWidth={4} />
          </button>
        )}

        <div className="text-center">
          <div className="mb-6">
            <AlertTriangle className="w-20 h-20 mx-auto text-white animate-pulse" strokeWidth={3} />
          </div>

          <h2 
            className="text-3xl font-black uppercase mb-4 text-white"
            style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.3)' }}
          >
            {language === 'zh' ? '⚠️ 连胜中断警告 ⚠️' : '⚠️ Streak Break Warning ⚠️'}
          </h2>

          <div 
            className="mb-6 p-4"
            style={{
              backgroundColor: '#FFF',
              border: '4px solid #000'
            }}
          >
            <p className="font-black text-xl mb-3" style={{ color: '#FF6B35' }}>
              {language === 'zh' 
                ? `${incompleteDays}天有未完成任务` 
                : `${incompleteDays} day(s) with incomplete tasks`}
            </p>
            <p className="font-bold text-sm mb-4">
              {language === 'zh'
                ? `你的 ${currentStreak} 天连胜即将中断！`
                : `Your ${currentStreak}-day streak is about to break!`}
            </p>

            {hasToken ? (
              <>
                <div 
                  className="mb-4 p-3"
                  style={{
                    backgroundColor: '#4ECDC4',
                    border: '3px solid #000'
                  }}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Shield className="w-6 h-6" strokeWidth={3} />
                    <p className="font-black">
                      {language === 'zh' ? '可用冻结券' : 'Available Freeze Tokens'}: {freezeTokenCount}
                    </p>
                  </div>
                  <p className="text-sm font-bold">
                    {language === 'zh'
                      ? '使用1个冻结券可以保护你的连胜不中断'
                      : 'Use 1 Freeze Token to protect your streak'}
                  </p>
                </div>

                <div className="space-y-2 text-left text-sm font-bold">
                  <p>
                    ✓ {language === 'zh' 
                      ? '使用冻结券：连胜保持不变' 
                      : 'Use Token: Streak remains intact'}
                  </p>
                  <p>
                    ✗ {language === 'zh' 
                      ? '不使用：连胜清零重新开始' 
                      : 'Don\'t Use: Streak resets to 0'}
                  </p>
                </div>
              </>
            ) : (
              <div 
                className="p-3"
                style={{
                  backgroundColor: '#FFE66D',
                  border: '3px solid #000'
                }}
              >
                <p className="font-black mb-2">
                  {language === 'zh' ? '😢 没有冻结券了' : '😢 No Freeze Tokens'}
                </p>
                <p className="text-sm font-bold">
                  {language === 'zh'
                    ? '你的连胜将重置为 0，继续加油！'
                    : 'Your streak will reset to 0. Keep going!'}
                </p>
              </div>
            )}
          </div>

          {hasToken ? (
            <div className="space-y-3">
              <Button
                onClick={onUseToken}
                className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3"
                style={{
                  backgroundColor: '#4ECDC4',
                  border: '5px solid #000',
                  boxShadow: '6px 6px 0px #000'
                }}
              >
                <Shield className="w-6 h-6" strokeWidth={3} />
                {language === 'zh' ? '使用冻结券保护连胜' : 'Use Token to Protect Streak'}
              </Button>

              <Button
                onClick={onBreakStreak}
                className="w-full py-3 font-bold uppercase flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#C44569',
                  color: '#FFF',
                  border: '4px solid #000',
                  boxShadow: '4px 4px 0px #000'
                }}
              >
                {language === 'zh' ? '不使用，重置连胜' : 'Don\'t Use, Reset Streak'}
              </Button>
            </div>
          ) : (
            <Button
              onClick={onBreakStreak}
              className="w-full py-4 font-black uppercase text-lg"
              style={{
                backgroundColor: '#000',
                color: '#FFF',
                border: '5px solid #FFF',
                boxShadow: '6px 6px 0px #FFF'
              }}
            >
              {language === 'zh' ? '确认，重新开始' : 'Confirm, Start Over'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
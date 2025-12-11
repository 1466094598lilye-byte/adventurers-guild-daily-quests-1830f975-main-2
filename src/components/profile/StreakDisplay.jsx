import { Flame, Award, Shield } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function StreakDisplay({ currentStreak, longestStreak, freezeTokens }) {
  const { t, language } = useLanguage();
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Current Streak */}
      <div 
        className="p-4"
        style={{
          backgroundColor: '#FF6B35',
          border: '4px solid #000',
          boxShadow: '6px 6px 0px #000'
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Flame className="w-6 h-6 text-white" strokeWidth={3} />
          <span className="text-sm font-bold uppercase text-white">
            {t('journal_current_streak')}
          </span>
        </div>
        <p className="text-4xl font-black text-white">{currentStreak}</p>
        <p className="text-sm font-bold text-white">{t('journal_days')}</p>
      </div>

      {/* Longest Streak */}
      <div 
        className="p-4"
        style={{
          backgroundColor: '#C44569',
          border: '4px solid #000',
          boxShadow: '6px 6px 0px #000'
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-6 h-6 text-white" strokeWidth={3} />
          <span className="text-sm font-bold uppercase text-white">
            {t('journal_longest_streak')}
          </span>
        </div>
        <p className="text-4xl font-black text-white">{longestStreak}</p>
        <p className="text-sm font-bold text-white">{t('journal_days')}</p>
      </div>

      {/* Freeze Tokens */}
      <div 
        className="col-span-2 p-4"
        style={{
          backgroundColor: '#4ECDC4',
          border: '4px solid #000',
          boxShadow: '6px 6px 0px #000'
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6" strokeWidth={3} />
            <span className="text-sm font-bold uppercase">
              {t('journal_freeze_tokens')}
            </span>
          </div>
          <p className="text-4xl font-black">{freezeTokens}</p>
        </div>
        <p className="text-xs font-bold">
          {t('journal_freeze_hint')}
        </p>
      </div>
    </div>
  );
}
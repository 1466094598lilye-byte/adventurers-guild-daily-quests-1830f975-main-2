import { useState, useRef } from 'react';
import { Check, MoreVertical, Edit, Trash2, RotateCcw } from 'lucide-react';
import DifficultyBadge from './DifficultyBadge';
import { format } from 'date-fns';
import { useLanguage } from '@/components/LanguageContext';

export default function QuestCard({ quest, onComplete, onEdit, onDelete, onReopen }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);
  const { t } = useLanguage();
  
  const isDone = quest.status === 'done';

  const handleReopen = () => {
    setShowMenu(false);
    setShowConfirm(true);
  };

  const confirmReopen = () => {
    setShowConfirm(false);
    setIsGlowing(true);
    
    // 播放返回待办音效
    const reopenAudio = new Audio('/sounds/大项目删除音效.mp3');
    reopenAudio.play().catch(() => {});
    
    onReopen(quest);
    setTimeout(() => setIsGlowing(false), 500);
  };

  return (
    <>
      <div 
        className="relative mb-3 p-3 transform transition-all hover:translate-x-1 hover:-translate-y-1"
        style={{
          backgroundColor: isDone ? '#F0F0F0' : '#FFF',
          border: '4px solid #000',
          boxShadow: isDone ? '3px 3px 0px #000' : '5px 5px 0px #000',
          transform: `rotate(${Math.random() * 2 - 1}deg)`,
          animation: isGlowing ? 'glow 0.5s ease-in-out' : 'none'
        }}
      >
        <div className="flex gap-2">
          {/* Difficulty Badge - Smaller */}
          <div className="flex-shrink-0">
            <div 
              className="flex items-center justify-center w-10 h-10 font-black text-lg transform -rotate-3"
              style={{
                background: quest.isLongTermProject && quest.difficulty === 'S' 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)'
                  : quest.difficulty === 'S' ? '#000' : quest.difficulty === 'A' ? '#C44569' : quest.difficulty === 'B' ? '#FF6B35' : '#FFE66D',
                color: quest.isLongTermProject && quest.difficulty === 'S' ? '#FFF' : quest.difficulty === 'S' ? '#FFE66D' : '#000',
                border: `3px solid ${quest.difficulty === 'S' && !quest.isLongTermProject ? '#FFE66D' : '#000'}`,
                boxShadow: '3px 3px 0px rgba(0,0,0,1)',
                textShadow: quest.isLongTermProject && quest.difficulty === 'S' ? '1px 1px 0px #000' : 'none'
              }}
            >
              {quest.difficulty}
            </div>
          </div>

          {/* Quest Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <h3 
                  className="font-black text-base uppercase leading-tight mb-1 break-words"
                  style={{ 
                    textDecoration: isDone ? 'line-through' : 'none',
                    color: isDone ? '#999' : '#000',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    hyphens: 'auto'
                  }}
                >
                  {quest.title}
                </h3>
                <p 
                  className="text-xs font-bold line-clamp-2"
                  style={{ color: isDone ? '#999' : '#666' }}
                >
                  ({quest.actionHint})
                </p>
              </div>

              {/* Menu Button */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 hover:bg-gray-200"
                  style={{ border: '2px solid #000' }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMenu(false)}
                    />
                    <div 
                      className="absolute right-0 bottom-full mb-2 w-36 bg-white"
                      style={{
                        border: '3px solid #000',
                        boxShadow: '4px 4px 0px #000',
                        zIndex: 9999
                      }}
                    >
                      {isDone && (
                        <button
                          onClick={handleReopen}
                          className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-gray-100 flex items-center gap-2"
                          style={{ borderBottom: '2px solid #000' }}
                        >
                          <RotateCcw className="w-3 h-3" /> {t('questcard_reopen')}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onEdit(quest);
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-gray-100 flex items-center gap-2"
                        style={{ borderBottom: '2px solid #000' }}
                      >
                        <Edit className="w-3 h-3" /> {t('questcard_edit')}
                      </button>
                      <button
                        onClick={() => {
                          onDelete(quest.id);
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> {t('questcard_delete')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Due Date - More Compact */}
            {quest.dueDate && (
              <p className="text-xs font-bold mt-1" style={{ color: '#666' }}>
                ⏰ {format(new Date(quest.dueDate), 'MM/dd HH:mm')}
              </p>
            )}
          </div>

          {/* Complete Button - Smaller */}
          <button
            onClick={() => {
              const audio = new Audio('/sounds/勾掉任务音效.mp3');
              audio.play().catch(() => {});
              onComplete(quest);
            }}
            disabled={isDone}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center font-black transition-all"
            style={{
              backgroundColor: isDone ? '#4ECDC4' : '#FFF',
              border: '3px solid #000',
              boxShadow: '3px 3px 0px #000',
              cursor: isDone ? 'not-allowed' : 'pointer'
            }}
          >
            {isDone && <Check className="w-5 h-5" strokeWidth={4} />}
          </button>
        </div>
      </div>

      {/* Confirm Reopen Dialog */}
      {showConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowConfirm(false)}
        >
          <div 
            className="relative max-w-md w-full p-6 transform rotate-1"
            style={{
              backgroundColor: '#FFE66D',
              border: '5px solid #000',
              boxShadow: '10px 10px 0px #000'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black uppercase text-center mb-4">
              {t('questcard_confirm_reopen_title')}
            </h3>
            
            <div 
              className="mb-6 p-3"
              style={{
                backgroundColor: '#FFF',
                border: '3px solid #000'
              }}
            >
              <p className="font-bold text-sm mb-2">{quest.title}</p>
              <p className="text-xs font-bold" style={{ color: '#666' }}>
                {t('questcard_confirm_reopen_hint')}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 font-black uppercase"
                style={{
                  backgroundColor: '#FFF',
                  border: '4px solid #000',
                  boxShadow: '4px 4px 0px #000'
                }}
              >
                {t('common_cancel')}
              </button>
              <button
                onClick={confirmReopen}
                className="flex-1 py-3 font-black uppercase"
                style={{
                  backgroundColor: '#FF6B35',
                  color: '#FFF',
                  border: '4px solid #000',
                  boxShadow: '4px 4px 0px #000'
                }}
              >
                {t('questcard_confirm_reopen')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 5px 5px 0px #000; }
          50% { box-shadow: 0 0 20px #4ECDC4, 5px 5px 0px #000; }
        }
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}

import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { calculateTextLength, isTextOverLimit, getTextLengthDescription } from '@/lib/textLimit';

export default function QuestEditFormModal({ quest, onSave, onClose }) {
  const [actionHint, setActionHint] = useState(quest.actionHint || '');
  const [isRoutine, setIsRoutine] = useState(quest.isRoutine || false);
  const [isSaving, setIsSaving] = useState(false);
  const { t, language } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!actionHint.trim()) {
      alert(language === 'zh' ? '请输入任务内容！' : 'Please enter quest content!');
      return;
    }
    
    // 检查文本长度限制（50个汉字/单词）
    const TASK_MAX_LENGTH = 50;
    if (isTextOverLimit(actionHint.trim(), TASK_MAX_LENGTH)) {
      alert(language === 'zh' 
        ? `任务内容过长！最多只能输入 ${TASK_MAX_LENGTH} 个汉字/单词。当前: ${calculateTextLength(actionHint.trim())}` 
        : `Task content too long! Maximum ${TASK_MAX_LENGTH} characters/words. Current: ${calculateTextLength(actionHint.trim())}`);
      return;
    }

    setIsSaving(true);
    await onSave({
      actionHint: actionHint.trim(),
      isRoutine: isRoutine,
      originalActionHint: isRoutine ? actionHint.trim() : quest.originalActionHint
    });
    setIsSaving(false);
  };

  const difficultyColors = {
    C: '#FFE66D',
    B: '#FF6B35',
    A: '#C44569',
    S: '#000'
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div 
        className="relative max-w-lg w-full p-6 transform rotate-1"
        style={{
          backgroundColor: '#FFE66D',
          border: '5px solid #000',
          boxShadow: '12px 12px 0px #000'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-12 h-12 flex items-center justify-center"
          style={{
            backgroundColor: '#FF6B35',
            border: '4px solid #000',
            boxShadow: '5px 5px 0px #000'
          }}
        >
          <X className="w-7 h-7" strokeWidth={4} />
        </button>

        {/* Title */}
        <h2 
          className="text-2xl font-black uppercase text-center mb-6"
          style={{ color: '#000' }}
        >
          {t('questedit_title')}
        </h2>

        {/* Current RPG Title (Read-only Display) */}
        <div 
          className="mb-4 p-3"
          style={{
            backgroundColor: '#FFF',
            border: '3px solid #000'
          }}
        >
          <p className="text-xs font-bold uppercase mb-1" style={{ color: '#666' }}>
            {t('questedit_current_title')}
          </p>
          <p className="font-black text-sm">{quest.title}</p>
        </div>

        {/* Current Difficulty Display */}
        <div 
          className="mb-4 p-3"
          style={{
            backgroundColor: '#FFF',
            border: '3px solid #000'
          }}
        >
          <p className="text-xs font-bold uppercase mb-1" style={{ color: '#666' }}>
            {t('questedit_current_difficulty')}
          </p>
          <div className="flex items-center gap-2">
            <span 
              className="px-3 py-1 text-lg font-black"
              style={{
                backgroundColor: difficultyColors[quest.difficulty],
                color: quest.difficulty === 'S' ? '#FFE66D' : '#000',
                border: '3px solid #000'
              }}
            >
              {quest.difficulty}
            </span>
            <span className="text-sm font-bold" style={{ color: '#666' }}>
              {t('questedit_difficulty_hint')}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Hint Input */}
          <div>
            <label 
              className="block text-sm font-black uppercase mb-2"
              style={{ color: '#000' }}
            >
              {t('questedit_content_label')} <span style={{ color: '#FF6B35' }}>*</span>
            </label>
            <textarea
              value={actionHint}
              onChange={(e) => {
                const newValue = e.target.value;
                const TASK_MAX_LENGTH = 50;
                // 如果超过限制，不更新
                if (isTextOverLimit(newValue, TASK_MAX_LENGTH)) {
                  return;
                }
                setActionHint(newValue);
              }}
              placeholder={t('questedit_content_placeholder')}
              rows={3}
              className="w-full px-4 py-3 font-bold text-base resize-none"
              style={{
                backgroundColor: '#FFF',
                border: '3px solid #000',
                boxShadow: '4px 4px 0px #000'
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs font-bold" style={{ color: '#666' }}>
                {t('questedit_content_hint')}
              </p>
              <p className="text-xs font-bold" style={{ 
                color: isTextOverLimit(actionHint, 50) ? '#FF6B35' : '#666' 
              }}>
                {getTextLengthDescription(actionHint, 50, language)}
              </p>
            </div>
          </div>

          {/* Routine Checkbox */}
          <div 
            className="p-4"
            style={{
              backgroundColor: '#4ECDC4',
              border: '3px solid #000'
            }}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRoutine}
                onChange={(e) => setIsRoutine(e.target.checked)}
                className="w-6 h-6"
                style={{
                  accentColor: '#000'
                }}
              />
              <div>
                <span className="font-black uppercase">{t('questedit_routine')}</span>
                <p className="text-xs font-bold mt-1">
                  {t('questedit_routine_hint')}
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 font-black uppercase"
              style={{
                backgroundColor: '#FFF',
                border: '4px solid #000',
                boxShadow: '5px 5px 0px #000',
                opacity: isSaving ? 0.5 : 1
              }}
            >
              {t('common_cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 font-black uppercase flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#4ECDC4',
                border: '4px solid #000',
                boxShadow: '5px 5px 0px #000',
                opacity: isSaving ? 0.7 : 1
              }}
            >
              <Save className="w-5 h-5" strokeWidth={4} />
              {isSaving ? t('questedit_saving') : t('questedit_save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

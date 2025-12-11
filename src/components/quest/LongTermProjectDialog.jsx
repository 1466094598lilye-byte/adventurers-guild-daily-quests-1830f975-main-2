import { useState } from 'react';
import { X, Loader2, ChevronDown, ChevronUp, Edit2, Calendar as CalendarIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { useLanguage } from '@/components/LanguageContext';
import { getLongTermParsingPrompt } from '@/components/prompts';
import { playSound, stopSound } from '@/components/AudioManager';
import { calculateTextLength, isTextOverLimit, getTextLengthDescription } from '@/lib/textLimit';
import { useAuth } from '@/lib/AuthContext';

export default function LongTermProjectDialog({ onClose, onQuestsCreated }) {
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedQuests, setParsedQuests] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const { language, t } = useLanguage();
  const { user } = useAuth(); // 获取用户信息，判断是否是游客模式

  const handleParse = async () => {
    if (!textInput.trim() || isProcessing) return;
    
    // 检查文本长度限制（800个汉字/单词）
    const PROJECT_MAX_LENGTH = 800;
    if (isTextOverLimit(textInput.trim(), PROJECT_MAX_LENGTH)) {
      alert(language === 'zh' 
        ? `内容过长！最多只能输入 ${PROJECT_MAX_LENGTH} 个汉字/单词。当前: ${calculateTextLength(textInput.trim())}` 
        : `Content too long! Maximum ${PROJECT_MAX_LENGTH} characters/words. Current: ${calculateTextLength(textInput.trim())}`);
      return;
    }
    
    setIsProcessing(true);

    // 播放加载音效（循环）
    const loadingAudio = await playSound('loadingLoop', { loop: true });
    
    try {
      const { prompt, schema } = getLongTermParsingPrompt(language, textInput.trim());
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: schema
      });

      console.log('=== AI 解析结果 ===');
      console.log('任务数量:', result.tasks?.length || 0);
      console.log('任务详情:', result.tasks);

      setParsedQuests(result.tasks || []);
      
      // 停止加载音效
      if (loadingAudio) stopSound(loadingAudio);
      
      // 解析完成后播放音效
      if (result.tasks && result.tasks.length > 0) {
        await playSound('projectParsed');
      }
    } catch (error) {
      // 停止加载音效
      if (loadingAudio) stopSound(loadingAudio);
      console.error('解析失败:', error);
      alert(t('questboard_alert_task_parse_failed', { message: error.message || t('common_try_again') }));
    }
    setIsProcessing(false);
  };

  const handleUpdateQuest = (index, field, value) => {
    const updated = [...parsedQuests];
    updated[index] = { ...updated[index], [field]: value };
    setParsedQuests(updated);
  };

  const handleDeleteQuest = (index) => {
    setParsedQuests(parsedQuests.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  const handleConfirm = async () => {
    if (parsedQuests.length === 0 || isCreating) return;
    
    setIsCreating(true);

    // 播放加载音效（循环）
    const loadingAudio = await playSound('loadingLoop', { loop: true });
    
    try {
      console.log('=== 开始创建大项目任务 ===');
      console.log('待创建任务数量:', parsedQuests.length);
      console.log('当前日期（完整）:', new Date());
      console.log('当前日期（格式化）:', format(new Date(), 'yyyy-MM-dd'));
      
      const projectName = language === 'zh' 
        ? `${format(new Date(), 'yyyy年MM月')}大项目计划`
        : `${format(new Date(), 'MMMM yyyy')} Long-term Project`;
      
      const projectDescription = `${parsedQuests.length} ${language === 'zh' ? '项史诗委托' : 'epic quests'}`;
      
      // 只有登录用户才加密，游客模式使用明文
      let projectData;
      if (user) {
        // 登录模式：加密项目名称和描述
        const { data: encryptedProject } = await base44.functions.invoke('encryptProjectData', {
          projectName: projectName,
          description: projectDescription
        });
        
        projectData = {
          projectName: encryptedProject.encryptedProjectName,
          description: encryptedProject.encryptedDescription,
          status: 'active'
        };
      } else {
        // 游客模式：使用明文
        projectData = {
          projectName: projectName,
          description: projectDescription,
          status: 'active'
        };
      }
      
      const project = await base44.entities.LongTermProject.create(projectData);

      console.log('项目创建成功，ID:', project.id);

      const currentYear = new Date().getFullYear();
      const todayStr = format(new Date(), 'yyyy-MM-dd'); // 使用格式化的今天日期字符串

      for (const quest of parsedQuests) {
        console.log('\n--- 处理任务 ---');
        console.log('原始 quest.date:', quest.date);
        console.log('任务标题:', quest.title);
        
        if (!quest.date) {
          console.error('❌ 任务缺少 date 字段！', quest);
          alert(`任务 "${quest.title}" 缺少日期字段，跳过创建`);
          continue;
        }

        let fullDate = quest.date;
        
        if (quest.date.length === 5 && quest.date.includes('-')) {
          console.log('检测到 MM-DD 格式，开始转换...');
          fullDate = `${currentYear}-${quest.date}`;
          console.log('添加当前年份后:', fullDate);
          
          // 将字符串日期转为Date对象，然后再转回字符串，确保格式一致
          const questDateObj = new Date(fullDate + 'T00:00:00');
          const todayDateObj = new Date(todayStr + 'T00:00:00');
          
          console.log('任务日期对象:', questDateObj);
          console.log('今天日期对象:', todayDateObj);
          console.log('任务日期 < 今天？', questDateObj < todayDateObj);
          
          if (questDateObj < todayDateObj) {
            fullDate = `${currentYear + 1}-${quest.date}`;
            console.log('⚠️ 日期已过，使用明年:', fullDate);
          } else {
            console.log('✅ 日期是今天或未来，使用今年:', fullDate);
          }
        } else {
          console.log('非标准 MM-DD 格式，直接使用:', fullDate);
        }
        
        console.log('✅ 最终日期:', fullDate);
        console.log('今天日期:', todayStr);
        console.log('是否是今天？', fullDate === todayStr);
        
        // 只有登录用户才加密，游客模式使用明文
        let questData;
        if (user) {
          // 登录模式：加密任务标题和内容
          const { data: encryptedQuest } = await base44.functions.invoke('encryptQuestData', {
            title: quest.title,
            actionHint: quest.actionHint
          });
          
          questData = {
            title: encryptedQuest.encryptedTitle,
            actionHint: encryptedQuest.encryptedActionHint,
            date: fullDate,
            difficulty: quest.difficulty,
            rarity: quest.rarity,
            status: 'todo',
            source: 'longterm',
            isLongTermProject: true,
            longTermProjectId: project.id,
            tags: []
          };
        } else {
          // 游客模式：使用明文
          questData = {
            title: quest.title,
            actionHint: quest.actionHint,
            date: fullDate,
            difficulty: quest.difficulty,
            rarity: quest.rarity,
            status: 'todo',
            source: 'longterm',
            isLongTermProject: true,
            longTermProjectId: project.id,
            tags: []
          };
        }
        
        const createdQuest = await base44.entities.Quest.create(questData);
        
        console.log('✅ 任务创建成功！');
        console.log('  - ID:', createdQuest.id);
        console.log('  - date:', createdQuest.date);
        console.log('  - 是否是今天的任务？', createdQuest.date === todayStr);
      }

      console.log('=== 所有任务创建完成 ===');
      console.log('今天的日期是:', todayStr);

      // 停止加载音效
      if (loadingAudio) stopSound(loadingAudio);

      // 播放加入委托板音效
      await playSound('projectAdded');

      if (onQuestsCreated) {
        onQuestsCreated(parsedQuests.length);
      }
      
      onClose();
    } catch (error) {
      // 停止加载音效
      if (loadingAudio) stopSound(loadingAudio);
      console.error('❌ 创建任务失败:', error);
      alert(t('questboard_alert_create_quest_failed'));
    }
    setIsCreating(false);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return language === 'zh' ? '无日期' : 'No date';
    
    if (dateStr.length === 5 && dateStr.includes('-')) {
      if (language === 'zh') {
        return dateStr.replace('-', '月') + '日';
      } else {
        const [month, day] = dateStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${day}`;
      }
    }
    
    return dateStr;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full my-8 p-6"
        style={{
          backgroundColor: '#9B59B6',
          border: '5px solid #000',
          boxShadow: '12px 12px 0px #000'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-12 h-12 flex items-center justify-center"
          style={{
            backgroundColor: '#FF6B35',
            border: '4px solid #000',
            boxShadow: '5px 5px 0px #000'
          }}
        >
          <X className="w-7 h-7 text-white" strokeWidth={4} />
        </button>

        <h2 className="text-3xl font-black uppercase text-center text-white mb-2">
          {t('longterm_title')}
        </h2>
        <p className="text-center font-bold text-white text-sm mb-6">
          {t('longterm_subtitle')}
        </p>

        {parsedQuests.length === 0 ? (
          <div>
            <textarea
              value={textInput}
              onChange={(e) => {
                const newValue = e.target.value;
                const PROJECT_MAX_LENGTH = 800;
                // 如果超过限制，不更新
                if (isTextOverLimit(newValue, PROJECT_MAX_LENGTH)) {
                  return;
                }
                setTextInput(newValue);
              }}
              placeholder={t('longterm_placeholder')}
              rows={12}
              className="w-full px-4 py-3 font-bold resize-none mb-2"
              style={{
                backgroundColor: '#FFF',
                border: '4px solid #000',
                boxShadow: '5px 5px 0px #000'
              }}
            />
            <p className="text-xs font-bold mb-4" style={{ 
              color: isTextOverLimit(textInput, 800) ? '#FF6B35' : '#666' 
            }}>
              {getTextLengthDescription(textInput, 800, language)}
            </p>

            <button
              onClick={handleParse}
              disabled={isProcessing || !textInput.trim()}
              className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3"
              style={{
                backgroundColor: '#FFE66D',
                border: '4px solid #000',
                boxShadow: '6px 6px 0px #000',
                opacity: (!textInput.trim() || isProcessing) ? 0.5 : 1
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" strokeWidth={3} />
                  {t('longterm_parsing')}
                </>
              ) : (
                t('longterm_start_parse')
              )}
            </button>
          </div>
        ) : (
          <div>
            <div
              className="mb-4 p-4"
              style={{
                backgroundColor: '#FFE66D',
                border: '4px solid #000',
                boxShadow: '5px 5px 0px #000'
              }}
            >
              <p className="font-black text-center text-lg">
                {t('longterm_identified')} {parsedQuests.length} {t('longterm_epic_quests')}
              </p>
            </div>

            <div
              className="mb-4 max-h-[400px] overflow-y-auto"
              style={{
                backgroundColor: '#FFF',
                border: '4px solid #000'
              }}
            >
              {parsedQuests.map((quest, index) => (
                <div
                  key={index}
                  style={{
                    borderBottom: index < parsedQuests.length - 1 ? '3px solid #000' : 'none'
                  }}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon className="w-4 h-4 flex-shrink-0" strokeWidth={3} />
                          <span className="font-black text-sm">
                            {formatDateDisplay(quest.date)}
                          </span>
                          <span
                            className="px-2 py-0.5 text-xs font-black"
                            style={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
                              color: '#FFF',
                              border: '2px solid #000',
                              textShadow: '1px 1px 0px #000'
                            }}
                          >
                            S
                          </span>
                        </div>
                        <p className="font-black text-sm mb-1 text-purple-800 truncate">
                          {quest.title}
                        </p>
                        <p className="text-xs font-bold text-gray-600 truncate">
                          {quest.actionHint}
                        </p>
                      </div>
                      {expandedIndex === index ? (
                        <ChevronUp className="w-5 h-5 flex-shrink-0" strokeWidth={3} />
                      ) : (
                        <ChevronDown className="w-5 h-5 flex-shrink-0" strokeWidth={3} />
                      )}
                    </div>
                  </div>

                  {expandedIndex === index && (
                    <div className="px-4 pb-4 bg-gray-50" style={{ borderTop: '2px solid #000' }}>
                      <div className="mb-3 mt-3">
                        <label className="block text-xs font-bold uppercase mb-2">
                          {t('longterm_edit_date')}
                        </label>
                        <input
                          type="text"
                          value={quest.date || ''}
                          onChange={(e) => handleUpdateQuest(index, 'date', e.target.value)}
                          className="w-full px-3 py-2 font-bold text-sm"
                          style={{ border: '2px solid #000' }}
                          placeholder="MM-DD"
                        />
                        <p className="text-xs font-bold mt-1" style={{ color: '#666' }}>
                          💡 {language === 'zh' ? '系统会自动补全年份' : 'System will auto-complete the year'}
                        </p>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-bold uppercase mb-2">
                          {t('longterm_edit_title')}
                        </label>
                        <input
                          type="text"
                          value={quest.title}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const TASK_MAX_LENGTH = 50;
                            if (isTextOverLimit(newValue, TASK_MAX_LENGTH)) {
                              return;
                            }
                            handleUpdateQuest(index, 'title', newValue);
                          }}
                          className="w-full px-3 py-2 font-bold text-sm"
                          style={{ border: '2px solid #000' }}
                        />
                        <p className="text-xs font-bold mt-1" style={{ color: '#666' }}>
                          {getTextLengthDescription(quest.title || '', 50, language)}
                        </p>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-bold uppercase mb-2">
                          {t('longterm_edit_content')}
                        </label>
                        <textarea
                          value={quest.actionHint}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const TASK_MAX_LENGTH = 50;
                            if (isTextOverLimit(newValue, TASK_MAX_LENGTH)) {
                              return;
                            }
                            handleUpdateQuest(index, 'actionHint', newValue);
                          }}
                          rows={2}
                          className="w-full px-3 py-2 font-bold text-sm resize-none"
                          style={{ border: '2px solid #000' }}
                        />
                        <p className="text-xs font-bold mt-1" style={{ color: '#666' }}>
                          {getTextLengthDescription(quest.actionHint || '', 50, language)}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteQuest(index)}
                        className="w-full py-2 font-bold uppercase text-sm"
                        style={{
                          backgroundColor: '#FFF',
                          color: '#FF6B35',
                          border: '2px solid #FF6B35'
                        }}
                      >
                        {t('planning_delete_task')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setParsedQuests([]);
                  setExpandedIndex(null);
                }}
                disabled={isCreating}
                className="flex-1 py-3 font-black uppercase"
                style={{
                  backgroundColor: '#FFF',
                  border: '4px solid #000',
                  boxShadow: '5px 5px 0px #000',
                  opacity: isCreating ? 0.5 : 1
                }}
              >
                {t('longterm_reenter')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isCreating}
                className="flex-1 py-3 font-black uppercase flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#FFE66D',
                  border: '4px solid #000',
                  boxShadow: '5px 5px 0px #000',
                  opacity: isCreating ? 0.7 : 1
                }}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={3} />
                    {t('longterm_creating')}
                  </>
                ) : (
                  t('longterm_confirm_add')
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
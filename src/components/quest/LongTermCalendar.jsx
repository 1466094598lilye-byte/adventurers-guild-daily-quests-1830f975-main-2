import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Trash2, Edit2, AlertTriangle, ChevronRight, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isSameDay, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useLanguage } from '@/components/LanguageContext';
import { getCalendarAddTaskPrompt } from '@/components/prompts';

export default function LongTermCalendar({ onClose, onQuestsUpdated }) {
  const [longTermQuests, setLongTermQuests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateQuests, setSelectedDateQuests] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDateDetail, setShowDateDetail] = useState(false);
  const [editingQuest, setEditingQuest] = useState(null);
  const [expandedDates, setExpandedDates] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingToDate, setAddingToDate] = useState(null);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddLaterForm, setShowAddLaterForm] = useState(false);
  const [laterTaskInput, setLaterTaskInput] = useState('');
  const [selectedLaterDate, setSelectedLaterDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    loadLongTermQuests();
  }, []);

  const loadLongTermQuests = async () => {
    console.log('=== 开始加载限时活动日程 ===');
    setIsLoading(true);
    setLoadError(null);
    
    // 播放加载音效（循环）
    const loadingAudio = new Audio('/sounds/加载时播放.mp3');
    loadingAudio.loop = true;
    loadingAudio.play().catch(() => {});
    
    try {
      console.log('正在查询 isLongTermProject=true 的任务...');
      const quests = await base44.entities.Quest.filter({ isLongTermProject: true }, '-date', 500);
      console.log('查询到原始任务数量:', quests.length);
      console.log('原始任务列表:', quests);
      
      const decryptedAndValidQuests = await Promise.all(quests.map(async q => {
        if (!q.date) return null; // Filter out quests with no date
        const parsed = parseISO(q.date);
        if (!isValid(parsed)) return null; // Filter out quests with invalid dates

        let decryptedTitle = q.title;
        let decryptedActionHint = q.actionHint;

        // Attempt to decrypt if title or actionHint fields are present (assuming they might be encrypted)
        if (q.title || q.actionHint) {
          try {
            const { data: decrypted } = await base44.functions.invoke('decryptQuestData', {
              encryptedTitle: q.title,
              encryptedActionHint: q.actionHint
            });
            decryptedTitle = decrypted.title;
            decryptedActionHint = decrypted.actionHint;
          } catch (decryptError) {
            console.warn('Failed to decrypt quest data for ID:', q.id, decryptError);
            // If decryption fails, use the original (likely encrypted) values.
            // This might mean encrypted text is displayed, but prevents crash.
            // A more robust solution might involve differentiating encrypted vs unencrypted at storage.
          }
        }

        return {
          ...q,
          title: decryptedTitle,
          actionHint: decryptedActionHint
        };
      }));

      const finalQuests = decryptedAndValidQuests.filter(Boolean);
      console.log('解密和过滤后的任务数量:', finalQuests.length);
      console.log('最终任务列表:', finalQuests);
      
      // 停止加载音效
      loadingAudio.pause();
      loadingAudio.currentTime = 0;
      
      setLongTermQuests(finalQuests);
      setIsLoading(false);
      console.log('=== 限时活动日程加载完成 ===');
      
      // 日程表加载完成后播放音效
      if (finalQuests.length > 0) {
        const calendarLoadAudio = new Audio('/sounds/大项目加入委托板.mp3');
        calendarLoadAudio.play().catch(() => {});
      }
      
      return finalQuests;
    } catch (error) {
      // 停止加载音效
      loadingAudio.pause();
      loadingAudio.currentTime = 0;
      
      console.error('❌ 加载大项目任务失败:', error);
      console.error('错误详情:', error.stack);
      setLoadError(error.message || '加载失败');
      setIsLoading(false);
      return [];
    }
  };

  const groupedByDate = longTermQuests.reduce((acc, quest) => {
    if (!quest.date) return acc;
    if (!acc[quest.date]) {
      acc[quest.date] = [];
    }
    acc[quest.date].push(quest);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort();
  const latestDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

  const handleDateClick = (date, quests) => {
    try {
      const parsedDate = parseISO(date);
      if (isValid(parsedDate)) {
        setSelectedDate(parsedDate);
        setSelectedDateQuests(quests);
        setShowDateDetail(true);
      }
    } catch (error) {
      console.error('解析日期失败:', date, error);
    }
  };

  const toggleDateExpansion = (date) => {
    setExpandedDates(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const handleDeleteAllProjects = async () => {
    setIsDeleting(true);
    try {
      console.log('=== 开始删除所有大项目 ===');
      
      // 1. 收集所有唯一的 longTermProjectId
      const projectIds = new Set();
      longTermQuests.forEach(quest => {
        if (quest.longTermProjectId) {
          projectIds.add(quest.longTermProjectId);
        }
      });
      
      console.log('找到的大项目ID:', Array.from(projectIds));
      console.log('需要删除的Quest数量:', longTermQuests.length);
      
      // 2. 删除所有 Quest 任务
      for (const quest of longTermQuests) {
        await base44.entities.Quest.delete(quest.id);
      }
      console.log('✅ 所有Quest任务已删除');
      
      // 3. 删除所有关联的 LongTermProject
      for (const projectId of projectIds) {
        try {
          await base44.entities.LongTermProject.delete(projectId);
          console.log('✅ 删除大项目:', projectId);
        } catch (error) {
          console.warn('删除大项目失败:', projectId, error);
        }
      }
      console.log('✅ 所有LongTermProject记录已删除');
      
      // 4. 强制通知父组件更新
      if (onQuestsUpdated) {
        onQuestsUpdated();
      }
      
      // 5. 等待一下确保更新完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('=== 删除完成 ===');
      
      // 6. 播放删除音效
      const deleteAudio = new Audio('/sounds/大项目删除音效.mp3');
      deleteAudio.play().catch(() => {});
      
      // 7. 关闭对话框
      onClose();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteQuest = async (questId) => {
    try {
      await base44.entities.Quest.delete(questId);
      
      // 播放删除音效
      const deleteAudio = new Audio('/sounds/大项目删除音效.mp3');
      deleteAudio.play().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 300));
      const updatedLongTermQuests = await loadLongTermQuests(); // Get the latest decrypted quests
      
      if (selectedDate) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        // Recalculate selectedDateQuests from the updatedLongTermQuests
        const updatedQuestsForDate = updatedLongTermQuests.filter(q => q.date === dateStr);
        
        setSelectedDateQuests(updatedQuestsForDate);
        
        if (updatedQuestsForDate.length === 0) {
          setShowDateDetail(false);
          setExpandedDates(prev => prev.filter(d => d !== dateStr));
        }
      }
      
      if (onQuestsUpdated) {
        onQuestsUpdated();
      }
    } catch (error) {
      console.error('删除任务时出错:', error);
      await loadLongTermQuests(); // Reload even on error to sync state
      if (onQuestsUpdated) {
        onQuestsUpdated();
      }
    }
  };

  const handleEditQuest = async (quest, newActionHint) => {
    try {
      const { prompt, schema } = getCalendarAddTaskPrompt(language, newActionHint);
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: schema
      });
      
      // 加密后再更新
      const { data: encrypted } = await base44.functions.invoke('encryptQuestData', {
        title: result.title,
        actionHint: newActionHint
      });
      
      await base44.entities.Quest.update(quest.id, {
        title: encrypted.encryptedTitle,
        actionHint: encrypted.encryptedActionHint
      });

      // 重新加载并解密任务
      const updatedLongTermQuests = await loadLongTermQuests(); // Get the latest decrypted quests
      
      if (selectedDate && isValid(selectedDate)) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        // Re-group using the immediately available `updatedLongTermQuests`
        const updatedGroupedByDate = updatedLongTermQuests.reduce((acc, questItem) => {
          if (!questItem.date) return acc;
          if (!acc[questItem.date]) {
            acc[questItem.date] = [];
          }
          acc[questItem.date].push(questItem);
          return acc;
        }, {});
        const questsForSelectedDate = updatedGroupedByDate[dateStr] || [];
        setSelectedDateQuests(questsForSelectedDate);
      }

      setEditingQuest(null);
      if (onQuestsUpdated) {
        onQuestsUpdated();
      }
    } catch (error) {
      console.error('更新任务失败:', error);
      alert(t('questboard_alert_update_failed'));
    }
  };

  const getDateStatus = (quests) => {
    const total = quests.length;
    const done = quests.filter(q => q.status === 'done').length;
    return { total, done, allDone: done === total };
  };

  const handleAddTask = (date) => {
    setAddingToDate(date);
    setShowAddForm(true);
  };

  const handleSaveNewTask = async () => {
    if (!newTaskInput.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const { prompt, schema } = getCalendarAddTaskPrompt(language, newTaskInput.trim());
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: schema
      });

      // 加密后再创建
      const { data: encrypted } = await base44.functions.invoke('encryptQuestData', {
        title: result.title,
        actionHint: newTaskInput.trim()
      });

      await base44.entities.Quest.create({
        title: encrypted.encryptedTitle,
        actionHint: encrypted.encryptedActionHint,
        date: addingToDate,
        difficulty: 'S',
        rarity: 'Epic',
        status: 'todo',
        source: 'longterm',
        isLongTermProject: true,
        tags: []
      });

      // 重新加载并解密任务
      const updatedLongTermQuests = await loadLongTermQuests(); // Get the latest decrypted quests

      if (!expandedDates.includes(addingToDate)) {
        setExpandedDates(prev => [...prev, addingToDate]);
      }

      // If adding a task to the currently selected date, update selectedDateQuests as well
      if (selectedDate && isValid(selectedDate) && isSameDay(parseISO(addingToDate), selectedDate)) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const updatedGroupedByDate = updatedLongTermQuests.reduce((acc, questItem) => {
          if (!questItem.date) return acc;
          if (!acc[questItem.date]) {
            acc[questItem.date] = [];
          }
          acc[questItem.date].push(questItem);
          return acc;
        }, {});
        const questsForSelectedDate = updatedGroupedByDate[dateStr] || [];
        setSelectedDateQuests(questsForSelectedDate);
      }

      setShowAddForm(false);
      setNewTaskInput('');
      setAddingToDate(null);

      if (onQuestsUpdated) {
        onQuestsUpdated();
      }
    } catch (error) {
      console.error('添加任务失败:', error);
      alert(t('calendar_add_task_failed'));
    }
    setIsProcessing(false);
  };

  const handleAddLaterTask = async () => {
    if (!laterTaskInput.trim() || !selectedLaterDate || isProcessing) return;

    setIsProcessing(true);
    try {
      const { prompt, schema } = getCalendarAddTaskPrompt(language, laterTaskInput.trim());
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: schema
      });

      const { data: encrypted } = await base44.functions.invoke('encryptQuestData', {
        title: result.title,
        actionHint: laterTaskInput.trim()
      });

      await base44.entities.Quest.create({
        title: encrypted.encryptedTitle,
        actionHint: encrypted.encryptedActionHint,
        date: selectedLaterDate,
        difficulty: 'S',
        rarity: 'Epic',
        status: 'todo',
        source: 'longterm',
        isLongTermProject: true,
        tags: []
      });

      await loadLongTermQuests();

      setShowAddLaterForm(false);
      setLaterTaskInput('');
      setSelectedLaterDate('');

      if (onQuestsUpdated) {
        onQuestsUpdated();
      }
    } catch (error) {
      console.error('添加任务失败:', error);
      alert(t('calendar_add_task_failed'));
    }
    setIsProcessing(false);
  };

  // Helper function to safely format date
  const safeFormatDate = (dateStr, formatStr) => {
    try {
      if (!dateStr) return '';
      const parsed = parseISO(dateStr);
      if (!isValid(parsed)) return dateStr;
      return format(parsed, formatStr, { locale: language === 'zh' ? zhCN : undefined });
    } catch (error) {
      console.error('格式化日期失败:', dateStr, error);
      return dateStr;
    }
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

        <div className="text-center mb-6">
          <h2 className="text-3xl font-black uppercase text-white mb-2">
            📅 {t('calendar_title')} 📅
          </h2>
          <p className="font-bold text-white text-sm">
            {t('calendar_total_quests')} {longTermQuests.length} {t('calendar_epic_quests')}
          </p>
        </div>

        {isLoading ? (
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: '#FFE66D',
              border: '4px solid #000'
            }}
          >
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" strokeWidth={3} />
            <p className="font-black text-xl">
              {language === 'zh' ? '加载中...' : 'Loading...'}
            </p>
          </div>
        ) : loadError ? (
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: '#FF6B35',
              border: '4px solid #000'
            }}
          >
            <p className="font-black text-xl mb-2 text-white">
              {language === 'zh' ? '加载失败' : 'Loading Failed'}
            </p>
            <p className="font-bold text-sm text-white mb-4">
              {loadError}
            </p>
            <button
              onClick={loadLongTermQuests}
              className="px-4 py-2 font-black uppercase"
              style={{
                backgroundColor: '#FFF',
                border: '3px solid #000',
                boxShadow: '3px 3px 0px #000'
              }}
            >
              {language === 'zh' ? '重试' : 'Retry'}
            </button>
          </div>
        ) : longTermQuests.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: '#FFE66D',
              border: '4px solid #000'
            }}
          >
            <CalendarIcon className="w-16 h-16 mx-auto mb-4" strokeWidth={3} />
            <p className="font-black text-xl mb-2">{t('calendar_empty_title')}</p>
            <p className="font-bold text-sm">
              {t('calendar_empty_hint')}
            </p>
          </div>
        ) : (
          <>
            <div
              className="mb-4 max-h-[500px] overflow-y-auto"
              style={{
                backgroundColor: '#FFF',
                border: '4px solid #000'
              }}
            >
              {sortedDates.map((date, index) => {
                const quests = groupedByDate[date];
                const status = getDateStatus(quests);
                const parsedDate = parseISO(date);
                const isToday = isValid(parsedDate) && isSameDay(parsedDate, new Date());
                const isExpanded = expandedDates.includes(date);

                return (
                  <div
                    key={date}
                    style={{
                      borderBottom: index < sortedDates.length - 1 ? '3px solid #000' : 'none'
                    }}
                  >
                    <button
                      onClick={() => toggleDateExpansion(date)}
                      className="w-full p-4 text-left transition-all hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <CalendarIcon className="w-5 h-5 flex-shrink-0" strokeWidth={3} />
                            <span className="font-black text-lg">
                              {language === 'zh' 
                                ? safeFormatDate(date, 'MM月dd日')
                                : safeFormatDate(date, 'MMM dd')}
                            </span>
                            {isToday && (
                              <span
                                className="px-2 py-0.5 text-xs font-black"
                                style={{
                                  backgroundColor: '#4ECDC4',
                                  border: '2px solid #000',
                                  borderRadius: '4px'
                                }}
                              >
                                {t('calendar_today')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div
                              className="px-3 py-1 font-black text-sm"
                              style={{
                                backgroundColor: status.allDone ? '#4ECDC4' : '#FFE66D',
                                border: '2px solid #000',
                                borderRadius: '4px'
                              }}
                            >
                              {status.done}/{status.total} {t('calendar_items')}
                            </div>

                            {status.allDone && (
                              <span className="text-sm font-bold" style={{ color: '#4ECDC4' }}>
                                ✓ {t('calendar_completed')}
                              </span>
                            )}
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronDown className="w-6 h-6 flex-shrink-0" strokeWidth={3} />
                        ) : (
                          <ChevronRight className="w-6 h-6 flex-shrink-0" strokeWidth={3} />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2" style={{ backgroundColor: '#F9FAFB' }}>
                        {quests.map((quest, i) => (
                          <div
                            key={quest.id || i}
                            className="p-3"
                            style={{
                              backgroundColor: '#FFF',
                              border: '3px solid #000'
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div
                                    className="px-2 py-0.5 text-xs font-black"
                                    style={{
                                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
                                      color: '#FFF',
                                      border: '2px solid #000',
                                      textShadow: '1px 1px 0px #000'
                                    }}
                                  >
                                    S
                                  </div>
                                  {quest.status === 'done' && (
                                    <span className="text-xs font-bold" style={{ color: '#4ECDC4' }}>
                                      ✓ {t('calendar_completed')}
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="font-black text-sm mb-1"
                                  style={{
                                    color: quest.status === 'done' ? '#999' : '#9B59B6',
                                    textDecoration: quest.status === 'done' ? 'line-through' : 'none'
                                  }}
                                >
                                  {quest.title}
                                </p>
                                <p
                                  className="text-xs font-bold"
                                  style={{ color: quest.status === 'done' ? '#999' : '#666' }}
                                >
                                  {quest.actionHint}
                                </p>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingQuest(quest.id);
                                    handleDateClick(date, quests);
                                  }}
                                  className="p-1.5"
                                  style={{
                                    backgroundColor: '#FFE66D',
                                    border: '2px solid #000'
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" strokeWidth={3} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteQuest(quest.id);
                                  }}
                                  className="p-1.5"
                                  style={{
                                    backgroundColor: '#FF6B35',
                                    border: '2px solid #000'
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 text-white" strokeWidth={3} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddTask(date);
                          }}
                          className="w-full py-2 font-bold uppercase text-sm flex items-center justify-center gap-2"
                          style={{
                            backgroundColor: '#4ECDC4',
                            border: '3px solid #000',
                            boxShadow: '3px 3px 0px #000'
                          }}
                        >
                          <Plus className="w-4 h-4" strokeWidth={3} />
                          {t('calendar_add_task')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowAddLaterForm(true)}
              className="w-full py-3 mb-3 font-black uppercase flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#4ECDC4',
                color: '#000',
                border: '4px solid #000',
                boxShadow: '6px 6px 0px #000'
              }}
            >
              <Plus className="w-5 h-5" strokeWidth={3} />
              {language === 'zh' ? '添加更晚日期任务' : 'Add Task to Later Date'}
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="w-full py-3 font-black uppercase flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#FF6B35',
                color: '#FFF',
                border: '4px solid #000',
                boxShadow: '6px 6px 0px #000',
                opacity: isDeleting ? 0.5 : 1
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={3} />
                  {language === 'zh' ? '工会成员正在擦除委托板...' : 'Guild members erasing quest board...'}
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" strokeWidth={3} />
                  {t('calendar_delete_all')}
                </>
              )}
            </button>
          </>
        )}

        {showDateDetail && selectedDate && isValid(selectedDate) && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
            onClick={() => {
              setShowDateDetail(false);
              setEditingQuest(null);
            }}
          >
            <div
              className="relative max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
              style={{
                backgroundColor: '#4ECDC4',
                border: '5px solid #000',
                boxShadow: '12px 12px 0px #000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowDateDetail(false);
                  setEditingQuest(null);
                }}
                className="absolute -top-4 -right-4 w-12 h-12 flex items-center justify-center"
                style={{
                  backgroundColor: '#FF6B35',
                  border: '4px solid #000',
                  boxShadow: '5px 5px 0px #000'
                }}
              >
                <X className="w-7 h-7" strokeWidth={4} />
              </button>

              <h3 className="text-2xl font-black uppercase text-center mb-4">
                📅 {language === 'zh' 
                  ? format(selectedDate, 'MM月dd日') 
                  : format(selectedDate, 'MMM dd')} {t('calendar_date_tasks')}
              </h3>

              <div className="space-y-3">
                {selectedDateQuests.map((quest) => (
                  <div
                    key={quest.id}
                    className="p-4"
                    style={{
                      backgroundColor: '#FFF',
                      border: '4px solid #000'
                    }}
                  >
                    {editingQuest === quest.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          defaultValue={quest.actionHint}
                          onBlur={(e) => {
                            if (e.target.value.trim()) {
                              handleEditQuest(quest, e.target.value.trim());
                            } else {
                              setEditingQuest(null);
                            }
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          autoFocus
                          className="w-full px-3 py-2 font-bold"
                          style={{ border: '3px solid #000' }}
                        />
                        <button
                          onClick={() => setEditingQuest(null)}
                          className="text-sm font-bold underline"
                        >
                          {t('common_cancel')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="px-2 py-1 text-base font-black"
                                style={{
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
                                  color: '#FFF',
                                  border: '2px solid #000',
                                  textShadow: '1px 1px 0px #000'
                                }}
                              >
                                S
                              </div>
                            </div>
                            <p className="font-black text-lg mb-1 text-purple-800">
                              {quest.title}
                            </p>
                            <p className="text-sm font-bold text-gray-600">
                              {quest.actionHint}
                            </p>
                            <p className="text-xs font-bold mt-2" style={{ color: '#999' }}>
                              {t('calendar_status')}：{quest.status === 'done' ? t('calendar_status_done') : t('calendar_status_pending')}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingQuest(quest.id)}
                              className="p-2"
                              style={{
                                backgroundColor: '#FFE66D',
                                border: '3px solid #000'
                              }}
                            >
                              <Edit2 className="w-4 h-4" strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => handleDeleteQuest(quest.id)}
                              className="p-2"
                              style={{
                                backgroundColor: '#FF6B35',
                                border: '3px solid #000'
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-white" strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAddForm && addingToDate && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
            onClick={() => {
              setShowAddForm(false);
              setNewTaskInput('');
              setAddingToDate(null);
            }}
          >
            <div
              className="relative max-w-md w-full p-6"
              style={{
                backgroundColor: '#4ECDC4',
                border: '5px solid #000',
                boxShadow: '12px 12px 0px #000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewTaskInput('');
                  setAddingToDate(null);
                }}
                className="absolute -top-4 -right-4 w-12 h-12 flex items-center justify-center"
                style={{
                  backgroundColor: '#FF6B35',
                  border: '4px solid #000',
                  boxShadow: '5px 5px 0px #000'
                }}
              >
                <X className="w-7 h-7" strokeWidth={4} />
              </button>

              <h3 className="text-2xl font-black uppercase text-center mb-4">
                {t('calendar_add_task_title')}
              </h3>

              <div
                className="mb-4 p-3"
                style={{
                  backgroundColor: '#FFE66D',
                  border: '3px solid #000'
                }}
              >
                <p className="font-bold text-sm">
                  📅 {t('common_date')}：{language === 'zh' 
                    ? safeFormatDate(addingToDate, 'yyyy年MM月dd日')
                    : safeFormatDate(addingToDate, 'MMMM dd, yyyy')}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-black uppercase mb-2">
                  {t('calendar_task_content_label')}
                </label>
                <textarea
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                  placeholder={t('calendar_task_placeholder')}
                  rows={3}
                  className="w-full px-3 py-2 font-bold resize-none"
                  style={{
                    backgroundColor: '#FFF',
                    border: '3px solid #000'
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTaskInput('');
                    setAddingToDate(null);
                  }}
                  disabled={isProcessing}
                  className="flex-1 py-3 font-black uppercase"
                  style={{
                    backgroundColor: '#FFF',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000',
                    opacity: isProcessing ? 0.5 : 1
                  }}
                >
                  {t('common_cancel')}
                </button>
                <button
                  onClick={handleSaveNewTask}
                  disabled={!newTaskInput.trim() || isProcessing}
                  className="flex-1 py-3 font-black uppercase"
                  style={{
                    backgroundColor: '#FFE66D',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000',
                    opacity: (!newTaskInput.trim() || isProcessing) ? 0.5 : 1
                  }}
                >
                  {isProcessing ? t('calendar_adding') : t('calendar_confirm_add')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddLaterForm && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
            onClick={() => {
              setShowAddLaterForm(false);
              setLaterTaskInput('');
              setSelectedLaterDate('');
            }}
          >
            <div
              className="relative max-w-md w-full p-6"
              style={{
                backgroundColor: '#4ECDC4',
                border: '5px solid #000',
                boxShadow: '12px 12px 0px #000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowAddLaterForm(false);
                  setLaterTaskInput('');
                  setSelectedLaterDate('');
                }}
                className="absolute -top-4 -right-4 w-12 h-12 flex items-center justify-center"
                style={{
                  backgroundColor: '#FF6B35',
                  border: '4px solid #000',
                  boxShadow: '5px 5px 0px #000'
                }}
              >
                <X className="w-7 h-7" strokeWidth={4} />
              </button>

              <h3 className="text-2xl font-black uppercase text-center mb-4">
                {language === 'zh' ? '📅 添加更晚日期任务 📅' : '📅 Add Task to Later Date 📅'}
              </h3>

              <div
                className="mb-4 p-3"
                style={{
                  backgroundColor: '#FFE66D',
                  border: '3px solid #000'
                }}
              >
                <p className="font-bold text-sm mb-2">
                  💡 {language === 'zh' 
                    ? `当前最晚日期：${latestDate ? safeFormatDate(latestDate, 'yyyy年MM月dd日') : '无'}`
                    : `Current latest date: ${latestDate ? safeFormatDate(latestDate, 'MMMM dd, yyyy') : 'None'}`}
                </p>
                <p className="font-bold text-xs" style={{ color: '#666' }}>
                  {language === 'zh' 
                    ? '适用于项目延期等场景，可添加到更远的日期'
                    : 'Suitable for project delays, add tasks to later dates'}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-black uppercase mb-2">
                  {t('common_date')}
                </label>
                <input
                  type="date"
                  value={selectedLaterDate}
                  onChange={(e) => setSelectedLaterDate(e.target.value)}
                  className="w-full px-3 py-2 font-bold"
                  style={{
                    backgroundColor: '#FFF',
                    border: '3px solid #000'
                  }}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-black uppercase mb-2">
                  {t('calendar_task_content_label')}
                </label>
                <textarea
                  value={laterTaskInput}
                  onChange={(e) => setLaterTaskInput(e.target.value)}
                  placeholder={t('calendar_task_placeholder')}
                  rows={3}
                  className="w-full px-3 py-2 font-bold resize-none"
                  style={{
                    backgroundColor: '#FFF',
                    border: '3px solid #000'
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddLaterForm(false);
                    setLaterTaskInput('');
                    setSelectedLaterDate('');
                  }}
                  disabled={isProcessing}
                  className="flex-1 py-3 font-black uppercase"
                  style={{
                    backgroundColor: '#FFF',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000',
                    opacity: isProcessing ? 0.5 : 1
                  }}
                >
                  {t('common_cancel')}
                </button>
                <button
                  onClick={handleAddLaterTask}
                  disabled={!laterTaskInput.trim() || !selectedLaterDate || isProcessing}
                  className="flex-1 py-3 font-black uppercase"
                  style={{
                    backgroundColor: '#FFE66D',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000',
                    opacity: (!laterTaskInput.trim() || !selectedLaterDate || isProcessing) ? 0.5 : 1
                  }}
                >
                  {isProcessing ? t('calendar_adding') : t('calendar_confirm_add')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          >
            <div
              className="relative max-w-md w-full p-6"
              style={{
                backgroundColor: '#FF6B35',
                border: '5px solid #000',
                boxShadow: '12px 12px 0px #000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-white" strokeWidth={3} />

                <h3 className="text-2xl font-black uppercase text-white mb-4">
                  {t('calendar_confirm_delete_title')}
                </h3>

                <div
                  className="mb-6 p-4 text-left"
                  style={{
                    backgroundColor: '#FFF',
                    border: '3px solid #000'
                  }}
                >
                  <p className="font-bold mb-2">
                    {t('calendar_delete_warning')} {longTermQuests.length} {language === 'zh' ? '项大项目任务' : 'long-term project tasks'}
                  </p>
                  <p className="text-sm font-bold" style={{ color: '#C44569' }}>
                    {t('calendar_delete_cannot_undo')}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 py-3 font-black uppercase"
                    style={{
                      backgroundColor: '#FFF',
                      border: '4px solid #000',
                      boxShadow: '4px 4px 0px #000',
                      opacity: isDeleting ? 0.5 : 1
                    }}
                  >
                    {t('common_cancel')}
                  </button>
                  <button
                    onClick={handleDeleteAllProjects}
                    disabled={isDeleting}
                    className="flex-1 py-3 font-black uppercase text-white flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: '#000',
                      border: '4px solid #FFF',
                      boxShadow: '4px 4px 0px #FFF',
                      opacity: isDeleting ? 0.5 : 1
                    }}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={3} />
                        {language === 'zh' ? '擦除中...' : 'Erasing...'}
                      </>
                    ) : (
                      t('common_confirm')
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
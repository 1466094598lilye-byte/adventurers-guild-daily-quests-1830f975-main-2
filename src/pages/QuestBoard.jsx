import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Filter, Loader2, Sparkles, Coffee, Briefcase, ChevronDown, ChevronUp, Check, Plus, Calendar as CalendarIcon } from 'lucide-react';
import QuestCard from '../components/quest/QuestCard';
import PraiseDialog from '../components/quest/PraiseDialog';
import ChestOpening from '../components/treasure/ChestOpening';
import QuestEditFormModal from '../components/quest/QuestEditFormModal';
import EndOfDaySummaryAndPlanning from '../components/quest/EndOfDaySummaryAndPlanning';
import LongTermProjectDialog from '../components/quest/LongTermProjectDialog';
import LongTermCalendar from '../components/quest/LongTermCalendar';
import JointPraiseDialog from '../components/quest/JointPraiseDialog';
import StreakBreakDialog from '../components/streak/StreakBreakDialog';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/LanguageContext';
import { getTaskNamingPrompt } from '@/components/prompts';
import { calculateTextLength, isTextOverLimit, getTextLengthDescription } from '@/lib/textLimit';

export default function QuestBoard() {
  const [filter, setFilter] = useState('all');
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [showChest, setShowChest] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingQuests, setPendingQuests] = useState([]);
  const [expandedPending, setExpandedPending] = useState(null);
  const [editingQuest, setEditingQuest] = useState(null);
  const [toast, setToast] = useState(null);
  const [milestoneReward, setMilestoneReward] = useState(null);
  const [showRestDayDialog, setShowRestDayDialog] = useState(false);
  const [showPlanningDialog, setShowPlanningDialog] = useState(false);
  const [showCelebrationInPlanning, setShowCelebrationInPlanning] = useState(false);
  const [showLongTermDialog, setShowLongTermDialog] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isConfirmingPending, setIsConfirmingPending] = useState(false);
  const [showJointPraise, setShowJointPraise] = useState(false);
  const [completedProject, setCompletedProject] = useState(null);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [streakBreakInfo, setStreakBreakInfo] = useState(null);
  const [isDayRolloverInProgress, setIsDayRolloverInProgress] = useState(false);
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();

  // 检查 localStorage 是否今天已完成日更
  const getRolloverKey = (userId) => `dayRollover_${userId}_${today}`;
  const hasCompletedRolloverToday = (userId) => {
    try {
      return localStorage.getItem(getRolloverKey(userId)) === 'done';
    } catch {
      return false;
    }
  };
  const markRolloverComplete = (userId) => {
    try {
      localStorage.setItem(getRolloverKey(userId), 'done');
    } catch {}
  };
  const invalidationTimeoutRef = useRef(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // 🔥 优化：批量刷新查询，避免频繁触发
  const batchInvalidateQueries = (keys) => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }

    invalidationTimeoutRef.current = setTimeout(() => {
      keys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    }, 100);
  };

  // 实时更新当前小时，用于判断是否显示"规划明日"板块
  useEffect(() => {
    const updateHour = () => {
      const newHour = new Date().getHours();
      setCurrentHour(newHour);
    };

    updateHour();
    const interval = setInterval(updateHour, 60000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 关键修复：先获取 user，再使用 useQuery
  // 从 AuthContext 获取用户信息（已包含完整数据）
  const { user, refreshUser } = useAuth();

  // 🔍 调试日志：监控 user 状态
  useEffect(() => {
    console.log('[QuestBoard] User 状态变化:', {
      hasUser: !!user,
      userId: user?.id || null,
      isLoadingAuth: undefined // 这个在 AuthenticatedApp 中已经处理
    });
  }, [user]);

  const { data: quests = [], isLoading, error: questsError, isError } = useQuery({
    queryKey: ['quests', today, user?.id || 'guest'],
    queryFn: async () => {
      console.log('[QuestBoard] ========== 查询开始 ==========');
      console.log('[QuestBoard] queryKey:', ['quests', today, user?.id || 'guest']);
      console.log('[QuestBoard] 开始获取任务，用户:', user ? `已登录(${user.id})` : '游客');
      try {
        const allQuests = await base44.entities.Quest.filter({ date: today }, '-created_date');
        console.log('[QuestBoard] 获取到任务数量:', allQuests.length);
        
        // 游客模式下不尝试解密（数据本身就是明文）
        if (!user) {
          console.log('[QuestBoard] 游客模式，返回原始任务');
          return allQuests;
        }
        
        // 登录模式下尝试解密
        console.log('[QuestBoard] 登录模式，开始解密任务');
        const decryptedQuests = await Promise.all(
          allQuests.map(async (quest) => {
            try {
              // 如果 owner_id 是 'guest'，说明是游客模式下创建的明文数据，直接返回
              if (quest.owner_id === 'guest') {
                return quest;
              }
              
              // 登录用户的数据需要解密
              const { data } = await base44.functions.invoke('decryptQuestData', {
                encryptedTitle: quest.title,
                encryptedActionHint: quest.actionHint
              });
              
              return {
                ...quest,
                title: data.title,
                actionHint: data.actionHint
              };
            } catch (error) {
              console.error('[QuestBoard] 解密任务失败:', quest.id, error);
              // 解密失败时，尝试使用原始数据（可能是游客模式创建的明文）
              return quest; 
            }
          })
        );
        
        console.log('[QuestBoard] 解密完成，返回任务数量:', decryptedQuests.length);
        console.log('[QuestBoard] ========== 查询成功完成 ==========');
        return decryptedQuests;
      } catch (error) {
        console.error('[QuestBoard] ========== 查询失败 ==========');
        console.error('[QuestBoard] 获取任务失败:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        // 返回空数组而不是抛出错误，避免 React Query 一直 retry
        console.log('[QuestBoard] 返回空数组，避免无限重试');
        return [];
      }
    },
    retry: (failureCount, error) => {
      // 🔍 调试日志
      console.log('[QuestBoard] ========== 查询重试判断 ==========');
      console.log('[QuestBoard] 查询失败，重试次数:', failureCount, '错误:', {
        message: error?.message,
        code: error?.code,
        details: error?.details
      });
      // 如果是权限错误（RLS），不重试
      if (error?.message?.includes('permission') || 
          error?.message?.includes('RLS') || 
          error?.code === 'PGRST301' ||
          error?.code === '42501') {
        console.log('[QuestBoard] 权限错误，不重试');
        return false;
      }
      // 如果是网络错误，最多重试1次
      if (failureCount < 1) {
        console.log('[QuestBoard] 网络错误，允许重试');
        return true;
      }
      console.log('[QuestBoard] 已达到最大重试次数，不重试');
      return false;
    },
    retryDelay: 1000,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    // 即使查询失败，也显示空状态而不是一直 loading
    throwOnError: false,
    // 确保查询在 enabled 时才会执行（等待 user 状态确定）
    enabled: true, // 总是启用，但会在 queryFn 中处理 user 为 null 的情况
  });

  // 🔍 调试日志：监控查询状态
  useEffect(() => {
    console.log('[QuestBoard] ========== 查询状态变化 ==========');
    console.log('[QuestBoard] 查询状态:', {
      isLoading,
      isError,
      questsError: questsError?.message || null,
      questsErrorCode: questsError?.code || null,
      questsCount: quests.length,
      user: user ? `已登录(${user.id})` : '游客',
      queryKey: ['quests', today, user?.id || 'guest']
    });
  }, [isLoading, isError, questsError, quests.length, user, today]);

  const { data: hasAnyLongTermQuests = false, isLoading: isLoadingLongTermQuests } = useQuery({
    queryKey: ['hasLongTermQuests', user?.id || 'guest'],
    queryFn: async () => {
      console.log('=== 🔍 检查未完成的大项目任务 ===');
      console.log('用户模式:', user ? '登录' : '游客');
      
      try {
        const allLongTermQuests = await base44.entities.Quest.filter({ 
          isLongTermProject: true 
        });
        
        const incompleteTasks = allLongTermQuests.filter(q => q.status !== 'done');
        console.log('📋 未完成的大项目任务数量:', incompleteTasks.length);
        
        if (incompleteTasks.length > 0) {
          console.log('✅ 有未完成任务，显示按钮');
        } else {
          console.log('❌ 无未完成任务，不显示按钮');
        }
        
        return incompleteTasks.length > 0;
      } catch (error) {
        console.error('❌ 检查失败:', error);
        return false;
      }
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // 日更逻辑：检查连胜中断 + 未完成任务顺延 + 明日规划任务创建 + 每日修炼任务生成 + 清理旧任务 + 清理旧宝箱记录 + 清理旧大项目
  useEffect(() => {
    // This function contains the actual rollover steps 1-7, independent of the streak break decision
    const executeDayRolloverLogic = async () => {
      console.log('=== 执行其他日更逻辑 (步骤 1-7) ===');

      try {
        // 🔥 1. 【最高优先级】处理明日规划任务（创建为今日任务）
        // 🔧 刷新用户数据，确保获取最新信息
        await refreshUser();
        const nextDayPlanned = user?.nextDayPlannedQuests || [];
        const lastPlanned = user?.lastPlannedDate;

        console.log('=== 步骤1: 检查明日规划任务 ===');
        console.log('nextDayPlanned:', nextDayPlanned);
        console.log('lastPlanned:', lastPlanned);
        console.log('today:', today);
        console.log('条件: nextDayPlanned.length > 0 =', nextDayPlanned.length > 0);
        console.log('条件: lastPlanned存在 =', !!lastPlanned);
        console.log('条件: lastPlanned < today =', lastPlanned < today);

        if (nextDayPlanned.length > 0 && lastPlanned && lastPlanned < today) {
          console.log(`✅ 发现 ${nextDayPlanned.length} 项已规划任务，开始创建...`);

          const createdQuestIds = [];

          try {
            for (const plannedQuest of nextDayPlanned) {
              console.log('正在创建任务:', plannedQuest);

              const { data: encrypted } = await base44.functions.invoke('encryptQuestData', {
                title: plannedQuest.title,
                actionHint: plannedQuest.actionHint
              });

              const createdQuest = await base44.entities.Quest.create({
                title: encrypted.encryptedTitle,
                actionHint: encrypted.encryptedActionHint,
                difficulty: plannedQuest.difficulty,
                rarity: plannedQuest.rarity,
                date: today,
                status: 'todo',
                source: 'ai',
                tags: plannedQuest.tags || []
              });

              createdQuestIds.push(createdQuest.id);
              console.log('任务创建成功:', createdQuest.id);
            }

            await base44.auth.updateMe({
              nextDayPlannedQuests: [],
              lastPlannedDate: today
            });

            await refreshUser(); // 刷新 AuthContext 中的用户数据
            console.log('✅ 明日规划任务全部创建成功，已清空规划列表');

            batchInvalidateQueries(['quests', 'user']);
            setToast(t('questboard_toast_planned_quests_loaded', { count: nextDayPlanned.length }));
            setTimeout(() => setToast(null), 3000);
          } catch (error) {
            console.error('❌ 创建规划任务时出错:', error);
            alert(language === 'zh' 
              ? `创建规划任务失败：${error.message}，请刷新页面重试` 
              : `Failed to create planned quests: ${error.message}, please refresh`);
          }
        } else {
          console.log('❌ 没有符合条件的明日规划任务');
        }

        // 2. 清理7天前的已完成任务（排除大项目任务 + 保护每日修炼模板）
        console.log('=== 步骤2: 开始清理旧任务 ===');
        
        const sevenDaysAgoDate = new Date();
        sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
        const sevenDaysAgoStr = format(sevenDaysAgoDate, 'yyyy-MM-dd');
        
        const doneQuests = await base44.entities.Quest.filter({ status: 'done' }, '-date', 500);
        
        const routineQuestsMap = new Map();
        for (const quest of doneQuests) {
          if (quest.isRoutine && quest.originalActionHint) {
            const existing = routineQuestsMap.get(quest.originalActionHint);
            if (!existing || new Date(quest.created_date) > new Date(existing.created_date)) {
              routineQuestsMap.set(quest.originalActionHint, quest);
            }
          }
        }
        
        const protectedQuestIds = new Set(
          Array.from(routineQuestsMap.values()).map(q => q.id)
        );
        
        let deletedCount = 0;
        
        for (const quest of doneQuests) {
          if (quest.isLongTermProject) continue;
          if (protectedQuestIds.has(quest.id)) continue;
          if (!quest.date) continue;
          
          if (quest.date < sevenDaysAgoStr) {
            await base44.entities.Quest.delete(quest.id);
            deletedCount++;
          }
        }
        
        if (deletedCount > 0) {
          console.log(`✅ 已清理 ${deletedCount} 个7天前的已完成任务`);
        }

        // 3. 清理7天前的已开启宝箱记录
        console.log('=== 步骤3: 开始清理旧宝箱记录 ===');
        
        try {
          const allChests = await base44.entities.DailyChest.filter({ opened: true }, '-date', 200);
          let deletedChestCount = 0;
          
          for (const chest of allChests) {
            if (!chest.date) continue;
            if (chest.date < sevenDaysAgoStr) {
              await base44.entities.DailyChest.delete(chest.id);
              deletedChestCount++;
            }
          }
          
          if (deletedChestCount > 0) {
            console.log(`✅ 已清理 ${deletedChestCount} 个7天前的宝箱记录`);
          }
        } catch (error) {
          console.error('清理宝箱记录时出错:', error);
        }

        // 4. 处理昨天未完成的任务（顺延到今天）
        console.log('=== 步骤4: 处理昨天未完成任务 ===');
        const oldQuests = await base44.entities.Quest.filter({ date: yesterday, status: 'todo' });
        
        if (oldQuests.length > 0) {
          console.log(`发现 ${oldQuests.length} 项昨日未完成任务，开始顺延...`);
          
          for (const quest of oldQuests) {
            if (!quest.isRoutine) {
              await base44.entities.Quest.update(quest.id, { date: today });
            }
          }
          
          batchInvalidateQueries(['quests']);
          const nonRoutineCount = oldQuests.filter(q => !q.isRoutine).length;
          if (nonRoutineCount > 0) {
            setToast(t('questboard_toast_yesterday_quests_delayed', { count: nonRoutineCount }));
            setTimeout(() => setToast(null), 3000);
          }
        }

        // 5. 处理每日修炼任务（自动生成今日任务，保持原有评级）
        console.log('=== 步骤5: 开始处理每日修炼任务 ===');

        // 🔧 重新获取今日任务列表（因为前面可能已经创建了明日规划任务）
        const todayQuestsForRoutine = await base44.entities.Quest.filter({ date: today });
        console.log('当前今日任务数量:', todayQuestsForRoutine.length);
        
        const allRoutineQuests = await base44.entities.Quest.filter({ isRoutine: true }, '-created_date', 100);

        if (allRoutineQuests.length > 0) {
          // 🔥 并行解密所有每日修炼任务
          const decryptedRoutines = await Promise.all(
            allRoutineQuests.map(async (quest) => {
              try {
                const { data } = await base44.functions.invoke('decryptQuestData', {
                  encryptedActionHint: quest.actionHint
                });
                return { ...quest, decryptedActionHint: data.actionHint };
              } catch (error) {
                console.warn(`Failed to decrypt actionHint for routine quest ${quest.id}:`, error);
                return { ...quest, decryptedActionHint: quest.actionHint };
              }
            })
          );

          const uniqueRoutinesMap = new Map();
          for (const quest of decryptedRoutines) {
            const key = quest.decryptedActionHint;
            if (key) {
              const effectiveKey = quest.originalActionHint || key;
              if (!uniqueRoutinesMap.has(effectiveKey) || 
                  new Date(quest.created_date) > new Date(uniqueRoutinesMap.get(effectiveKey).created_date)) {
                uniqueRoutinesMap.set(effectiveKey, quest);
              }
            }
          }

          // 🔧 筛选需要创建的任务
          const toCreate = [];
          for (const [actionHintPlain, templateQuest] of uniqueRoutinesMap) {
            const alreadyExists = todayQuestsForRoutine.some(
              q => q.isRoutine && (q.originalActionHint === actionHintPlain || q.actionHint === templateQuest.actionHint)
            );
            if (!alreadyExists) {
              toCreate.push({ actionHintPlain, templateQuest });
            }
          }

          console.log('需要创建的每日修炼任务数量:', toCreate.length);

          if (toCreate.length > 0) {
            // 🔥 并行调用 LLM 生成所有标题
            const llmResults = await Promise.all(
              toCreate.map(({ actionHintPlain }) =>
                base44.integrations.Core.InvokeLLM({
                  prompt: `你是【星陨纪元冒险者工会】的首席史诗书记官。

        **当前冒险者每日修炼内容：** ${actionHintPlain}

        请为这个每日修炼任务生成**全新的**RPG风格标题（只需要标题，不需要重新评定难度）。

        要求：
        1. 标题要有变化，不要每天都一样（但核心内容要体现任务本质）
        2. 格式：【2字类型】+ 7字标题
        3. 保持任务的核心特征

        只返回标题。`,
                  response_json_schema: {
                    type: "object",
                    properties: {
                      title: { type: "string" }
                    },
                    required: ["title"]
                  }
                }).catch(err => {
                  console.error(`LLM生成标题失败: ${actionHintPlain}`, err);
                  return null;
                })
              )
            );

            // 🔥 并行加密并创建任务
            await Promise.all(
              toCreate.map(async ({ actionHintPlain, templateQuest }, index) => {
                const result = llmResults[index];
                if (!result) return;

                try {
                  const { data: encrypted } = await base44.functions.invoke('encryptQuestData', {
                    title: result.title,
                    actionHint: actionHintPlain
                  });

                  await base44.entities.Quest.create({
                    title: encrypted.encryptedTitle,
                    actionHint: encrypted.encryptedActionHint,
                    difficulty: templateQuest.difficulty,
                    rarity: templateQuest.rarity,
                    date: today,
                    status: 'todo',
                    source: 'routine',
                    isRoutine: true,
                    originalActionHint: actionHintPlain,
                    tags: []
                  });
                } catch (error) {
                  console.error(`创建每日修炼任务失败: ${actionHintPlain}`, error);
                }
              })
            );

            batchInvalidateQueries(['quests']);
          }
        }

        // 6. 清理已完成超过2年的大项目及其关联任务
        console.log('=== 步骤6: 开始清理旧的大项目记录 ===');
        
        try {
          // 计算2年前的日期（730天）
          const twoYearsAgo = new Date();
          twoYearsAgo.setDate(twoYearsAgo.getDate() - 730);
          const twoYearsAgoStr = format(twoYearsAgo, 'yyyy-MM-dd');
          
          console.log('📅 2年前日期:', twoYearsAgoStr);
          
          // 查询所有大项目
          const allProjects = await base44.entities.LongTermProject.list();
          
          // 筛选出已完成且超过2年的项目
          const oldProjects = allProjects.filter(project => {
            return project.status === 'completed' && 
                   project.completionDate && 
                   project.completionDate < twoYearsAgoStr;
          });
          
          if (oldProjects.length > 0) {
            console.log(`🎯 找到 ${oldProjects.length} 个需要清理的旧项目`);
            
            let totalQuestsDeleted = 0;
            let projectsDeleted = 0;
            
            // 删除关联的任务和项目本身
            for (const project of oldProjects) {
              try {
                // 查询并删除关联任务 (Updated as per outline)
                const allQuests = await base44.entities.Quest.list();
                const relatedQuests = allQuests.filter(q => q.longTermProjectId === project.id);
                
                for (const quest of relatedQuests) {
                  try {
                    await base44.entities.Quest.delete(quest.id);
                    totalQuestsDeleted++;
                  } catch (error) {
                    console.error(`删除关联任务失败 (ID: ${quest.id}):`, error);
                  }
                }
                
                // 删除项目本身
                await base44.entities.LongTermProject.delete(project.id);
                projectsDeleted++;
                console.log(`✅ 已清理项目: ${project.projectName} (完成于: ${project.completionDate})`);
              } catch (error) {
                console.error(`清理项目失败 (${project.projectName}):`, error);
              }
            }
            
            console.log(`✅ 大项目清理完成 - 删除 ${projectsDeleted} 个项目，${totalQuestsDeleted} 个关联任务`);
            batchInvalidateQueries(['hasLongTermQuests', 'quests']); // Invalidate relevant queries
          } else {
            console.log('✅ 没有需要清理的旧大项目');
          }
        } catch (error) {
          console.error('清理旧大项目时出错:', error);
        }
        
        console.log('=== 日更逻辑执行完成 ===');
      } catch (error) {
        console.error('日更逻辑执行失败:', error);
      } finally {
        // 🔧 无论成功失败，都关闭加载状态
        setIsDayRolloverInProgress(false);
      }
    };


    const handleDayRollover = async () => {
      // 游客模式下跳过日更逻辑
      if (!user) {
        console.log('游客模式，跳过日更逻辑');
        return;
      }

      // 如果正在处理连胜中断，跳过
      if (streakBreakInfo) {
        console.log('正在处理连胜中断，跳过日更逻辑');
        return;
      }

      // 🔥 【最优先】检查是否今天已完成所有日更（包括步骤0），避免重复执行
      if (hasCompletedRolloverToday(user.id)) {
        console.log('✅ 今日日更逻辑已全部完成，跳过');
        return;
      }

      console.log('=== 开始执行日更逻辑 (Initial Check) ===');

      // 步骤 0：检查昨天是否有未完成任务，处理连胜中断
      console.log('=== 步骤 0: 检查连胜中断 ===');
      const restDays = user?.restDays || [];
      const lastClearDate = user?.lastClearDate;

      console.log('今天日期:', today);
      console.log('昨天日期:', yesterday);
      console.log('上次完成日期:', lastClearDate);
      console.log('昨天是否为休息日:', restDays.includes(yesterday));

      // 只有在昨天不是休息日 AND 上次完成日期不是昨天 AND 今天也没完成时才检查
      const shouldCheckForStreakBreak = !restDays.includes(yesterday) && lastClearDate !== yesterday && lastClearDate !== today;

      if (shouldCheckForStreakBreak) {
        console.log('昨天不是休息日，且上次完成日期不是昨天或今天');

        const yesterdayQuests = await base44.entities.Quest.filter({ date: yesterday });
        console.log('昨天的任务数量:', yesterdayQuests.length);

        if (yesterdayQuests.length > 0) {
          const allDoneYesterday = yesterdayQuests.every(q => q.status === 'done');
          console.log('昨天任务是否全部完成:', allDoneYesterday);

          if (!allDoneYesterday) {
            console.log('昨天有未完成任务，需要处理连胜中断');
            const currentStreak = user?.streakCount || 0;
            const freezeTokenCount = user?.freezeTokenCount || 0;

            if (currentStreak > 0) {
              setStreakBreakInfo({
                incompleteDays: 1,
                currentStreak: currentStreak,
                freezeTokenCount: freezeTokenCount
              });

              console.log('弹出连胜中断对话框，暂停其他日更逻辑');
              setIsDayRolloverInProgress(false);
              return;
            } else {
              console.log('当前没有连胜（为0），无需触发连胜中断对话框');
            }
          } else {
            console.log('昨天所有任务都完成了');
          }
        } else {
          console.log('昨天没有任务');
        }
      } else {
        console.log('昨天是休息日或已完成所有任务，无需检查连胜中断');
      }

      // 立即显示加载弹窗
      setIsDayRolloverInProgress(true);
      await executeDayRolloverLogic();
      markRolloverComplete(user.id);
      };

    // 🔧 无论是否有用户都执行（游客模式下会快速返回并关闭加载状态）
    handleDayRollover();
  }, [user]); // Only depend on user to prevent double execution

  // Handle use token (called from StreakBreakDialog)
  const handleUseToken = async () => {
    try {
      const currentUser = user;

      // 🔧 修复：使用冻结券时，将 lastClearDate 设置为昨天，表示"昨天已处理"
      // 这样刷新后就不会再次触发连胜中断检查
      await base44.auth.updateMe({
        freezeTokenCount: (user?.freezeTokenCount || 0) - 1,
        lastClearDate: yesterday  // 关键修复：标记昨天已处理
      });

      await refreshUser(); // 刷新 AuthContext 中的用户数据
      batchInvalidateQueries(['user']);
      setStreakBreakInfo(null);

      setToast(t('questboard_toast_freeze_token_used'));
      setTimeout(() => setToast(null), 3000);

      // 刷新页面以确保所有数据同步（日更逻辑会在刷新后自动执行）
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('使用冻结券失败:', error);
      alert(t('questboard_alert_use_token_failed'));
    }
  };

  // Handle break streak (called from StreakBreakDialog)
  const handleBreakStreak = async () => {
    try {
      // 🔧 添加 streakManuallyReset 标记，区分"用户主动重置"和"bug导致丢失"
      await base44.auth.updateMe({
        streakCount: 0,
        streakManuallyReset: true,
        lastClearDate: yesterday  // 标记昨天已处理，避免再次触发连胜中断检查
      });

      await refreshUser(); // 刷新 AuthContext 中的用户数据
      batchInvalidateQueries(['user']);
      setStreakBreakInfo(null);

      setToast(t('questboard_toast_streak_broken'));
      setTimeout(() => setToast(null), 3000);

      // 刷新页面以确保所有数据同步（日更逻辑会在刷新后自动执行）
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('重置连胜失败:', error);
      alert(t('questboard_alert_break_streak_failed'));
    }
  };

  const createQuestMutation = useMutation({
    mutationFn: async (questData) => {
      console.log('=== createQuestMutation 开始 ===');
      console.log('原始数据:', questData);
      
      // 游客模式下不加密，直接使用明文
      let title = questData.title;
      let actionHint = questData.actionHint;
      
      if (user) {
        // 登录模式下加密
      const { data: encrypted } = await base44.functions.invoke('encryptQuestData', {
        title: questData.title,
        actionHint: questData.actionHint
      });
        title = encrypted.encryptedTitle;
        actionHint = encrypted.encryptedActionHint;
      console.log('加密完成，准备创建任务');
      } else {
        console.log('游客模式，使用明文保存任务');
      }
      
      const result = await base44.entities.Quest.create({
        ...questData,
        title,
        actionHint
      });
      
      console.log('任务创建成功');
      return result;
    },
    onSuccess: async () => {
      batchInvalidateQueries(['quests', 'user']);
      
      // 只有登录用户才处理休息日取消逻辑
      if (user) {
        const restDays = user?.restDays || [];
        if (restDays.includes(today)) {
          await base44.auth.updateMe({
            restDays: restDays.filter(d => d !== today)
          });
          setToast(t('questboard_toast_quest_added_rest_canceled'));
          setTimeout(() => setToast(null), 2000);
        }
      }
    }
  });

  const updateQuestMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updateData = { ...data };
      
      // 游客模式下不加密，直接使用明文
      if (user && (data.title !== undefined || data.actionHint !== undefined || data.originalActionHint !== undefined)) {
        const toEncrypt = {
          title: data.title,
          actionHint: data.actionHint,
          originalActionHint: data.originalActionHint
        };
        
        const { data: encrypted } = await base44.functions.invoke('encryptQuestData', toEncrypt);
        
        if (data.title !== undefined) updateData.title = encrypted.encryptedTitle;
        if (data.actionHint !== undefined) updateData.actionHint = encrypted.encryptedActionHint;
        if (data.originalActionHint !== undefined) updateData.originalActionHint = encrypted.originalActionHint;
      }
      // 游客模式：直接使用传入的数据（已经是明文）
      
      return base44.entities.Quest.update(id, updateData);
    },
    onSuccess: () => {
      batchInvalidateQueries(['quests']);
    }
  });

  const deleteQuestMutation = useMutation({
    mutationFn: (id) => base44.entities.Quest.delete(id),
    onSuccess: () => {
      batchInvalidateQueries(['quests']);
    }
  });

  const handleTextSubmit = async () => {
    if (!textInput.trim() || isProcessing) return;
    
    // 检查文本长度限制（50个汉字/单词）
    const TASK_MAX_LENGTH = 50;
    if (isTextOverLimit(textInput.trim(), TASK_MAX_LENGTH)) {
      alert(language === 'zh' 
        ? `任务内容过长！最多只能输入 ${TASK_MAX_LENGTH} 个汉字/单词。当前: ${calculateTextLength(textInput.trim())}` 
        : `Task content too long! Maximum ${TASK_MAX_LENGTH} characters/words. Current: ${calculateTextLength(textInput.trim())}`);
      return;
    }
    
    setIsProcessing(true);
    const loadingAudio = playLoadingSound();
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: getTaskNamingPrompt(language, textInput.trim(), false),
        response_json_schema: {
          type: "object",
          properties: {
            title: { 
              type: "string",
              description: language === 'zh'
                ? "必须严格是【2字类型】+正好7个汉字的描述！例如：【征讨】踏破晨曦五里征途。描述必须正好7个字，不能多也不能少！绝对不能包含'任务'二字！"
                : "Must strictly follow [Category]: <5-8 Word Epic Phrase> format! Category is action type, Phrase is 5-8 words. Example: [Conquest]: Dawn March Through Five Miles. Phrase must be 5-8 words exactly! Absolutely cannot include the word 'task' or 'quest'!"
            },
            actionHint: { 
              type: "string", 
              description: language === 'zh'
                ? "用户的原始输入，完全保持原样"
                : "User's original input, keep as-is"
            },
            difficulty: { type: "string", enum: ["C", "B", "A", "S"] },
            rarity: { type: "string", enum: ["Common", "Rare", "Epic", "Legendary"] }
          },
          required: ["title", "actionHint", "difficulty", "rarity"]
        }
      });

      setPendingQuests(prev => [...prev, {
        ...result,
        tags: [],
        tempId: Date.now()
      }]);
      
      setTextInput('');
    } catch (error) {
      console.error('❌ 任务处理错误:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        status: error.status,
        context: error.context,
        stack: error.stack,
        error: error
      });
      
      // 提供更友好的错误信息
      let errorMsg = error.message || t('common_try_again');
      if (error.message?.includes('non-2xx')) {
        errorMsg = 'Edge Function 调用失败。请检查：\n1. invoke-llm 函数是否已部署\n2. 查看浏览器控制台的详细错误';
      }
      
      alert(t('questboard_alert_task_parse_failed', { message: errorMsg }));
    }
    loadingAudio.pause();
    loadingAudio.currentTime = 0;
    setIsProcessing(false);
  };

  const handleUpdatePendingQuest = (tempId, field, value) => {
    setPendingQuests(prev => prev.map(q => 
      q.tempId === tempId ? { ...q, [field]: value } : q
    ));
  };

  const handleDeletePendingQuest = (tempId) => {
    setPendingQuests(prev => prev.filter(q => q.tempId !== tempId));
    if (expandedPending === tempId) {
      setExpandedPending(null);
    }
  };

  const playQuestAddedSound = () => {
    const audio = new Audio('/sounds/加入委托板.mp3');
    audio.play().catch(() => {});
  };

  const playLoadingSound = () => {
    const audio = new Audio('/sounds/加载时播放.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    return audio;
  };

  const handleConfirmPendingQuests = async () => {
    if (pendingQuests.length === 0 || isConfirmingPending) return;
    
    setIsConfirmingPending(true);
    const loadingAudio = playLoadingSound();
    try {
      for (const quest of pendingQuests) {
        await createQuestMutation.mutateAsync({
          title: quest.title,
          actionHint: quest.actionHint,
          difficulty: quest.difficulty,
          rarity: quest.rarity,
          date: today,
          status: 'todo',
          source: 'text',
          tags: quest.tags || []
        });
      }
      
      setPendingQuests([]);
      setExpandedPending(null);
      playQuestAddedSound();
      setToast(t('questboard_toast_quests_added_to_board', { count: pendingQuests.length }));
      setTimeout(() => setToast(null), 2000);
    } catch (error) {
      console.error('创建任务失败:', error);
      alert(t('questboard_alert_create_quest_failed'));
    }
    loadingAudio.pause();
    loadingAudio.currentTime = 0;
    setIsConfirmingPending(false);
  };

  const checkAndAwardMilestone = async (newStreak) => {
    const milestones = [
      { days: 7, title: '新秀冒险家', tokens: 1, icon: '🌟' },
      { days: 21, title: '精英挑战者', tokens: 2, icon: '⚔️' },
      { days: 50, title: '连胜大师', tokens: 3, icon: '🏆' },
      { days: 100, title: '传奇不灭', tokens: 5, icon: '👑' }
    ];

    const unlockedMilestones = user?.unlockedMilestones || [];
    
    for (const milestone of milestones) {
      if (newStreak === milestone.days && !unlockedMilestones.includes(milestone.days)) {
        const lootResult = await base44.integrations.Core.InvokeLLM({
          prompt: `你是【星陨纪元冒险者工会】的宝物铸造大师。一位冒险者达成了${milestone.days}天连胜的惊人成就，获得了「${milestone.title}」称号。请为这个里程碑铸造一件独一无二的纪念战利品。

里程碑：${milestone.days}天连胜
称号：${milestone.title}
象征图标：${milestone.icon}

要求：
1. 名称：要体现"${milestone.days}天"和"连胜"的概念，并与称号呼应
2. 简介：RPG风格，强调这是只有坚持${milestone.days}天才能获得的珍贵纪念品，暗示这份毅力的价值
3. 图标：使用 ${milestone.icon} 作为基础，可以组合其他emoji

请生成：`,
          response_json_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              flavorText: { type: "string" },
              icon: { type: "string" }
            }
          }
        });

        await base44.entities.Loot.create({
          ...lootResult,
          rarity: 'Legendary',
          obtainedAt: new Date().toISOString()
        });

        await base44.auth.updateMe({
          freezeTokenCount: (user?.freezeTokenCount || 0) + milestone.tokens,
          title: milestone.title,
          unlockedMilestones: [...unlockedMilestones, milestone.days]
        });

        setMilestoneReward({
          ...milestone,
          loot: lootResult
        });

        batchInvalidateQueries(['user', 'loot']);
        
        break;
      }
    }
  };

  const handleComplete = async (quest) => {
    console.log('=== 开始处理任务完成 ===');
    console.log('任务信息:', quest);
    
    try {
      await updateQuestMutation.mutateAsync({
        id: quest.id,
        data: { status: 'done' }
      });
      console.log('任务状态更新成功');
      
      setSelectedQuest(quest);

      batchInvalidateQueries(['quests']);
      console.log('查询缓存已刷新');

      // 处理大项目完成检查
      if (quest.isLongTermProject && quest.longTermProjectId) {
        setTimeout(async () => {
          try {
            const projectQuests = await base44.entities.Quest.filter({ 
              longTermProjectId: quest.longTermProjectId 
            });
            
            const allDone = projectQuests.every(q => q.status === 'done');
            
            if (allDone && projectQuests.length > 0) {
              console.log('=== 大项目所有任务已完成 ===');
              
              const project = await base44.entities.LongTermProject.filter({ 
                id: quest.longTermProjectId 
              });
              
              if (project.length > 0 && project[0].status === 'active') {
                await base44.entities.LongTermProject.update(project[0].id, {
                  status: 'completed',
                  completionDate: today
                });
                
                setCompletedProject(project[0]);
                setTimeout(() => {
                  setShowJointPraise(true);
                }, 1000);
              }
            }
          } catch (error) {
            console.error('检查大项目完成状态时出错:', error);
          }
        }, 500);
      }
      
      // 不再自动弹宝箱，改为手动开箱按钮
    } catch (error) {
      console.error('更新任务状态失败:', error);
    }
  };

  const handleReopen = async (quest) => {
    await updateQuestMutation.mutateAsync({
      id: quest.id,
      data: { status: 'todo' }
    });
    
    const messages = [
      t('questboard_reopen_toast_1'),
      t('questboard_reopen_toast_2'),
      t('questboard_reopen_toast_3'),
      t('questboard_reopen_toast_4')
    ];
    
    const message = messages[Math.floor(Math.random() * messages.length)];
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleEditQuestSave = async ({ actionHint, isRoutine, originalActionHint }) => {
    try {
      const contentChanged = actionHint !== editingQuest.actionHint;
      
      let newTitle = editingQuest.title;
      
      if (contentChanged) {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: getTaskNamingPrompt(language, actionHint, true),
          response_json_schema: {
            type: "object",
            properties: {
              title: { 
                type: "string",
                description: language === 'zh'
                  ? "必须严格是【2字类型】+正好7个汉字的描述！"
                  : "Must strictly follow [Category]: <5-8 Word Epic Phrase> format! Phrase must be 5-8 words exactly!"
              }
            },
            required: ["title"]
          }
        });
        
        newTitle = result.title;
      }

      const updateData = {
        title: newTitle,
        actionHint: actionHint,
        difficulty: editingQuest.difficulty,
        rarity: editingQuest.rarity,
        tags: editingQuest.tags || [],
        isRoutine: isRoutine,
        originalActionHint: isRoutine ? actionHint : null,
        date: editingQuest.date
      };

      await updateQuestMutation.mutateAsync({
        id: editingQuest.id,
        data: updateData
      });

      setToast(isRoutine ? t('questboard_toast_set_as_routine') : contentChanged ? t('questboard_toast_quest_updated') : t('questboard_toast_changes_saved'));
      setTimeout(() => setToast(null), 2000);

      setEditingQuest(null);

      batchInvalidateQueries(['quests', 'user']);
    } catch (error) {
      console.error("更新失败", error);
      alert(t('questboard_alert_update_failed'));
    }
  };

  const handleToggleRestDay = async () => {
    // 游客模式下不允许设置休息日（因为需要保存到 user 数据）
    if (!user) {
      alert(language === 'zh' 
        ? '游客模式下无法设置休息日（需要登录保存数据）' 
        : 'Cannot set rest day in guest mode (login required to save data)');
      return;
    }

    if (quests.length > 0 && !isRestDay) {
      alert(t('questboard_alert_cannot_set_rest_day_with_quests'));
      return;
    }
    
    try {
      const restDays = user?.restDays || [];
      const isRestDayCurrently = restDays.includes(today);
      
      if (isRestDayCurrently) {
        await base44.auth.updateMe({
          restDays: restDays.filter(d => d !== today)
        });
        setToast(t('questboard_toast_rest_canceled_success'));
      } else {
        await base44.auth.updateMe({
          restDays: [...restDays, today]
        });
        await refreshUser(); // 刷新 AuthContext 中的用户数据
        setToast(t('questboard_toast_rest_set_success'));
      }
      
      batchInvalidateQueries(['user']);
      setShowRestDayDialog(false);
      setTimeout(() => setToast(null), 2000);
    } catch (error) {
      console.error('设置休息日失败:', error);
      alert(language === 'zh'
        ? '操作失败，请重试'
        : 'Operation failed, please try again');
      setShowRestDayDialog(false);
    }
  };

  const handleChestClose = async () => {
    console.log('=== 宝箱关闭 ===');
    setShowChest(false);
    batchInvalidateQueries(['chest', 'quests']);
    
    // 宝箱关闭后，检查是否需要弹出规划弹窗（获取最新用户数据）
    if (user) {
      try {
        if (user.lastPlannedDate !== today) {
          console.log('=== 触发规划明日委托弹窗 ===');
          setShowCelebrationInPlanning(true);
          setShowPlanningDialog(true);
        }
      } catch (error) {
        console.error('获取用户数据失败:', error);
      }
    }
  };

  const handleOpenChest = async () => {
    console.log('=== 手动开启宝箱 ===');

    // 只有登录用户才更新连胜
    if (user) {
      // 刷新用户数据确保最新
      await refreshUser();
      console.log('当前用户数据:', user);
      console.log('lastClearDate:', user?.lastClearDate);
      console.log('今日日期:', today);

      if (user?.lastClearDate !== today) {
        // 计算连胜
        let newStreak = 1;
        const lastClearDate = user?.lastClearDate;
        const restDays = user?.restDays || [];

        if (lastClearDate) {
          let checkDate = new Date();
          checkDate.setDate(checkDate.getDate() - 1);

          let daysBack = 0;
          let foundLastWorkDay = false;

          while (daysBack < 365 && !foundLastWorkDay) {
            const checkDateStr = format(checkDate, 'yyyy-MM-dd');

            if (!restDays.includes(checkDateStr)) {
              if (checkDateStr === lastClearDate) {
                newStreak = (currentUser?.streakCount || 0) + 1;
                console.log('连续完成（跳过了休息日），连胜 +1，新连胜:', newStreak);
              } else {
                console.log('中断了，连胜重置为1');
                newStreak = 1;
              }
              foundLastWorkDay = true;
            }

            daysBack++;
            checkDate.setDate(checkDate.getDate() - 1);
          }

          if (!foundLastWorkDay) {
            console.log('未找到上一个工作日，连胜设为1');
            newStreak = 1;
          }
        } else {
          console.log('第一次完成所有任务，连胜设为1');
          newStreak = 1;
        }

        const newLongestStreak = Math.max(newStreak, currentUser?.longestStreak || 0);
        console.log('新的最长连胜:', newLongestStreak);

        await base44.auth.updateMe({
          streakCount: newStreak,
          longestStreak: newLongestStreak,
          lastClearDate: today
        });
        console.log('用户连胜数据已更新');

        await refreshUser(); // 刷新 AuthContext 中的用户数据
        batchInvalidateQueries(['user']);

        await checkAndAwardMilestone(newStreak);
      }
    }

    // 确保宝箱已创建
    const chests = await base44.entities.DailyChest.filter({ date: today });
    if (chests.length === 0) {
      await base44.entities.DailyChest.create({ 
        date: today, 
        opened: false 
      });
    }

    setShowChest(true);
  };

  const handlePlanSaved = async (plannedQuests) => {
    if (!user) return;
    
    try {
      await base44.auth.updateMe({
        nextDayPlannedQuests: plannedQuests,
        lastPlannedDate: today
      });
      
      await refreshUser(); // 刷新 AuthContext 中的用户数据
      batchInvalidateQueries(['user']);
      setToast(t('questboard_toast_plan_saved_success', { count: plannedQuests.length }));
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('保存规划失败:', error);
      alert(t('questboard_alert_save_plan_failed'));
    }
  };

  const handleOpenPlanning = () => {
    if (!user) {
      alert(language === 'zh'
        ? '游客模式下无法规划明日任务（需要登录保存数据）'
        : 'Cannot plan tomorrow\'s quests in guest mode (login required to save data)');
      return;
    }
    
    setShowCelebrationInPlanning(false);
    setShowPlanningDialog(true);
  };

  const handleLongTermQuestsCreated = (count) => {
    batchInvalidateQueries(['quests', 'hasLongTermQuests']);
    setToast(t('questboard_toast_longterm_quests_added_success', { count: count }));
    setTimeout(() => setToast(null), 3000);
  };

  const handleCalendarUpdate = () => {
    batchInvalidateQueries(['quests', 'hasLongTermQuests']);
    queryClient.refetchQueries({ queryKey: ['hasLongTermQuests'] });
  };

  const filteredQuests = quests.filter(quest => {
    if (filter === 'all') return true;
    if (filter === 'done') return quest.status === 'done';
    if (filter === 'todo') return quest.status === 'todo';
    return true;
  });

  const isRestDay = (user?.restDays || []).includes(today);
  const nextDayPlannedCount = (user?.nextDayPlannedQuests || []).length;
  const canShowPlanningButton = currentHour >= 21 && user?.lastPlannedDate !== today;

  // 检查是否所有任务都完成
  const allQuestsDone = quests.length > 0 && quests.every(q => q.status === 'done');

  // 检查今日宝箱状态
  const { data: todayChest } = useQuery({
    queryKey: ['chest', today],
    queryFn: async () => {
      try {
        const chests = await base44.entities.DailyChest.filter({ date: today });
        return chests.length > 0 ? chests[0] : null;
      } catch (error) {
        console.error('获取宝箱失败:', error);
        return null;
      }
    },
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  const canOpenChest = allQuestsDone && (!todayChest || !todayChest.opened);

  const difficultyColors = {
    C: '#FFE66D',
    B: '#FF6B35',
    A: '#C44569',
    S: '#000'
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="max-w-2xl mx-auto">
        <div 
          className="mb-6 p-4 transform -rotate-1"
          style={{
            backgroundColor: '#000',
            color: '#FFE66D',
            border: '5px solid #FFE66D',
            boxShadow: '8px 8px 0px #FFE66D'
          }}
        >
          <h1 className="text-3xl font-black uppercase text-center">
            ⚔️ {t('questboard_title')} ⚔️
          </h1>
          <p className="text-center font-bold mt-2 text-sm">
            {language === 'zh' 
              ? format(new Date(), 'yyyy年MM月dd日')
              : format(new Date(), 'MMMM dd, yyyy')}
          </p>
        </div>

        {isRestDay && (
          <div 
            className="mb-6 p-4"
            style={{
              backgroundColor: '#4ECDC4',
              border: '4px solid #000',
              boxShadow: '6px 6px 0px #000'
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Coffee className="w-6 h-6" strokeWidth={3} />
              <p className="font-black uppercase">{t('questboard_rest_day')}</p>
            </div>
            <p className="text-center text-sm font-bold mt-2">
              {t('questboard_rest_day_hint')}
            </p>
          </div>
        )}

        <div 
          className="p-4 mb-6"
          style={{
            backgroundColor: '#FFE66D',
            border: '4px solid #000',
            boxShadow: '6px 6px 0px #000'
          }}
        >
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={t('questboard_input_placeholder')}
                value={textInput}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const TASK_MAX_LENGTH = 50;
                  // 如果超过限制，截断
                  if (isTextOverLimit(newValue, TASK_MAX_LENGTH)) {
                    // 不更新，保持原值
                    return;
                  }
                  setTextInput(newValue);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleTextSubmit();
                  }
                }}
                disabled={isProcessing}
                className="w-full h-16 px-4 font-bold text-lg"
                style={{
                  backgroundColor: '#FFF',
                  border: '4px solid #000',
                  boxShadow: '5px 5px 0px #000'
                }}
              />
              <p className="text-xs font-bold mt-1" style={{ color: '#666' }}>
                {getTextLengthDescription(textInput, 50, language)}
              </p>
            </div>

            <Button
              onClick={handleTextSubmit}
              disabled={isProcessing || !textInput.trim()}
              className="flex-shrink-0 w-16 h-16 flex items-center justify-center font-black"
              style={{
                backgroundColor: '#C44569',
                border: '4px solid #000',
                boxShadow: '5px 5px 0px #000',
                opacity: (!textInput.trim() || isProcessing) ? 0.5 : 1
              }}
            >
              {isProcessing ? (
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#FFF' }} />
              ) : (
                <Sparkles className="w-8 h-8" strokeWidth={3} style={{ color: '#FFF', fill: 'none' }} />
              )}
            </Button>
          </div>

          <Button
            onClick={() => setShowLongTermDialog(true)}
            className="w-full py-3 font-black uppercase text-sm flex items-center justify-center gap-2"
            style={{
              backgroundColor: '#9B59B6',
              color: '#FFF',
              border: '4px solid #000',
              boxShadow: '5px 5px 0px #000'
            }}
          >
            <Briefcase className="w-5 h-5" strokeWidth={3} />
            {t('questboard_longterm_btn')}
          </Button>
          
          <p className="text-xs font-bold text-center mt-2" style={{ color: '#666' }}>
            {t('questboard_longterm_hint')}
          </p>

          {pendingQuests.length > 0 && (
            <div 
              className="mt-4 p-3"
              style={{
                backgroundColor: '#FFF',
                border: '3px solid #000'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black uppercase text-sm">
                  {t('questboard_pending_quests_title', { count: pendingQuests.length })}
                </h3>
              </div>

              <div className="space-y-2 mb-3">
                {pendingQuests.map((quest) => (
                  <div 
                    key={quest.tempId}
                    style={{
                      backgroundColor: '#F9FAFB',
                      border: '3px solid #000'
                    }}
                  >
                    <div 
                      className="p-3 flex items-start justify-between cursor-pointer gap-3"
                      onClick={() => setExpandedPending(expandedPending === quest.tempId ? null : quest.tempId)}
                    >
                      <div className="flex-1 min-w-0 flex items-start gap-3">
                        <span 
                          className="px-2 py-1 text-sm font-black flex-shrink-0"
                          style={{
                            backgroundColor: difficultyColors[quest.difficulty],
                            color: quest.difficulty === 'S' ? '#FFE66D' : '#000',
                            border: '2px solid #000'
                          }}
                        >
                          {quest.difficulty}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm mb-1 break-words leading-tight">{quest.title}</p>
                          <p className="text-xs font-bold text-gray-600 break-words">
                            ({quest.actionHint})
                          </p>
                        </div>
                      </div>
                      {expandedPending === quest.tempId ? (
                        <ChevronUp className="w-5 h-5 flex-shrink-0 mt-1" strokeWidth={3} />
                      ) : (
                        <ChevronDown className="w-5 h-5 flex-shrink-0 mt-1" strokeWidth={3} />
                      )}
                    </div>

                    {expandedPending === quest.tempId && (
                      <div className="px-3 pb-3 pt-0" style={{ borderTop: '2px solid #000' }}>
                        <div className="mb-3 mt-3">
                          <label className="block text-xs font-bold uppercase mb-2">
                            {t('questboard_pending_quest_content_label')}
                          </label>
                          <Input
                            type="text"
                            value={quest.actionHint}
                            onChange={(e) => handleUpdatePendingQuest(quest.tempId, 'actionHint', e.target.value)}
                            className="w-full px-3 py-2 font-bold text-sm"
                            style={{ border: '2px solid #000' }}
                          />
                        </div>

                        <div className="mb-3">
                          <label className="block text-xs font-bold uppercase mb-2">
                            {t('questboard_pending_quest_difficulty_label')}
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {['C', 'B', 'A', 'S'].map(level => (
                              <Button
                                key={level}
                                onClick={() => handleUpdatePendingQuest(quest.tempId, 'difficulty', level)}
                                className="py-2 font-black"
                                style={{
                                  backgroundColor: quest.difficulty === level ? difficultyColors[level] : '#F0F0F0',
                                  color: level === 'S' && quest.difficulty === level ? '#FFE66D' : '#000',
                                  border: quest.difficulty === level ? '3px solid #000' : '2px solid #000'
                                }}
                              >
                                {level}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <Button
                          onClick={() => handleDeletePendingQuest(quest.tempId)}
                          className="w-full py-2 font-bold uppercase text-sm"
                          style={{
                            backgroundColor: '#FFF',
                            color: '#FF6B35',
                            border: '2px solid #FF6B35'
                          }}
                        >
                          {t('questboard_pending_quest_delete_button')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleConfirmPendingQuests}
                disabled={isConfirmingPending}
                className="w-full py-3 font-black uppercase text-sm flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#4ECDC4',
                  border: '4px solid #000',
                  boxShadow: '4px 4px 0px #000',
                  opacity: isConfirmingPending ? 0.5 : 1
                }}
              >
                {isConfirmingPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={3} />
                    {t('common_adding')}...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" strokeWidth={3} />
                    {t('questboard_pending_quest_confirm_button', { count: pendingQuests.length })}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {(isLoadingLongTermQuests || hasAnyLongTermQuests) && (
          <div 
            className="mb-6 p-4"
            style={{
              backgroundColor: '#9B59B6',
              border: '4px solid #000',
              boxShadow: '6px 6px 0px #000'
            }}
          >
            <Button
              onClick={() => setShowCalendar(true)}
              disabled={isLoadingLongTermQuests}
              className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3 text-white"
              style={{ opacity: isLoadingLongTermQuests ? 0.6 : 1 }}
            >
              {isLoadingLongTermQuests ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" strokeWidth={3} />
                  {language === 'zh' ? '检查中...' : 'Checking...'}
                </>
              ) : (
                <>
                  <CalendarIcon className="w-6 h-6" strokeWidth={3} />
                  {t('questboard_calendar_btn')}
                </>
              )}
            </Button>
            <p className="text-center text-xs font-bold mt-2 text-white">
              {t('questboard_calendar_hint')}
            </p>
          </div>
        )}

        <div className="mb-6">
          <Button
            onClick={handleOpenChest}
            disabled={!canOpenChest}
            className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3"
            style={{
              backgroundColor: canOpenChest ? '#FFE66D' : '#E0E0E0',
              color: canOpenChest ? '#000' : '#999',
              border: '4px solid #000',
              boxShadow: '6px 6px 0px #000',
              opacity: canOpenChest ? 1 : 0.6
            }}
          >
            📦 {canOpenChest 
              ? (language === 'zh' ? '开启今日宝箱' : 'Open Daily Chest')
              : (language === 'zh' ? '今日宝箱（完成所有委托后开启）' : 'Daily Chest (Complete all quests to unlock)')
            }
          </Button>
        </div>

        {user && (nextDayPlannedCount > 0 || canShowPlanningButton) && (
          <div 
            className="mb-6 p-4"
            style={{
              backgroundColor: '#C44569',
              border: '4px solid #000',
              boxShadow: '6px 6px 0px #000'
            }}
          >
            {nextDayPlannedCount > 0 && (
              <Button
                onClick={handleOpenPlanning}
                className="w-full py-3 font-black uppercase flex items-center justify-center gap-2 mb-3"
                style={{
                  backgroundColor: '#FFE66D',
                  border: '3px solid #000',
                  boxShadow: '4px 4px 0px #000'
                }}
              >
                <CalendarIcon className="w-5 h-5" strokeWidth={3} />
                {t('questboard_planned_quests')} {nextDayPlannedCount} {t('common_items')}{language === 'zh' ? '委托' : ' quests'}
              </Button>
            )}

            {canShowPlanningButton && (
              <Button
                onClick={handleOpenPlanning}
                className="w-full py-3 font-black uppercase flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#FFE66D',
                  border: '3px solid #000',
                  boxShadow: '4px 4px 0px #000'
                }}
              >
                <CalendarIcon className="w-5 h-5" strokeWidth={3} />
                {t('questboard_plan_tomorrow')}
              </Button>
            )}

            {!canShowPlanningButton && nextDayPlannedCount === 0 && user?.lastPlannedDate !== today && (
              <p className="text-center text-xs font-bold text-white mt-2">
                💡 {language === 'zh' 
                  ? '晚上9点后可规划明日任务（或完成今日所有任务后自动弹出）' 
                  : 'Plan tomorrow\'s quests after 9 PM (or automatically after completing all today\'s quests)'}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 mb-6">
          {['all', 'todo', 'done'].map(f => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 py-2 font-black uppercase text-sm"
              style={{
                backgroundColor: filter === f ? '#4ECDC4' : '#FFF',
                color: '#000',
                border: '3px solid #000',
                boxShadow: filter === f ? '4px 4px 0px #000' : '2px 2px 0px #000',
                transform: filter === f ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <Filter className="w-4 h-4 inline mr-1" strokeWidth={3} />
              {t(`questboard_filter_${f}`)}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin" strokeWidth={4} />
            <p className="mt-4 text-sm font-bold text-gray-600">
              {language === 'zh' ? '加载任务中...' : 'Loading quests...'}
            </p>
          </div>
        ) : isError ? (
          <div 
            className="p-8 text-center"
            style={{
              backgroundColor: '#FFF',
              border: '4px solid #FF6B35',
              boxShadow: '6px 6px 0px #000'
            }}
          >
            <p className="text-xl font-black uppercase mb-2 text-red-600">
              {language === 'zh' ? '加载失败' : 'Loading Failed'}
            </p>
            <p className="font-bold text-gray-600 mb-4">
              {questsError?.message || (language === 'zh' ? '无法加载任务，请刷新页面重试' : 'Failed to load quests, please refresh and try again')}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 font-black uppercase"
              style={{
                backgroundColor: '#FFE66D',
                border: '3px solid #000',
                boxShadow: '3px 3px 0px #000'
              }}
            >
              {language === 'zh' ? '刷新页面' : 'Refresh Page'}
            </button>
          </div>
        ) : filteredQuests.length === 0 ? (
          <div 
            className="p-8 text-center"
            style={{
              backgroundColor: '#FFF',
              border: '4px solid #000',
              boxShadow: '6px 6px 0px #000'
            }}
          >
            <p className="text-2xl font-black uppercase mb-2">{t('questboard_no_quests')}</p>
            <p className="font-bold text-gray-600">{t('questboard_no_quests_hint')}</p>
          </div>
        ) : (
          <div>
            {filteredQuests.map(quest => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onComplete={handleComplete}
                onEdit={(q) => setEditingQuest(q)}
                onDelete={(id) => deleteQuestMutation.mutate(id)}
                onReopen={handleReopen}
              />
            ))}
          </div>
        )}

        <div className="mt-6">
          <Button
            onClick={() => setShowRestDayDialog(true)}
            disabled={!user || (quests.length > 0 && !isRestDay)}
            className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3"
            style={{
              backgroundColor: isRestDay ? '#FF6B35' : '#4ECDC4',
              color: isRestDay ? '#FFF' : '#000',
              border: '4px solid #000',
              boxShadow: '6px 6px 0px #000',
              opacity: (!user || (quests.length > 0 && !isRestDay)) ? 0.5 : 1
            }}
          >
            <Coffee className="w-6 h-6" strokeWidth={3} />
            {isRestDay ? t('questboard_cancel_rest') : t('questboard_set_rest')}
          </Button>
          {!user && (
            <p className="text-xs font-bold text-center mt-2" style={{ color: '#666' }}>
              {language === 'zh' ? '游客模式下无法设置休息日' : 'Cannot set rest day in guest mode'}
            </p>
          )}
          {user && quests.length > 0 && !isRestDay && (
            <p className="text-xs font-bold text-center mt-2" style={{ color: '#666' }}>
              {t('questboard_cannot_set_rest_day_hint')}
            </p>
          )}
        </div>

        {selectedQuest && (
          <PraiseDialog
            quest={selectedQuest}
            onClose={() => setSelectedQuest(null)}
            onAddNote={() => {
              alert(t('questboard_alert_review_notes_wip'));
            }}
          />
        )}

        {showChest && (
          <ChestOpening
            date={today}
            onClose={handleChestClose}
            onLootGenerated={() => {
              batchInvalidateQueries(['loot']);
            }}
          />
        )}

        {editingQuest && (
          <QuestEditFormModal
            quest={editingQuest}
            onSave={handleEditQuestSave}
            onClose={() => setEditingQuest(null)}
          />
        )}

        {showPlanningDialog && user && (
          <EndOfDaySummaryAndPlanning
            showCelebration={showCelebrationInPlanning}
            currentStreak={user?.streakCount || 0}
            onClose={() => {
              setShowPlanningDialog(false);
              setShowCelebrationInPlanning(false);
            }}
            onPlanSaved={handlePlanSaved}
          />
        )}

        {showLongTermDialog && (
          <LongTermProjectDialog
            onClose={() => setShowLongTermDialog(false)}
            onQuestsCreated={handleLongTermQuestsCreated}
          />
        )}

        {showCalendar && (
          <LongTermCalendar
            onClose={() => setShowCalendar(false)}
            onQuestsUpdated={handleCalendarUpdate}
          />
        )}

        {showJointPraise && completedProject && (
          <JointPraiseDialog
            project={completedProject}
            onClose={() => {
              setShowJointPraise(false);
              setCompletedProject(null);
            }}
          />
        )}

        {milestoneReward && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          >
            <div 
              className="relative max-w-lg w-full p-8 transform"
              style={{
                backgroundColor: '#FFE66D',
                border: '6px solid #000',
                boxShadow: '15px 15px 0px #000'
              }}
            >
              <div className="text-center">
                <div className="text-7xl mb-4 animate-bounce">{milestoneReward.icon}</div>
                
                <h2 
                  className="text-3xl font-black uppercase mb-3"
                  style={{ color: '#000' }}
                >
                  🎊 {t('milestone_reached')} 🎊
                </h2>

                <div 
                  className="mb-6 p-4"
                  style={{
                    backgroundColor: '#FFF',
                    border: '4px solid #000'
                  }}
                >
                  <p className="text-2xl font-black mb-3">{milestoneReward.days}{t('milestone_days_streak')}</p>
                  <p className="text-xl font-black uppercase mb-3" style={{ color: '#C44569' }}>
                    「{milestoneReward.title}」
                  </p>
                  <p className="font-bold text-sm leading-relaxed mb-4">
                    {t('milestone_congrats', { days: milestoneReward.days })}
                  </p>
                  
                  <div className="space-y-3">
                    <div 
                      className="p-3"
                      style={{
                        backgroundColor: '#4ECDC4',
                        border: '3px solid #000'
                      }}
                    >
                      <p className="font-black">{t('milestone_freeze_token_label')} +{milestoneReward.tokens}</p>
                    </div>
                    
                    <div 
                      className="p-3"
                      style={{
                        backgroundColor: '#FF6B35',
                        border: '3px solid #000'
                      }}
                    >
                      <p className="font-black text-white">🏅 {milestoneReward.title} {t('milestone_title_badge_label')}</p>
                    </div>

                    <div 
                      className="p-3 text-left"
                      style={{
                        backgroundColor: '#C44569',
                        border: '3px solid #000'
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{milestoneReward.loot.icon}</span>
                        <p className="font-black text-white">{milestoneReward.loot.name}</p>
                      </div>
                      <p className="font-bold text-sm text-white leading-relaxed">
                        {milestoneReward.loot.flavorText}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setMilestoneReward(null)}
                  className="w-full py-4 font-black uppercase text-xl"
                  style={{
                    backgroundColor: '#000',
                    color: '#FFE66D',
                    border: '5px solid #FFE66D',
                    boxShadow: '6px 6px 0px #FFE66D'
                  }}
                >
                  {t('milestone_claim_button')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showRestDayDialog && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
            onClick={() => setShowRestDayDialog(false)}
          >
            <div 
              className="relative max-w-lg w-full p-6 transform rotate-1"
              style={{
                backgroundColor: '#4ECDC4',
                border: '5px solid #000',
                boxShadow: '12px 12px 0px #000'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 
                className="text-2xl font-black uppercase text-center mb-4"
                style={{ color: '#000' }}
              >
                {isRestDay ? t('rest_day_dialog_cancel_title') : t('rest_day_dialog_set_title')}
              </h2>

              <div 
                className="mb-6 p-4"
                style={{
                  backgroundColor: '#FFF',
                  border: '3px solid #000'
                }}
              >
                {isRestDay ? (
                  <div className="space-y-3 font-bold text-sm">
                    <p>✓ {t('rest_day_dialog_cancel_hint_1')}</p>
                    <p>✓ {t('rest_day_dialog_cancel_hint_2')}</p>
                  </div>
                ) : (
                  <div className="space-y-3 font-bold text-sm">
                    <p>✓ {t('rest_day_dialog_set_hint_1')}</p>
                    <p>✓ {t('rest_day_dialog_set_hint_2')}</p>
                    <p>✓ {t('rest_day_dialog_set_hint_3')}</p>
                    <p className="text-xs" style={{ color: '#666' }}>
                      💡 {t('rest_day_dialog_set_hint_4')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRestDayDialog(false)}
                  className="flex-1 py-3 font-black uppercase"
                  style={{
                    backgroundColor: '#FFF',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000'
                  }}
                >
                  {t('common_cancel')}
                </Button>
                <Button
                  onClick={handleToggleRestDay}
                  className="flex-1 py-3 font-black uppercase"
                  style={{
                    backgroundColor: isRestDay ? '#FF6B35' : '#FFE66D',
                    color: isRestDay ? '#FFF' : '#000',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000'
                  }}
                >
                  {t('common_confirm')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {streakBreakInfo && (
        <StreakBreakDialog
          incompleteDays={streakBreakInfo.incompleteDays}
          currentStreak={streakBreakInfo.currentStreak}
          freezeTokenCount={streakBreakInfo.freezeTokenCount}
          onUseToken={handleUseToken}
          onBreakStreak={handleBreakStreak}
          onClose={() => setStreakBreakInfo(null)}
        />
      )}

      {/* 🔧 日更加载弹窗 - 页面加载时最先显示，日更逻辑完成后关闭 */}
      {isDayRolloverInProgress && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999
          }}
        >
          <div 
            className="relative max-w-md w-full p-8 transform"
            style={{
              backgroundColor: '#FFE66D',
              border: '5px solid #000',
              boxShadow: '12px 12px 0px #000'
            }}
          >
            <div className="text-center">
              <Loader2 
                className="w-16 h-16 mx-auto mb-4 animate-spin" 
                strokeWidth={4}
                style={{ color: '#000' }}
              />
              
              <h2 
                className="text-2xl font-black uppercase mb-3"
                style={{ color: '#000' }}
              >
                {language === 'zh' ? '⚙️ 工会同步中 ⚙️' : '⚙️ Guild Syncing ⚙️'}
              </h2>

              <div 
                className="p-4"
                style={{
                  backgroundColor: '#FFF',
                  border: '3px solid #000'
                }}
              >
                <p className="font-bold leading-relaxed">
                  {language === 'zh'
                    ? '正在加载今日委托和规划任务，请稍候片刻...'
                    : 'Loading today\'s quests and planned tasks, please wait...'}
                </p>
              </div>

              <p 
                className="text-xs font-bold mt-4"
                style={{ color: '#666' }}
              >
                {language === 'zh'
                  ? '💡 通常只需要几秒钟'
                  : '💡 This usually takes just a few seconds'}
              </p>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 animate-fade-in-out"
          style={{
            backgroundColor: '#4ECDC4',
            border: '4px solid #000',
            boxShadow: '6px 6px 0px #000',
            maxWidth: '90%'
          }}
        >
          <p className="font-black text-center">{toast}</p>
        </div>
      )}

      <style>{`
        @keyframes fade-in-out {
          0% { opacity: 0; transform: translate(-50%, -10px); }
          10%, 90% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -10px); }
        }
        .animate-fade-in-out {
          animation: fade-in-out 2s ease-in-out;
        }
      `}</style>
    </div>
  );
}
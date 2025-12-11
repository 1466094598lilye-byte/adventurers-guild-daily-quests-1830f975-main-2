import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import StreakDisplay from '../components/profile/StreakDisplay';
import { useLanguage } from '@/components/LanguageContext';

export default function JournalPage() {
  const { language, t } = useLanguage();

  // 从 AuthContext 获取用户信息
  const { user } = useAuth();

  // 固定获取最近7天的任务数据
  const { data: recentQuests = [] } = useQuery({
    queryKey: ['recentQuests'],
    queryFn: async () => {
      const quests = await base44.entities.Quest.list('-date', 200);
      return quests;
    }
  });

  // 生成最近7天的完成率数据
  const getLast7DaysData = () => {
    const data = [];
    const today = new Date();
    const restDays = user?.restDays || [];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      // 🔥 修复：包含每日修炼任务！它们是最重要的习惯追踪
      const dayQuests = recentQuests.filter(q => q.date === dateStr);
      
      const isRestDay = restDays.includes(dateStr);
      
      let completionRate = 0;
      if (!isRestDay && dayQuests.length > 0) {
        const doneCount = dayQuests.filter(q => q.status === 'done').length;
        completionRate = Math.round((doneCount / dayQuests.length) * 100);
      }

      data.push({
        date: format(date, language === 'zh' ? 'MM/dd' : 'MM/dd'),
        completionRate: isRestDay ? null : completionRate,
        isRestDay: isRestDay,
        totalQuests: dayQuests.length
      });
    }

    return data;
  };

  const chartData = getLast7DaysData();

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      if (data.isRestDay) {
        return (
          <div 
            className="p-3"
            style={{
              backgroundColor: '#4ECDC4',
              border: '3px solid #000',
              boxShadow: '4px 4px 0px #000'
            }}
          >
            <p className="font-black">{data.date}</p>
            <p className="font-bold text-sm">{language === 'zh' ? '🏖️ 休息日' : '🏖️ Rest Day'}</p>
          </div>
        );
      }

      return (
        <div 
          className="p-3"
          style={{
            backgroundColor: '#FFE66D',
            border: '3px solid #000',
            boxShadow: '4px 4px 0px #000'
          }}
        >
          <p className="font-black">{data.date}</p>
          <p className="font-bold">{language === 'zh' ? '完成率' : 'Completion'}: {data.completionRate}%</p>
          <p className="text-sm font-bold">{language === 'zh' ? '任务数' : 'Quests'}: {data.totalQuests}</p>
        </div>
      );
    }
    return null;
  };

  const getBarColor = (value) => {
    if (value === null) return '#4ECDC4';
    if (value === 100) return '#4ECDC4';
    if (value >= 50) return '#FFE66D';
    return '#FF6B35';
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="max-w-4xl mx-auto">
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
            📖 {t('journal_title')} 📖
          </h1>
        </div>

        {user && (
          <div className="mb-6">
            <StreakDisplay 
              currentStreak={user.streakCount || 0}
              longestStreak={user.longestStreak || 0}
              freezeTokens={user.freezeTokenCount || 0}
            />
          </div>
        )}

        <div 
          className="p-6"
          style={{
            backgroundColor: '#FFF',
            border: '5px solid #000',
            boxShadow: '8px 8px 0px #000'
          }}
        >
          <h2 className="text-2xl font-black uppercase mb-4">
            {t('journal_completion_trend')} (7{t('journal_days')})
          </h2>

          {chartData.every(d => d.totalQuests === 0 && !d.isRestDay) ? (
            <div className="text-center py-12">
              <p className="font-bold text-gray-600">
                {language === 'zh' ? '暂无数据' : 'No data available'}
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#999" />
                  <XAxis 
                    dataKey="date" 
                    style={{ 
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    style={{ 
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="completionRate" 
                    fill="#4ECDC4"
                    stroke="#000"
                    strokeWidth={2}
                    radius={[8, 8, 0, 0]}
                    shape={(props) => {
                      const { x, y, width, height, payload } = props;
                      const color = getBarColor(payload.completionRate);
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={color}
                          stroke="#000"
                          strokeWidth={2}
                          rx={8}
                          ry={8}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>

              <div 
                className="mt-6 p-4"
                style={{
                  backgroundColor: '#F9FAFB',
                  border: '3px solid #000'
                }}
              >
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div 
                      className="w-6 h-6 mx-auto mb-2"
                      style={{
                        backgroundColor: '#4ECDC4',
                        border: '2px solid #000'
                      }}
                    />
                    <p className="text-xs font-bold">{t('journal_legend_complete')}</p>
                  </div>
                  <div>
                    <div 
                      className="w-6 h-6 mx-auto mb-2"
                      style={{
                        backgroundColor: '#FFE66D',
                        border: '2px solid #000'
                      }}
                    />
                    <p className="text-xs font-bold">{t('journal_legend_partial')}</p>
                  </div>
                  <div>
                    <div 
                      className="w-6 h-6 mx-auto mb-2"
                      style={{
                        backgroundColor: '#FF6B35',
                        border: '2px solid #000'
                      }}
                    />
                    <p className="text-xs font-bold">{t('journal_legend_incomplete')}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
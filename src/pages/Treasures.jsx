import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Gem, Filter, ChevronLeft, ChevronRight, Hammer, ChevronDown, ChevronUp, Snowflake } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/LanguageContext';
import CraftingDialog from '@/components/treasure/CraftingDialog';
import { playSound } from '@/components/AudioManager';

export default function TreasuresPage() {
  const { t, language } = useLanguage();
  const [rarityFilter, setRarityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCraftingDialog, setShowCraftingDialog] = useState(false);
  const [expandedLoot, setExpandedLoot] = useState(new Set());
  const [showExchangeDialog, setShowExchangeDialog] = useState(false);
  const [selectedLegendaries, setSelectedLegendaries] = useState([]);
  const itemsPerPage = 7;
  const queryClient = useQueryClient();

  const { data: allLoot = [], isLoading } = useQuery({
    queryKey: ['loot'],
    queryFn: () => base44.entities.Loot.list('-created_date', 1000),
    initialData: [],
  });

  // 从 AuthContext 获取用户信息
  const { user } = useAuth();

  const legendaryLoot = allLoot.filter(l => l.rarity === 'Legendary');

  const exchangeMutation = useMutation({
    mutationFn: async (lootIds) => {
      // 删除选中的2个传说宝物
      await Promise.all(lootIds.map(id => base44.entities.Loot.delete(id)));
      
      // 增加1张冻结券
      await base44.auth.updateMe({
        freezeTokenCount: (user?.freezeTokenCount || 0) + 1
      });
    },
    onSuccess: () => {
      // 播放兑换成功音效
      playSound('craftingSuccess');
      
      queryClient.invalidateQueries(['loot']);
      queryClient.invalidateQueries(['user']);
      setSelectedLegendaries([]);
      setShowExchangeDialog(false);
    }
  });

  const filteredLoot = allLoot.filter(loot => {
    if (rarityFilter === 'all') return true;
    return loot.rarity === rarityFilter;
  });

  const totalPages = Math.ceil(filteredLoot.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLoot = filteredLoot.slice(startIndex, startIndex + itemsPerPage);

  const rarityCounts = {
    Common: allLoot.filter(l => l.rarity === 'Common').length,
    Rare: allLoot.filter(l => l.rarity === 'Rare').length,
    Epic: allLoot.filter(l => l.rarity === 'Epic').length,
    Legendary: allLoot.filter(l => l.rarity === 'Legendary').length,
  };

  const rarityColors = {
    Common: { bg: '#E8E8E8', text: '#333' },
    Rare: { bg: '#4ECDC4', text: '#000' },
    Epic: { bg: '#C44569', text: '#FFF' },
    Legendary: { bg: '#FFE66D', text: '#000' }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setExpandedLoot(new Set());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFilterChange = (rarity) => {
    setRarityFilter(rarity);
    setCurrentPage(1);
    setExpandedLoot(new Set());
  };

  const handleCraftSuccess = () => {
    queryClient.invalidateQueries(['loot']);
  };

  const toggleExpand = (lootId) => {
    const newExpanded = new Set(expandedLoot);
    if (newExpanded.has(lootId)) {
      newExpanded.delete(lootId);
    } else {
      newExpanded.add(lootId);
    }
    setExpandedLoot(newExpanded);
  };

  const toggleLegendarySelection = (lootId) => {
    setSelectedLegendaries(prev => {
      if (prev.includes(lootId)) {
        return prev.filter(id => id !== lootId);
      } else if (prev.length < 2) {
        return [...prev, lootId];
      }
      return prev;
    });
  };

  const handleExchange = () => {
    if (selectedLegendaries.length === 2) {
      exchangeMutation.mutate(selectedLegendaries);
    }
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="max-w-6xl mx-auto">
        <div 
          className="mb-6 p-4 transform -rotate-1"
          style={{
            backgroundColor: '#000',
            color: '#FFE66D',
            border: '5px solid #FFE66D',
            boxShadow: '8px 8px 0px #FFE66D'
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Gem className="w-8 h-8" strokeWidth={3} />
            <h1 className="text-3xl font-black uppercase text-center">
              {t('treasures_title')}
            </h1>
            <Gem className="w-8 h-8" strokeWidth={3} />
          </div>
          <p className="text-center font-bold text-sm">
            {t('treasures_collected')} {allLoot.length} {t('treasures_items')}
          </p>
        </div>

        {/* 合成宝物按钮 */}
        <div className="mb-6">
          <button
            onClick={() => {
              playSound('enterWorkshop');
              setShowCraftingDialog(true);
            }}
            className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3"
            style={{
              backgroundColor: '#FF6B35',
              color: '#FFF',
              border: '5px solid #000',
              boxShadow: '8px 8px 0px #000'
            }}
          >
            <Hammer className="w-7 h-7" strokeWidth={3} />
            🔨 {t('crafting_title')} 🔨
          </button>
        </div>

        {/* 传说宝物兑换冻结券 */}
        {legendaryLoot.length >= 2 && (
          <div 
            className="mb-6 p-4"
            style={{
              backgroundColor: '#9B59B6',
              border: '5px solid #000',
              boxShadow: '8px 8px 0px #000'
            }}
          >
            <button
              onClick={() => setShowExchangeDialog(true)}
              className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3 text-white"
            >
              <Snowflake className="w-7 h-7" strokeWidth={3} />
              {language === 'zh' ? '🎁 传说宝物兑换冻结券 🎁' : '🎁 Exchange Legendary for Freeze Token 🎁'}
            </button>
            <p className="text-center text-sm font-bold mt-3 text-white">
              {language === 'zh' 
                ? `💎 你有 ${legendaryLoot.length} 个传说宝物，可用2个兑换1张冻结券` 
                : `💎 You have ${legendaryLoot.length} Legendary items, exchange 2 for 1 Freeze Token`}
            </p>
          </div>
        )}

        {allLoot.length === 0 ? (
          <div 
            className="p-12 text-center"
            style={{
              backgroundColor: '#FFF',
              border: '5px solid #000',
              boxShadow: '8px 8px 0px #000'
            }}
          >
            <Gem className="w-24 h-24 mx-auto mb-6 text-gray-400" strokeWidth={3} />
            <p className="text-2xl font-black uppercase mb-3">
              {t('treasures_title')}
            </p>
            <p className="font-bold text-gray-600">
              {t('treasures_collected')} 0 {t('treasures_items')}
            </p>
          </div>
        ) : (
          <>
            <div 
              className="mb-6 p-4"
              style={{
                backgroundColor: '#FFE66D',
                border: '4px solid #000',
                boxShadow: '6px 6px 0px #000'
              }}
            >
              <h3 className="font-black uppercase mb-3 text-sm">{t('treasures_stats')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(rarityCounts).map(([rarity, count]) => (
                  <div 
                    key={rarity}
                    className="p-3 text-center"
                    style={{
                      backgroundColor: rarityColors[rarity].bg,
                      color: rarityColors[rarity].text,
                      border: '3px solid #000'
                    }}
                  >
                    <p className="text-2xl font-black">{count}</p>
                    <p className="text-xs font-bold uppercase">{t(`rarity_${rarity.toLowerCase()}`)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              {['all', 'Common', 'Rare', 'Epic', 'Legendary'].map(rarity => (
                <button
                  key={rarity}
                  onClick={() => handleFilterChange(rarity)}
                  className="px-4 py-2 font-black uppercase text-sm"
                  style={{
                    backgroundColor: rarityFilter === rarity 
                      ? (rarity === 'all' ? '#4ECDC4' : rarityColors[rarity].bg)
                      : '#FFF',
                    color: rarityFilter === rarity && ['Epic', 'Legendary'].includes(rarity) 
                      ? rarityColors[rarity].text 
                      : '#000',
                    border: '3px solid #000',
                    boxShadow: rarityFilter === rarity ? '4px 4px 0px #000' : '2px 2px 0px #000'
                  }}
                >
                  <Filter className="w-4 h-4 inline mr-1" strokeWidth={3} />
                  {rarity === 'all' ? t('treasures_filter_all') : t(`rarity_${rarity.toLowerCase()}`)}
                </button>
              ))}
            </div>

            {/* 紧凑型卡片布局 */}
            <div className="space-y-3 mb-6">
              {paginatedLoot.map((loot) => {
                const isExpanded = expandedLoot.has(loot.id);
                
                return (
                  <div
                    key={loot.id}
                    className="p-3 flex items-start gap-3"
                    style={{
                      backgroundColor: rarityColors[loot.rarity].bg,
                      color: rarityColors[loot.rarity].text,
                      border: '4px solid #000',
                      boxShadow: '4px 4px 0px #000'
                    }}
                  >
                    {/* 左侧：图标和稀有度 */}
                    <div className="flex-shrink-0 text-center">
                      <div className="text-4xl mb-2">{loot.icon}</div>
                      <div 
                        className="px-2 py-1 font-black uppercase text-xs"
                        style={{
                          backgroundColor: '#000',
                          color: '#FFE66D',
                          border: '2px solid #FFE66D'
                        }}
                      >
                        {t(`rarity_${loot.rarity.toLowerCase()}`)}
                      </div>
                    </div>

                    {/* 右侧：名称和描述 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black uppercase mb-2 leading-tight">
                        {loot.name}
                      </h3>

                      <div 
                        onClick={() => toggleExpand(loot.id)}
                        className="p-2 mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          color: '#000',
                          border: '2px solid #000'
                        }}
                      >
                        <p 
                          className={`font-bold text-xs leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}
                        >
                          {loot.flavorText}
                        </p>
                        
                        {/* 展开/收起指示器 */}
                        <div className="flex items-center justify-center mt-2 gap-1">
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" strokeWidth={3} />
                              <span className="text-xs font-black">{language === 'zh' ? '收起' : 'Collapse'}</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" strokeWidth={3} />
                              <span className="text-xs font-black">{language === 'zh' ? '展开' : 'Expand'}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-xs font-bold opacity-70">
                        {format(new Date(loot.obtainedAt || loot.created_date), 'yyyy-MM-dd HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div 
                className="flex items-center justify-between p-4"
                style={{
                  backgroundColor: '#FFF',
                  border: '4px solid #000',
                  boxShadow: '6px 6px 0px #000'
                }}
              >
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 font-black uppercase text-sm flex items-center gap-2"
                  style={{
                    backgroundColor: currentPage === 1 ? '#E0E0E0' : '#4ECDC4',
                    border: '3px solid #000',
                    boxShadow: '3px 3px 0px #000',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={3} />
                  {t('treasures_prev')}
                </button>

                <div className="font-black text-sm">
                  {t('treasures_page')} {currentPage} {t('treasures_page_of')} {totalPages}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 font-black uppercase text-sm flex items-center gap-2"
                  style={{
                    backgroundColor: currentPage === totalPages ? '#E0E0E0' : '#4ECDC4',
                    border: '3px solid #000',
                    boxShadow: '3px 3px 0px #000',
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  {t('treasures_next')}
                  <ChevronRight className="w-4 h-4" strokeWidth={3} />
                </button>
              </div>
            )}
          </>
        )}

        {/* 合成对话框 */}
        <CraftingDialog
          isOpen={showCraftingDialog}
          onClose={() => setShowCraftingDialog(false)}
          userLoot={allLoot}
          onCraftSuccess={handleCraftSuccess}
        />

        {/* 兑换冻结券对话框 */}
        {showExchangeDialog && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
            onClick={() => {
              setShowExchangeDialog(false);
              setSelectedLegendaries([]);
            }}
          >
            <div 
              className="relative max-w-2xl w-full p-6 transform rotate-1"
              style={{
                backgroundColor: '#9B59B6',
                border: '6px solid #000',
                boxShadow: '15px 15px 0px #000',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 
                className="text-2xl font-black uppercase text-center mb-4 text-white"
              >
                {language === 'zh' ? '⭐ 传说宝物兑换冻结券 ⭐' : '⭐ Exchange Legendary for Freeze Token ⭐'}
              </h2>

              <div 
                className="mb-6 p-4"
                style={{
                  backgroundColor: '#FFF',
                  border: '4px solid #000'
                }}
              >
                <p className="font-bold text-sm mb-3">
                  {language === 'zh' 
                    ? '📜 兑换规则：选择2个传说宝物，可兑换1张冻结券'
                    : '📜 Exchange Rule: Select 2 Legendary items to exchange for 1 Freeze Token'}
                </p>
                <p className="font-bold text-sm text-gray-600">
                  {language === 'zh' 
                    ? `✨ 已选择：${selectedLegendaries.length}/2`
                    : `✨ Selected: ${selectedLegendaries.length}/2`}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {legendaryLoot.map(loot => {
                  const isSelected = selectedLegendaries.includes(loot.id);
                  
                  return (
                    <div
                      key={loot.id}
                      onClick={() => toggleLegendarySelection(loot.id)}
                      className="p-4 flex items-center gap-4 cursor-pointer transition-all"
                      style={{
                        backgroundColor: isSelected ? '#FFE66D' : '#FFF',
                        border: isSelected ? '5px solid #000' : '3px solid #000',
                        boxShadow: isSelected ? '6px 6px 0px #000' : '3px 3px 0px #000',
                        transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                      }}
                    >
                      <div className="text-5xl">{loot.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-black uppercase text-lg mb-1">{loot.name}</h3>
                        <p className="text-xs font-bold text-gray-600 line-clamp-2">
                          {loot.flavorText}
                        </p>
                      </div>
                      {isSelected && (
                        <div 
                          className="flex-shrink-0 w-10 h-10 flex items-center justify-center font-black text-xl"
                          style={{
                            backgroundColor: '#4ECDC4',
                            border: '3px solid #000',
                            borderRadius: '50%'
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowExchangeDialog(false);
                    setSelectedLegendaries([]);
                  }}
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
                  onClick={handleExchange}
                  disabled={selectedLegendaries.length !== 2 || exchangeMutation.isLoading}
                  className="flex-1 py-3 font-black uppercase flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: selectedLegendaries.length === 2 ? '#4ECDC4' : '#E0E0E0',
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000',
                    opacity: selectedLegendaries.length === 2 ? 1 : 0.5,
                    cursor: selectedLegendaries.length === 2 ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Snowflake className="w-5 h-5" strokeWidth={3} />
                  {language === 'zh' ? '确认兑换' : 'Confirm Exchange'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 文字截断样式 */}
      <style>{`
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
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
    </div>
  );
}
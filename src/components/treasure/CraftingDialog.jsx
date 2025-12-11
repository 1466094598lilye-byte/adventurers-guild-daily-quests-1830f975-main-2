import { useState, useEffect } from 'react';
import { X, Sparkles, Flame } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/LanguageContext';
import { playSound, stopSound } from '@/components/AudioManager';

export default function CraftingDialog({ isOpen, onClose, userLoot, onCraftSuccess }) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  
  const [targetRarity, setTargetRarity] = useState('Rare');
  const [selectedLoot, setSelectedLoot] = useState([]);
  const [isCrafting, setIsCrafting] = useState(false);
  const [craftedLoot, setCraftedLoot] = useState(null);
  const [error, setError] = useState('');

  const recipes = {
    Rare: { from: 'Common', count: 5 },
    Epic: { from: 'Rare', count: 7 },
    Legendary: { from: 'Epic', count: 3 }
  };

  const allLoot = userLoot || [];
  const currentRecipe = recipes[targetRarity];
  const availableLoot = allLoot.filter(item => item.rarity === currentRecipe.from);
  const canCraft = selectedLoot.length === currentRecipe.count;

  useEffect(() => {
    setSelectedLoot([]);
    setError('');
  }, [targetRarity]);

  useEffect(() => {
    if (isOpen) {
      // 播放进入工坊音效
      (async () => {
        await playSound('enterWorkshop');
      })();
    } else {
      setSelectedLoot([]);
      setError('');
      setCraftedLoot(null);
      setTargetRarity('Rare');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const playSelectSound = async () => {
    await playSound('craftingSelect');
  };

  const toggleLootSelection = (loot) => {
    if (selectedLoot.find(item => item.id === loot.id)) {
      setSelectedLoot(selectedLoot.filter(item => item.id !== loot.id));
    } else if (selectedLoot.length < currentRecipe.count) {
      playSelectSound();
      setSelectedLoot([...selectedLoot, loot]);
    }
  };

  const handleCraft = async () => {
    if (!canCraft) return;

    setIsCrafting(true);
    setError('');

    // 播放合成中音效
    const craftingAudio = await playSound('craftingLoop', { loop: true });

    try {
      const { data: result } = await base44.functions.invoke('craftLoot', {
        lootIds: selectedLoot.map(item => item.id),
        targetRarity: targetRarity
      });

      if (result.success) {
        setCraftedLoot(result.newLoot);
        // 播放合成成功音效
        await playSound('craftingSuccess');
        if (onCraftSuccess) onCraftSuccess();
      } else {
        setError(result.error || (language === 'zh' ? '合成失败，请重试' : 'Crafting failed, please retry'));
      }
    } catch (err) {
      setError(language === 'zh' ? '合成失败，请重试' : 'Crafting failed, please retry');
    }

    stopSound(craftingAudio);
    setIsCrafting(false);
  };

  const rarityColors = {
    Common: { bg: '#E8E8E8', text: '#333', border: '#999' },
    Rare: { bg: '#4ECDC4', text: '#000', border: '#000' },
    Epic: { bg: '#C44569', text: '#FFF', border: '#000' },
    Legendary: { bg: '#FFE66D', text: '#000', border: '#000' }
  };

  if (craftedLoot) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setCraftedLoot(null);
            setSelectedLoot([]);
            onClose();
          }
        }}
      >
        <div 
          className="relative max-w-md w-full p-8 transform animate-bounce-in"
          style={{
            backgroundColor: rarityColors[targetRarity].bg,
            border: '6px solid #000',
            boxShadow: '15px 15px 0px #000'
          }}
        >
          <button
            onClick={() => {
              setCraftedLoot(null);
              setSelectedLoot([]);
              onClose();
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

          <div className="text-center">
            <div className="mb-6">
              <Sparkles className="w-20 h-20 mx-auto animate-pulse" 
                style={{ color: rarityColors[targetRarity].text }} 
                strokeWidth={3} 
              />
            </div>

            <h2 
              className="text-3xl font-black uppercase mb-4"
              style={{ color: rarityColors[targetRarity].text }}
            >
              {t('crafting_success_title')}
            </h2>

            <div 
              className="mb-4 p-3"
              style={{
                backgroundColor: '#FFF',
                border: '4px solid #000'
              }}
            >
              <div 
                className="px-4 py-2 font-black uppercase inline-block mb-3"
                style={{
                  backgroundColor: rarityColors[targetRarity].bg,
                  color: rarityColors[targetRarity].text,
                  border: '3px solid #000'
                }}
              >
                {t(`rarity_${targetRarity.toLowerCase()}`)}
              </div>

              <div className="text-6xl mb-3">{craftedLoot.icon}</div>

              <h3 className="text-2xl font-black mb-3">{craftedLoot.name}</h3>

              <p className="font-bold text-sm leading-relaxed">
                {craftedLoot.flavorText}
              </p>
            </div>

            <button
              onClick={async () => {
                // 播放收下宝物音效
                await playSound('collectTreasure');
                setCraftedLoot(null);
                setSelectedLoot([]);
                onClose();
              }}
              className="w-full py-4 font-black uppercase text-xl"
              style={{
                backgroundColor: '#000',
                color: '#FFE66D',
                border: '5px solid #FFE66D',
                boxShadow: '6px 6px 0px #FFE66D'
              }}
            >
              {t('crafting_collect')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 transform"
        style={{
          backgroundColor: '#F9FAFB',
          border: '5px solid #000',
          boxShadow: '12px 12px 0px #000'
        }}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-10 h-10 flex items-center justify-center z-10"
          style={{
            backgroundColor: '#FF6B35',
            border: '4px solid #000',
            boxShadow: '4px 4px 0px #000'
          }}
        >
          <X className="w-6 h-6" strokeWidth={4} />
        </button>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Flame className="w-16 h-16" style={{ color: '#FF6B35' }} strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-black uppercase mb-2">{t('crafting_title')}</h2>
          <p className="font-bold text-sm" style={{ color: '#666' }}>{t('crafting_subtitle')}</p>
        </div>

        {/* Target Rarity Selection */}
        <div className="mb-6">
          <h3 className="font-black uppercase mb-3">{t('crafting_target_rarity')}</h3>
          <div className="grid grid-cols-3 gap-3">
            {['Rare', 'Epic', 'Legendary'].map(rarity => (
              <button
                key={rarity}
                onClick={() => setTargetRarity(rarity)}
                className="py-3 font-black uppercase"
                style={{
                  backgroundColor: targetRarity === rarity ? rarityColors[rarity].bg : '#FFF',
                  color: targetRarity === rarity ? rarityColors[rarity].text : '#000',
                  border: `4px solid ${targetRarity === rarity ? '#000' : '#CCC'}`,
                  boxShadow: targetRarity === rarity ? '4px 4px 0px #000' : '2px 2px 0px #CCC'
                }}
              >
                {t(`rarity_${rarity.toLowerCase()}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Recipe Display */}
        <div 
          className="mb-6 p-4"
          style={{
            backgroundColor: rarityColors[targetRarity].bg,
            border: '4px solid #000',
            boxShadow: '4px 4px 0px #000'
          }}
        >
          <h3 
            className="font-black uppercase mb-2"
            style={{ color: rarityColors[targetRarity].text }}
          >
            {t('crafting_recipe')}
          </h3>
          <p 
            className="font-bold text-sm"
            style={{ color: rarityColors[targetRarity].text }}
          >
            {t('crafting_recipe_hint', { 
              count: currentRecipe.count,
              from: t(`rarity_${currentRecipe.from.toLowerCase()}`),
              to: t(`rarity_${targetRarity.toLowerCase()}`)
            })}
          </p>
        </div>

        {/* Selected Items */}
        {selectedLoot.length > 0 && (
          <div 
            className="mb-6 p-4"
            style={{
              backgroundColor: '#FFE66D',
              border: '4px solid #000'
            }}
          >
            <h3 className="font-black uppercase mb-3">
              {t('crafting_selected')} ({selectedLoot.length}/{currentRecipe.count})
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {selectedLoot.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleLootSelection(item)}
                  className="p-3 cursor-pointer text-center"
                  style={{
                    backgroundColor: '#FFF',
                    border: '3px solid #000'
                  }}
                >
                  <div className="text-3xl mb-1">{item.icon}</div>
                  <p className="font-bold text-xs line-clamp-1">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Materials */}
        <div className="mb-6">
          <h3 className="font-black uppercase mb-3">{t('crafting_available_loot')}</h3>
          
          {availableLoot.length === 0 ? (
            <div 
              className="p-6 text-center"
              style={{
                backgroundColor: '#FFF',
                border: '4px solid #000'
              }}
            >
              <p className="font-bold">{t('crafting_no_materials')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-2"
              style={{
                backgroundColor: '#FFF',
                border: '4px solid #000'
              }}
            >
              {availableLoot.map(item => {
                const isSelected = selectedLoot.find(sel => sel.id === item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleLootSelection(item)}
                    className="p-3 cursor-pointer text-center transition-all"
                    style={{
                      backgroundColor: isSelected ? '#4ECDC4' : '#F9FAFB',
                      border: `3px solid ${isSelected ? '#000' : '#CCC'}`,
                      boxShadow: isSelected ? '3px 3px 0px #000' : 'none',
                      opacity: selectedLoot.length === currentRecipe.count && !isSelected ? 0.5 : 1
                    }}
                  >
                    <div className="text-3xl mb-1">{item.icon}</div>
                    <p className="font-bold text-xs line-clamp-2">{item.name}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="mb-4 p-3"
            style={{
              backgroundColor: '#FF6B35',
              border: '3px solid #000',
              color: '#FFF'
            }}
          >
            <p className="font-bold text-center">{error}</p>
          </div>
        )}

        {/* Craft Button */}
        <button
          onClick={handleCraft}
          disabled={!canCraft || isCrafting}
          className="w-full py-4 font-black uppercase text-xl flex items-center justify-center gap-3"
          style={{
            backgroundColor: canCraft && !isCrafting ? '#4ECDC4' : '#CCC',
            border: '5px solid #000',
            boxShadow: canCraft && !isCrafting ? '6px 6px 0px #000' : '3px 3px 0px #000',
            opacity: canCraft && !isCrafting ? 1 : 0.6,
            cursor: canCraft && !isCrafting ? 'pointer' : 'not-allowed'
          }}
        >
          <Sparkles className="w-6 h-6" strokeWidth={3} />
          {isCrafting ? t('crafting_in_progress') : t('crafting_button')}
        </button>
      </div>
    </div>
  );
}
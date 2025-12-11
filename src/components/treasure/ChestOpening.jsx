import { useState } from 'react';
import { Gift, Sparkles, X, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/components/LanguageContext';
import { getTreasurePrompt } from '@/components/prompts';
import { playSound } from '@/components/AudioManager';

export default function ChestOpening({ date, onClose, onLootGenerated }) {
  const { language, t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [isOpening, setIsOpening] = useState(false);
  const [loot, setLoot] = useState(null);
  const [gotFreezeToken, setGotFreezeToken] = useState(false);
  const [isPity, setIsPity] = useState(false);
  const [showLoot, setShowLoot] = useState(false);
  const queryClient = useQueryClient();

  const openChest = async () => {
    setIsOpening(true);

    setTimeout(async () => {
      try {
        // 刷新用户数据确保最新
        await refreshUser();
        const currentCounter = user?.chestOpenCounter || 0;
        const newCounter = currentCounter + 1;

        let wonFreezeToken = false;
        let hitPity = false;
        
        if (newCounter >= 60) {
          wonFreezeToken = true;
          hitPity = true;
        } else {
          const freezeTokenRoll = Math.random() * 100;
          wonFreezeToken = freezeTokenRoll < 1;
        }

        const rarityRoll = Math.random() * 100;
        let rarity;
        if (rarityRoll < 70) rarity = 'Common';
        else if (rarityRoll < 90) rarity = 'Rare';
        else if (rarityRoll < 98) rarity = 'Epic';
        else rarity = 'Legendary';

        const { prompt } = getTreasurePrompt(language, rarity);

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: prompt,
          response_json_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              flavorText: { type: "string" },
              icon: { type: "string" }
            }
          }
        });

        const newLoot = {
          ...result,
          rarity: rarity,
          obtainedAt: new Date().toISOString()
        };

        const savedLoot = await base44.entities.Loot.create(newLoot);

        const updateData = {
          chestOpenCounter: wonFreezeToken ? 0 : newCounter
        };

        if (wonFreezeToken) {
          updateData.freezeTokenCount = (user?.freezeTokenCount || 0) + 1;
        }

        await base44.auth.updateMe(updateData);
        await refreshUser(); // 刷新 AuthContext 中的用户数据
        queryClient.invalidateQueries(['user']);

        const chests = await base44.entities.DailyChest.filter({ date });
        if (chests.length > 0) {
          await base44.entities.DailyChest.update(chests[0].id, {
            opened: true,
            lootIds: [...(chests[0].lootIds || []), savedLoot.id]
          });
        }

        setLoot(savedLoot);
        setGotFreezeToken(wonFreezeToken);
        setIsPity(hitPity);
        setShowLoot(true);
        
        // 宝物出来时播放开箱音效
        playSound('chestOpen');
        
        onLootGenerated(savedLoot);
      } catch (error) {
        alert(language === 'zh' ? '开箱失败，请重试' : 'Failed to open chest, please retry');
      }
      setIsOpening(false);
    }, 2000);
  };

  const rarityColors = {
    Common: { bg: '#E8E8E8', text: '#333' },
    Rare: { bg: '#4ECDC4', text: '#000' },
    Epic: { bg: '#C44569', text: '#FFF' },
    Legendary: { bg: '#FFE66D', text: '#000' }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0,0,0,0.95)',
        zIndex: 70
      }}
    >
      <div 
        className="relative max-w-md w-full p-8 transform"
        style={{
          backgroundColor: '#4ECDC4',
          border: '5px solid #000',
          boxShadow: '12px 12px 0px #000',
          transform: showLoot ? 'scale(1)' : 'scale(0.9)',
          transition: 'all 0.3s'
        }}
      >
        {!showLoot ? (
          <>
            <div className="flex justify-center mb-6">
              <div 
                className={`w-32 h-32 flex items-center justify-center ${isOpening ? 'animate-bounce' : ''}`}
                style={{
                  backgroundColor: '#FFE66D',
                  border: '5px solid #000',
                  boxShadow: '8px 8px 0px #000',
                  transform: isOpening ? 'rotate(0deg)' : 'rotate(-5deg)'
                }}
              >
                <Gift className="w-20 h-20" strokeWidth={4} />
              </div>
            </div>

            <h2 
              className="text-3xl font-black uppercase text-center mb-4"
              style={{
                color: '#000',
                textShadow: '3px 3px 0px rgba(255,255,255,0.5)'
              }}
            >
              {t('chest_title')}
            </h2>

            <p className="text-center font-bold mb-6">
              {t('chest_congrats')}
            </p>

            <button
              onClick={openChest}
              disabled={isOpening}
              className="w-full py-4 font-black uppercase text-xl flex items-center justify-center gap-3"
              style={{
                backgroundColor: '#FF6B35',
                color: '#FFF',
                border: '5px solid #000',
                boxShadow: '6px 6px 0px #000',
                opacity: isOpening ? 0.7 : 1
              }}
            >
              <Sparkles className="w-6 h-6" strokeWidth={4} />
              {isOpening ? t('chest_opening') : t('chest_open_btn')}
            </button>
          </>
        ) : (
          <>
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

            <div className="text-center">
              {gotFreezeToken && (
                <div 
                  className="mb-4 p-4 animate-pulse"
                  style={{
                    backgroundColor: isPity ? '#FF6B35' : '#FFE66D',
                    border: '4px solid #000',
                    boxShadow: '6px 6px 0px #000'
                  }}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Shield className="w-8 h-8" strokeWidth={3} />
                    <span className="text-2xl font-black">{t('chest_freeze_token')} +1</span>
                  </div>
                  <p className="text-sm font-bold">
                    {isPity ? t('chest_freeze_pity') : t('chest_freeze_lucky')}
                  </p>
                </div>
              )}

              <div className="flex justify-center mb-4">
                <div 
                  className="px-4 py-2 font-black uppercase"
                  style={{
                    backgroundColor: rarityColors[loot.rarity].bg,
                    color: rarityColors[loot.rarity].text,
                    border: '4px solid #000',
                    boxShadow: '4px 4px 0px #000'
                  }}
                >
                  {t(`rarity_${loot.rarity.toLowerCase()}`)}
                </div>
              </div>

              <div className="text-6xl mb-4">{loot.icon}</div>

              <h3 
                className="text-2xl font-black uppercase mb-4"
                style={{ color: '#000' }}
              >
                {loot.name}
              </h3>

              <div 
                className="p-4 mb-6"
                style={{
                  backgroundColor: '#FFF',
                  border: '3px solid #000'
                }}
              >
                <p className="font-bold leading-relaxed text-sm">
                  {loot.flavorText}
                </p>
              </div>

              <button
                onClick={() => {
                  playSound('collectTreasure');
                  onClose();
                }}
                className="w-full py-3 font-black uppercase"
                style={{
                  backgroundColor: '#FFE66D',
                  border: '4px solid #000',
                  boxShadow: '5px 5px 0px #000'
                }}
              >
                {t('chest_collect')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
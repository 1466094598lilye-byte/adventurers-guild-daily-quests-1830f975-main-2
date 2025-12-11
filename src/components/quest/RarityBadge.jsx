export default function RarityBadge({ rarity }) {
  const configs = {
    Common: { bg: '#E8E8E8', text: '#333', icon: '○' },
    Rare: { bg: '#4ECDC4', text: '#000', icon: '◇' },
    Epic: { bg: '#C44569', text: '#FFF', icon: '★' },
    Legendary: { bg: '#FFE66D', text: '#000', icon: '✦' }
  };

  const config = configs[rarity] || configs.Common;

  return (
    <div 
      className="inline-flex items-center gap-1 px-2 py-1 font-bold text-xs uppercase tracking-wide"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: '3px solid #000',
        boxShadow: '3px 3px 0px rgba(0,0,0,1)'
      }}
    >
      <span>{config.icon}</span>
      <span>{rarity}</span>
    </div>
  );
}
export default function DifficultyBadge({ difficulty, isRainbowS }) {
  const colors = {
    C: { bg: '#FFE66D', text: '#000', border: '#000' },
    B: { bg: '#FF6B35', text: '#FFF', border: '#000' },
    A: { bg: '#C44569', text: '#FFF', border: '#000' },
    S: { bg: '#000', text: '#FFE66D', border: '#FFE66D' }
  };

  const colorConfig = colors[difficulty] || colors.C;

  // 如果是彩虹S，使用特殊样式
  if (isRainbowS && difficulty === 'S') {
    return (
      <div 
        className="flex items-center justify-center w-12 h-12 font-black text-xl transform -rotate-3 animate-pulse"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
          color: '#FFF',
          border: '4px solid #000',
          boxShadow: '4px 4px 0px rgba(0,0,0,1)',
          textShadow: '2px 2px 0px #000'
        }}
      >
        S
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-center w-12 h-12 font-black text-xl transform -rotate-3"
      style={{
        backgroundColor: colorConfig.bg,
        color: colorConfig.text,
        border: `4px solid ${colorConfig.border}`,
        boxShadow: '4px 4px 0px rgba(0,0,0,1)'
      }}
    >
      {difficulty}
    </div>
  );
}
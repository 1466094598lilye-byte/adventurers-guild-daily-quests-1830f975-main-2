
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function VoiceInput({ onQuestsGenerated }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(1);
  const [audioLevels, setAudioLevels] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 32;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevels = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const levels = [];
        const step = Math.floor(dataArray.length / 10);
        for (let i = 0; i < 10; i++) {
          const value = dataArray[i * step] / 255;
          levels.push(Math.min(value * 1.5, 1));
        }
        
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      
      updateLevels();
    } catch (error) {
      console.error('无法访问麦克风:', error);
    }
  };

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  };

  const startRecording = async () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        alert('您的浏览器不支持语音识别，请使用文本输入');
        return;
      }

      const recognition = new SpeechRecognition();
      
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsRecording(true);
        startAudioVisualization();
        console.log('语音识别已启动');
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        let avgConfidence = 0;
        let confidenceCount = 0;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;
          
          if (result[0].confidence !== undefined) {
            avgConfidence += result[0].confidence;
            confidenceCount++;
          }
          
          if (result.isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimTranscript += transcriptText;
          }
        }

        if (confidenceCount > 0) {
          setConfidence(avgConfidence / confidenceCount);
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        setIsRecording(false);
        stopAudioVisualization();
        
        // 根据不同错误类型给出具体提示
        if (event.error === 'network') {
          alert('网络连接失败，语音识别需要稳定的网络连接。\n\n建议：\n1. 检查网络连接\n2. 使用文本输入框输入任务\n3. 刷新页面后重试');
        } else if (event.error === 'no-speech') {
          alert('没有检测到语音，请重试');
        } else if (event.error === 'not-allowed') {
          alert('麦克风权限被拒绝。\n\n请在浏览器设置中允许使用麦克风，或直接使用文本输入框输入任务。');
        } else if (event.error === 'aborted') {
          // 用户主动停止，不显示错误
          console.log('用户停止录音');
        } else {
          alert(`语音识别失败：${event.error}\n\n建议使用下方文本输入框直接输入任务`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        stopAudioVisualization();
        console.log('语音识别已结束');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('启动语音识别失败:', error);
      alert('无法启动语音识别，请检查浏览器权限');
    }
  };

  const stopRecording = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      stopAudioVisualization();
      
      if (transcript.trim()) {
        await handleTextSubmit(transcript, confidence);
      }
    }
  };

  const handleTextSubmit = async (text, conf = 1) => {
    if (!text.trim()) return;
    
    // 保存用户原始输入
    const userOriginalText = text.trim();
    
    setIsProcessing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `你是【星陨纪元冒险者工会】的首席史诗书记官，你不仅擅长为平凡任务注入奇幻色彩，更能从每个委托的细节中提炼其核心精髓，铸造出独一无二的专属称号。

用户输入：${userOriginalText}

你的任务：
1. **识别并拆分**用户输入中的所有独立任务
2. **深入分析**每个任务，提取其**核心动词、名词和关键情境**
3. **结合分析结果**，为每个任务创作一个**专属的RPG风格标题**，使其既有奇幻感，又**精准映射**任务的具体行动
4. 评定难度和稀有度，保留用户的原始任务描述作为 actionHint

任务识别规则：
- 如果用户说了多个任务（例如："跑步5km，然后去超市买菜，下午开会"），需要拆分成3个独立任务
- 每个任务都要有清晰的行动内容
- 常见分隔符：逗号、然后、接着、还有、以及、和、另外等
- 如果只有一个任务，就返回一个任务

RPG标题创作细则：
1. **专属感优先**：标题必须从具体的 actionHint 中提炼元素，体现出为这个特定任务量身定制的感觉
   - 例如："给猫喂食" → 【喂养】唤醒沉睡魔宠（突出"猫"→"魔宠"的转化）
   - 例如："整理房间" → 【秩序】净化混乱居所（突出"房间"+"整理"的本质）
   - 例如："去超市买菜" → 【采集】市集寻觅鲜蔬（具体到"买菜"→"鲜蔬"）

2. **标题主体**：7个字

3. **格式**：【2字类型】+ 7字标题

4. **类型词库**：修炼/采集/探索/讨伐/试炼/谈判/淬炼/磨砺/夺回/寻回/护送/调查/狩猎/救援/喂养/秩序/交易/传讯/净化/整顿

5. **奇幻化词汇**（要结合具体任务内容使用）：
   - 超市→集市/市集
   - 跑步→疾行/晨跑
   - 读书→研读/阅卷
   - 退货→夺回/寻回
   - 开会→议事/会谈
   - 健身→修炼/锻体
   - 写作→笔录/记录
   - 猫/狗→魔宠/灵兽
   - 房间→居所/巢穴
   - 妈妈→远方羁绊
   - 垃圾→腐败之物

6. **禁用词**：的/之/冒号

7. **风格**：简洁有力、略带戏剧感，标题要有节奏感和画面感，更要体现**任务的独特性**

✓ 优秀示例（专属感强）：
- 用户输入："给猫喂食"
  标题：【喂养】唤醒沉睡魔宠
  
- 用户输入："打电话给妈妈"
  标题：【传讯】连接远方羁绊
  
- 用户输入："清理垃圾"
  标题：【净化】扫除腐败源头
  
- 用户输入："跑步5km"
  标题：【修炼】破晓五里疾行
  
- 用户输入："去超市买菜"
  标题：【采集】市集寻觅鲜蔬

❌ 避免通用化（专属感弱）：
- "给猫喂食" → 【喂养】驯化异兽（太通用，没体现"猫"）
- "整理房间" → 【整顿】收拾空间（太普通，缺少奇幻感）
- "跑步" → 【修炼】锻炼身体（太空泛，没有具体细节）

请返回一个任务数组，每个任务包含：title（RPG标题）、actionHint（用户原始任务内容）、difficulty、rarity`,
        response_json_schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  actionHint: { type: "string" },
                  difficulty: { type: "string", enum: ["C", "B", "A", "S"] },
                  rarity: { type: "string", enum: ["Common", "Rare", "Epic", "Legendary"] }
                },
                required: ["title", "actionHint", "difficulty", "rarity"]
              }
            }
          },
          required: ["tasks"]
        }
      });

      // 处理返回的任务数组
      const generatedQuests = result.tasks.map(task => ({
        title: task.title,
        actionHint: task.actionHint,
        difficulty: task.difficulty,
        rarity: task.rarity,
        tags: []
      }));

      console.log('生成的任务数量:', generatedQuests.length);
      console.log('生成的任务:', generatedQuests);

      onQuestsGenerated(generatedQuests);
      setTranscript('');
      setConfidence(1);
    } catch (error) {
      console.error('文本处理错误:', error);
      alert(`任务解析失败：${error.message || '请重试'}`);
    }
    setIsProcessing(false);
  };

  return (
    <div 
      className="p-4 mb-6"
      style={{
        backgroundColor: '#FFE66D',
        border: '4px solid #000',
        boxShadow: '6px 6px 0px #000'
      }}
    >
      {!isRecording ? (
        <div className="flex gap-3">
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="flex-shrink-0 w-16 h-16 flex items-center justify-center font-black transition-all"
            style={{
              backgroundColor: '#4ECDC4',
              border: '4px solid #000',
              boxShadow: '5px 5px 0px #000'
            }}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#000' }} />
            ) : (
              <Mic className="w-8 h-8" strokeWidth={3} style={{ color: '#000' }} />
            )}
          </button>

          <div className="flex-1">
            <input
              type="text"
              placeholder="说出你的任务，如：明天早上7点跑步5公里..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleTextSubmit(transcript, 1);
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
          </div>

          <button
            onClick={() => handleTextSubmit(transcript, 1)}
            disabled={isProcessing || !transcript.trim()}
            className="flex-shrink-0 w-16 h-16 flex items-center justify-center font-black"
            style={{
              backgroundColor: '#C44569',
              border: '4px solid #000',
              boxShadow: '5px 5px 0px #000',
              opacity: (!transcript.trim() || isProcessing) ? 0.5 : 1
            }}
          >
            <Sparkles className="w-8 h-8" strokeWidth={3} style={{ color: '#FFF', fill: 'none' }} />
          </button>
        </div>
      ) : (
        <div>
          <div 
            className="p-6 mb-3"
            style={{
              backgroundColor: '#FFF',
              border: '4px solid #000',
              boxShadow: '5px 5px 0px #000'
            }}
          >
            <div className="flex items-end justify-center gap-1 mb-4" style={{ height: '80px' }}>
              {audioLevels.map((level, i) => (
                <div
                  key={i}
                  className="transition-all duration-100 ease-out"
                  style={{
                    width: '8%',
                    height: `${Math.max(level * 100, 10)}%`,
                    backgroundColor: '#FF6B35',
                    border: '2px solid #000',
                    boxShadow: '2px 2px 0px #000'
                  }}
                />
              ))}
            </div>

            <div className="min-h-[40px] flex items-center justify-center">
              {transcript ? (
                <p className="font-bold text-lg text-center">{transcript}</p>
              ) : (
                <p className="font-bold text-gray-400 text-center">正在聆听...</p>
              )}
            </div>
          </div>

          <button
            onClick={stopRecording}
            className="w-full py-4 font-black uppercase text-lg flex items-center justify-center gap-3"
            style={{
              backgroundColor: '#FF6B35',
              color: '#FFF',
              border: '4px solid #000',
              boxShadow: '5px 5px 0px #000'
            }}
          >
            <MicOff className="w-6 h-6" strokeWidth={3} style={{ color: '#FFF' }} />
            完成录音
          </button>
        </div>
      )}
    </div>
  );
}

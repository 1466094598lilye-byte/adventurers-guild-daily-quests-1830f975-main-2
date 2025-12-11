/**
 * 文本长度限制工具
 * 用于计算和限制输入文本的长度（汉字和单词）
 */

/**
 * 计算文本的有效长度
 * 汉字算1个，英文单词算1个
 * @param {string} text - 输入文本
 * @returns {number} - 有效长度
 */
export const calculateTextLength = (text) => {
  if (!text) return 0;
  
  // 匹配汉字（CJK统一汉字）
  const chineseRegex = /[\u4e00-\u9fa5]/g;
  const chineseCount = (text.match(chineseRegex) || []).length;
  
  // 匹配英文单词（字母序列，至少2个字符）
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, ' ') // 将汉字替换为空格
    .trim()
    .split(/\s+/) // 按空格分割
    .filter(word => /[a-zA-Z]{2,}/.test(word)); // 过滤出至少2个字母的单词
  
  return chineseCount + englishWords.length;
};

/**
 * 检查文本是否超过限制
 * @param {string} text - 输入文本
 * @param {number} maxLength - 最大长度
 * @returns {boolean} - 是否超过限制
 */
export const isTextOverLimit = (text, maxLength) => {
  return calculateTextLength(text) > maxLength;
};

/**
 * 截断文本到指定长度
 * @param {string} text - 输入文本
 * @param {number} maxLength - 最大长度
 * @returns {string} - 截断后的文本
 */
export const truncateText = (text, maxLength) => {
  if (!text) return '';
  
  let result = '';
  let currentLength = 0;
  
  // 逐个字符处理
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isChinese = /[\u4e00-\u9fa5]/.test(char);
    
    if (isChinese) {
      // 汉字算1个
      if (currentLength + 1 > maxLength) {
        break;
      }
      result += char;
      currentLength += 1;
    } else {
      // 英文单词需要检查是否完整
      const remainingText = text.substring(i);
      const wordMatch = remainingText.match(/^[a-zA-Z]+/);
      
      if (wordMatch) {
        const word = wordMatch[0];
        if (word.length >= 2) {
          // 至少2个字母才算一个单词
          if (currentLength + 1 > maxLength) {
            break;
          }
          result += word;
          currentLength += 1;
          i += word.length - 1; // 跳过单词的剩余字符
        } else {
          // 单个字母或标点，直接添加
          result += char;
        }
      } else {
        // 标点符号或空格，直接添加
        result += char;
      }
    }
  }
  
  return result;
};

/**
 * 获取文本长度描述
 * @param {string} text - 输入文本
 * @param {number} maxLength - 最大长度
 * @param {string} language - 语言 ('zh' | 'en')
 * @returns {string} - 长度描述
 */
export const getTextLengthDescription = (text, maxLength, language = 'zh') => {
  const currentLength = calculateTextLength(text);
  const remaining = maxLength - currentLength;
  
  if (language === 'zh') {
    return `当前: ${currentLength}/${maxLength} ${remaining < 0 ? '(超出限制)' : ''}`;
  } else {
    return `Current: ${currentLength}/${maxLength} ${remaining < 0 ? '(exceeded)' : ''}`;
  }
};

// 函数调用包装器
// 使用 Supabase Edge Functions 进行服务端加密

import { supabase } from '@/lib/supabase';

// 函数名映射（前端使用 camelCase，后端使用 kebab-case）
const FUNCTION_NAME_MAP = {
  'encryptQuestData': 'encrypt-quest-data',
  'decryptQuestData': 'decrypt-quest-data',
  'encryptProjectData': 'encrypt-project-data',
  'decryptProjectData': 'decrypt-project-data',
  'craftLoot': 'craft-loot',
  'restoreUserStreak': 'restore-user-streak'  // 可选功能
};

/**
 * 调用 Supabase Edge Function
 * 所有加密/解密操作都在服务端完成
 */
export const invoke = async (functionName, body = {}) => {
  // 获取实际的函数名（kebab-case）
  const edgeFunctionName = FUNCTION_NAME_MAP[functionName] || functionName;
  
  try {
    const { data, error } = await supabase.functions.invoke(edgeFunctionName, {
      body
    });

    if (error) {
      console.error(`Edge function ${edgeFunctionName} error:`, error);
      throw error;
    }

    return { data };
  } catch (error) {
    console.error(`Error invoking function ${edgeFunctionName}:`, error);
    
    // 提供更友好的错误信息
    if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
      throw new Error(
        `无法连接到 Edge Function: ${edgeFunctionName}. ` +
        `请确保函数已部署到 Supabase。` +
        `详情: ${error.message}`
      );
    }
    
    throw error;
  }
};

// 导出兼容接口
export default {
  invoke
};



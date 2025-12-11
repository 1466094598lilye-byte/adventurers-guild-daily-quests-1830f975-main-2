// 集成 API - 使用 Edge Functions 调用 LLM（Deep Seek）
// 通过 Supabase Edge Function 调用 Deep Seek API

import { supabase } from '@/lib/supabase';

/**
 * 通过 Edge Function 调用 Deep Seek LLM
 * 使用 Deep Seek API
 */
export const invokeLLM = async ({ prompt, response_json_schema }) => {
  const maxRetries = 3
  let retryCount = 0
  
  while (retryCount < maxRetries) {
    try {
      console.log('🔵 调用 invoke-llm Edge Function...', { prompt: prompt.substring(0, 50) + '...' })
      
      // 直接使用 fetch 来调试，看看实际响应
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
      }
      
      if (!supabaseAnonKey) {
        throw new Error('VITE_SUPABASE_ANON_KEY is required')
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/invoke-llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          prompt,
          response_json_schema
        })
      })
      
      console.log('🔵 原始响应状态:', response.status, response.statusText)
      console.log('🔵 响应 headers:', Object.fromEntries(response.headers.entries()))
      
      const responseText = await response.text()
      console.log('🔵 响应内容:', responseText.substring(0, 500))
      
      if (!response.ok) {
        let errorData
        try {
          errorData = JSON.parse(responseText)
        } catch {
          errorData = { error: responseText }
        }
        
        console.error('❌ Edge Function 返回错误:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        
        throw new Error(
          `Edge Function 返回错误 (${response.status}): ${errorData.error || response.statusText}`
        )
      }
      
      const data = JSON.parse(responseText)
      console.log('✅ Edge Function 成功:', data)
      return data
      
      /* 原 Supabase SDK 调用方式（暂时注释，用于对比）
      const { data, error } = await supabase.functions.invoke('invoke-llm', {
        body: {
          prompt,
          response_json_schema
        }
      })

      console.log('🔵 Edge Function 响应:', { data, error })

      if (error) {
        // 如果是 503 错误（模型加载中），等待后重试
        if (error.status === 503 || error.message?.includes('503')) {
          const retryAfter = data?.retry_after || 30
          console.log(`Model is loading, waiting ${retryAfter}s before retry...`)
          
          if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
            retryCount++
            continue
          }
        }
        
        // 详细的错误日志
        console.error('LLM Edge Function error:', {
          status: error.status,
          message: error.message,
          context: error.context,
          error: error
        })
        
        // 401 错误：可能是认证问题
        if (error.status === 401) {
          throw new Error('Edge Function 认证失败。这可能是配置问题。')
        }
        
        // 404 错误：Edge Function 不存在
        if (error.status === 404) {
          throw new Error('Edge Function invoke-llm 未找到。请确保已正确部署。')
        }
        
        // 500 错误：服务器内部错误
        if (error.status === 500) {
          throw new Error('Edge Function 内部错误。请检查函数日志。')
        }
        
        // 其他错误：尝试从 error.message 中提取详细信息
        let errorMessage = error.message || `Edge Function 返回错误 (状态码: ${error.status || 'unknown'})`
        
        // 如果 error.context 中有更多信息，添加进去
        if (error.context && error.context.message) {
          errorMessage = `${errorMessage}: ${error.context.message}`
        }
        
        throw new Error(errorMessage)
      }

      return data
      */ // 原 SDK 调用方式结束
    } catch (error) {
      // 处理 503 错误（模型正在加载）
      if (error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('Model is loading')) {
        const retryAfter = 30
        console.log(`Model is loading, waiting ${retryAfter}s before retry...`)
        
        if (retryCount < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
          retryCount++
          continue
        }
      }
      
      console.error('LLM API Error:', error)
      throw error
    }
  }
  
  throw new Error('Max retries reached for LLM invocation')
}

// 导出兼容接口
export const Core = {
  InvokeLLM: invokeLLM,
  
  SendEmail: async () => {
    throw new Error('SendEmail is not implemented. Please use Supabase Edge Functions or email service.')
  },
  SendSMS: async () => {
    throw new Error('SendSMS is not implemented. Please use Supabase Edge Functions or SMS service.')
  },
  UploadFile: async () => {
    throw new Error('UploadFile is not implemented. Please use Supabase Storage or file upload service.')
  },
  GenerateImage: async () => {
    throw new Error('GenerateImage is not implemented. Please use DALL-E API or image generation service.')
  },
  ExtractDataFromUploadedFile: async () => {
    throw new Error('ExtractDataFromUploadedFile is not implemented. Please use Supabase Edge Functions.')
  }
}

export const InvokeLLM = Core.InvokeLLM
export const SendEmail = Core.SendEmail
export const SendSMS = Core.SendSMS
export const UploadFile = Core.UploadFile
export const GenerateImage = Core.GenerateImage
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile



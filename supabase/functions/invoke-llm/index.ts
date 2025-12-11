// Supabase Edge Function: invoke-llm
// 使用 Deep Seek API 调用 LLM

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Deep Seek API（类似 OpenAI 格式）
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
// 使用 Deep Seek Chat 模型
const DEEPSEEK_MODEL = 'deepseek-chat'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 添加日志
  console.log('📥 Edge Function 收到请求:', {
    method: req.method,
    url: req.url
  })

  try {
    // 获取 Deep Seek API Key（从环境变量）
    // 注意：Supabase Edge Functions 使用 Deno.env.get() 读取 secrets
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    
    console.log('🔑 DEEPSEEK_API_KEY 检查:', {
      exists: !!deepseekApiKey,
      length: deepseekApiKey?.length || 0,
      prefix: deepseekApiKey ? deepseekApiKey.substring(0, 7) + '...' : 'N/A'
    })
    
    if (!deepseekApiKey) {
      console.error('❌ DEEPSEEK_API_KEY 未设置')
      return new Response(
        JSON.stringify({ 
          error: 'DEEPSEEK_API_KEY environment variable is not set',
          hint: 'Please set it using: supabase secrets set DEEPSEEK_API_KEY=your_api_key and redeploy the function'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // 验证 API key 格式（应该以 sk- 开头）
    if (!deepseekApiKey.startsWith('sk-')) {
      console.warn('⚠️ API Key 格式可能不正确（应该以 sk- 开头）')
    }

    // 获取请求参数
    const { prompt, response_json_schema } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 构建消息（使用 chat completions 格式）
    let userMessage = prompt
    
    if (response_json_schema) {
      // 如果有 JSON Schema，在提示词中要求返回 JSON
      const schemaStr = JSON.stringify(response_json_schema, null, 2)
      userMessage = `${prompt}

请严格按照以下 JSON Schema 格式返回 JSON 对象，不要返回任何其他内容：
${schemaStr}`
    }

    // 调用 Deep Seek API（使用 chat completions 格式）
    const headers = {
      'Authorization': `Bearer ${deepseekApiKey}`,
      'Content-Type': 'application/json'
    }
    
    console.log('📤 调用 Deep Seek API:', {
      url: DEEPSEEK_API_URL,
      model: DEEPSEEK_MODEL,
      keyPrefix: deepseekApiKey.substring(0, 10) + '...',
      keyLength: deepseekApiKey.length
    })
    
    const requestBody = {
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 512
    }
    
    console.log('📤 请求体:', JSON.stringify(requestBody).substring(0, 300))

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
    
    console.log('📥 Deep Seek 响应状态:', deepseekResponse.status, deepseekResponse.statusText)

    // 处理 503 错误（服务暂时不可用）
    if (deepseekResponse.status === 503) {
      const errorData = await deepseekResponse.json().catch(() => ({}))
      
      return new Response(
        JSON.stringify({ 
          error: 'Deep Seek API is temporarily unavailable, please retry',
          retry_after: 30
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text()
      console.error('❌ Deep Seek API 错误:', {
        status: deepseekResponse.status,
        statusText: deepseekResponse.statusText,
        errorText: errorText.substring(0, 500)
      })
      
      let errorMessage = `Deep Seek API error: ${deepseekResponse.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorJson.error || errorMessage
      } catch {
        errorMessage = errorText.substring(0, 200) || errorMessage
      }
      
      // 401 错误可能是 API key 问题
      if (deepseekResponse.status === 401) {
        errorMessage = `认证失败: ${errorMessage}。请检查 DEEPSEEK_API_KEY 是否正确设置。`
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          status: deepseekResponse.status,
          hint: deepseekResponse.status === 401 ? '请检查 DEEPSEEK_API_KEY 是否正确，访问 https://platform.deepseek.com/api_keys 获取有效的 API key' : ''
        }),
        { status: deepseekResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const deepseekData = await deepseekResponse.json()
    
    console.log('📥 Deep Seek API 响应:', JSON.stringify(deepseekData).substring(0, 500))
    
    // Deep Seek API 返回格式（类似 OpenAI）：
    // { "choices": [{ "message": { "role": "assistant", "content": "..." } }] }
    let generatedText = ''
    if (deepseekData.choices && deepseekData.choices.length > 0) {
      generatedText = deepseekData.choices[0].message?.content || ''
    } else {
      console.error('❌ 意外的响应格式:', deepseekData)
      return new Response(
        JSON.stringify({ 
          error: 'Unexpected response format from Deep Seek',
          details: deepseekData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 生成的文本已经是纯内容，不需要清理 prompt

    // 如果有 JSON Schema，尝试解析 JSON
    if (response_json_schema) {
      try {
        // 尝试提取 JSON 对象
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsedContent = JSON.parse(jsonMatch[0])
          return new Response(
            JSON.stringify(parsedContent),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        } else {
          // 如果没找到 JSON，尝试直接解析整个文本
          const parsedContent = JSON.parse(generatedText.trim())
          return new Response(
            JSON.stringify(parsedContent),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
      } catch (parseError) {
        // JSON 解析失败，返回错误
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse JSON response',
            raw_response: generatedText.substring(0, 200) // 返回前200字符用于调试
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 没有 JSON Schema，直接返回文本
    return new Response(
      JSON.stringify({ text: generatedText }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Edge Function 内部错误:', error)
    console.error('❌ 错误堆栈:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})



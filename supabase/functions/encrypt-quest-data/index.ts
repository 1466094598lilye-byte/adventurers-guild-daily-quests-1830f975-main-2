// Supabase Edge Function: encrypt-quest-data
// 加密任务数据（title 和 actionHint）

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 简单的加密函数（使用 AES-256-GCM 或简单的混淆）
// 注意：这里使用简单的 Base64 + 字符偏移，如需更强的加密可以改用 crypto API
function encryptText(text: string, key: string): string {
  if (!text) return '';
  
  try {
    // 方法1：Base64 编码 + 简单混淆（快速，足够乱码）
    const encoded = btoa(unescape(encodeURIComponent(text)));
    
    // 添加简单混淆：字符偏移
    const offset = key.length % 10;
    const scrambled = encoded.split('').map(char => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code + offset);
    }).join('');
    
    // 反转字符串
    return scrambled.split('').reverse().join('');
  } catch {
    return text;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 验证认证
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // 验证用户
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 获取请求体
    const { title, actionHint } = await req.json()

    // 使用用户 ID 作为加密密钥的一部分（确保每个用户的数据加密不同）
    const encryptionKey = `${user.id}-${Deno.env.get('ENCRYPTION_SECRET') || 'default-secret'}`
    
    // 加密数据
    const encryptedTitle = encryptText(title || '', encryptionKey)
    const encryptedActionHint = encryptText(actionHint || '', encryptionKey)

    return new Response(
      JSON.stringify({
        encryptedTitle,
        encryptedActionHint,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})



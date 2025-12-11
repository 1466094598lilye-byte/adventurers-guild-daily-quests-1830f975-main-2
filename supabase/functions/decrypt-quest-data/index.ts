// Supabase Edge Function: decrypt-quest-data
// 解密任务数据

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 解密函数（对应 encryptText）
function decryptText(encrypted: string, key: string): string {
  if (!encrypted) return '';
  
  try {
    // 反转字符串
    const reversed = encrypted.split('').reverse().join('');
    
    // 还原字符偏移
    const offset = key.length % 10;
    const unscrambled = reversed.split('').map(char => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code - offset);
    }).join('');
    
    // Base64 解码
    return decodeURIComponent(escape(atob(unscrambled)));
  } catch {
    return encrypted;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { encryptedTitle, encryptedActionHint } = await req.json()

    const encryptionKey = `${user.id}-${Deno.env.get('ENCRYPTION_SECRET') || 'default-secret'}`

    const title = decryptText(encryptedTitle || '', encryptionKey)
    const actionHint = decryptText(encryptedActionHint || '', encryptionKey)

    return new Response(
      JSON.stringify({
        title,
        actionHint,
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




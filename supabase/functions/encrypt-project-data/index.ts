// Supabase Edge Function: encrypt-project-data
// 加密项目数据（projectName 和 description）

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function encryptText(text: string, key: string): string {
  if (!text) return '';
  
  try {
    const encoded = btoa(unescape(encodeURIComponent(text)));
    const offset = key.length % 10;
    const scrambled = encoded.split('').map(char => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code + offset);
    }).join('');
    return scrambled.split('').reverse().join('');
  } catch {
    return text;
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

    const { projectName, description } = await req.json()

    const encryptionKey = `${user.id}-${Deno.env.get('ENCRYPTION_SECRET') || 'default-secret'}`

    const encryptedProjectName = encryptText(projectName || '', encryptionKey)
    const encryptedDescription = encryptText(description || '', encryptionKey)

    return new Response(
      JSON.stringify({
        encryptedProjectName,
        encryptedDescription,
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




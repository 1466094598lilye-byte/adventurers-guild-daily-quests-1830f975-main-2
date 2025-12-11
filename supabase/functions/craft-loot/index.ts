// Supabase Edge Function: craft-loot
// 合成宝物功能

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { lootIds, targetRarity } = await req.json()

    if (!lootIds || !Array.isArray(lootIds) || lootIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid lootIds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证输入宝物存在且属于用户
    const { data: inputLoot, error: fetchError } = await supabaseClient
      .from('loot')
      .select('*')
      .eq('owner_id', user.id)
      .in('id', lootIds)

    if (fetchError || !inputLoot || inputLoot.length !== lootIds.length) {
      return new Response(
        JSON.stringify({ error: 'Some loot items not found or not owned by user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 删除输入宝物
    const { error: deleteError } = await supabaseClient
      .from('loot')
      .delete()
      .eq('owner_id', user.id)
      .in('id', lootIds)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Failed to delete input loot' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 生成新宝物（这里返回基本信息，实际的名称和描述应该由客户端调用 LLM 生成）
    const newLoot = {
      name: `${targetRarity} Crafted Item`,
      rarity: targetRarity,
      flavorText: 'A crafted item obtained through synthesis',
      icon: '✨',
      obtainedAt: new Date().toISOString()
    }

    // 创建新宝物
    const { data: createdLoot, error: createError } = await supabaseClient
      .from('loot')
      .insert({
        owner_id: user.id,
        ...newLoot
      })
      .select()
      .single()

    if (createError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create new loot' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        newLoot: createdLoot
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




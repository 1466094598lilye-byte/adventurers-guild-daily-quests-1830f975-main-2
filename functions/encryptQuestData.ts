import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, actionHint } = body;

    if (!title || !actionHint) {
      return Response.json({ 
        error: 'Missing required fields: title and actionHint' 
      }, { status: 400 });
    }

    // 获取加密密钥
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      return Response.json({ error: 'Encryption key not configured' }, { status: 500 });
    }

    // 导入密钥
    const keyData = new TextEncoder().encode(encryptionKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // 加密 title
    const titleIv = crypto.getRandomValues(new Uint8Array(12));
    const titleEncrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: titleIv },
      key,
      new TextEncoder().encode(title)
    );

    // 加密 actionHint
    const actionHintIv = crypto.getRandomValues(new Uint8Array(12));
    const actionHintEncrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: actionHintIv },
      key,
      new TextEncoder().encode(actionHint)
    );

    // 转换为 Base64
    const encryptedTitle = btoa(
      String.fromCharCode(...titleIv) + 
      String.fromCharCode(...new Uint8Array(titleEncrypted))
    );

    const encryptedActionHint = btoa(
      String.fromCharCode(...actionHintIv) + 
      String.fromCharCode(...new Uint8Array(actionHintEncrypted))
    );

    return Response.json({
      encryptedTitle,
      encryptedActionHint
    });

  } catch (error) {
    console.error('Encryption error:', error);
    return Response.json({ 
      error: 'Encryption failed', 
      details: error.message 
    }, { status: 500 });
  }
});
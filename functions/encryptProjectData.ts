import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectName, description } = await req.json();
    
    if (!projectName || !description) {
      return Response.json({ error: 'Missing projectName or description' }, { status: 400 });
    }

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      return Response.json({ error: 'Encryption key not configured' }, { status: 500 });
    }

    // 使用 Web Crypto API 进行 AES-GCM 加密
    const encoder = new TextEncoder();
    
    // 从密钥字符串生成加密密钥
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // 加密 projectName
    const nameIv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedNameBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nameIv },
      keyMaterial,
      encoder.encode(projectName)
    );
    const encryptedProjectName = btoa(
      String.fromCharCode(...nameIv) + 
      String.fromCharCode(...new Uint8Array(encryptedNameBuffer))
    );

    // 加密 description
    const descIv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedDescBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: descIv },
      keyMaterial,
      encoder.encode(description)
    );
    const encryptedDescription = btoa(
      String.fromCharCode(...descIv) + 
      String.fromCharCode(...new Uint8Array(encryptedDescBuffer))
    );

    return Response.json({
      encryptedProjectName,
      encryptedDescription
    });

  } catch (error) {
    console.error('Encryption error:', error);
    return Response.json({ 
      error: 'Encryption failed', 
      details: error.message 
    }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { encryptedProjectName, encryptedDescription } = await req.json();
    
    if (!encryptedProjectName || !encryptedDescription) {
      return Response.json({ error: 'Missing encrypted data' }, { status: 400 });
    }

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      return Response.json({ error: 'Encryption key not configured' }, { status: 500 });
    }

    // 使用 Web Crypto API 进行 AES-GCM 解密
    const decoder = new TextDecoder();
    
    // 从密钥字符串生成解密密钥
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 解密 projectName
    const nameData = atob(encryptedProjectName);
    const nameBytes = new Uint8Array(nameData.length);
    for (let i = 0; i < nameData.length; i++) {
      nameBytes[i] = nameData.charCodeAt(i);
    }
    const nameIv = nameBytes.slice(0, 12);
    const nameCiphertext = nameBytes.slice(12);
    
    const decryptedNameBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nameIv },
      keyMaterial,
      nameCiphertext
    );
    const projectName = decoder.decode(decryptedNameBuffer);

    // 解密 description
    const descData = atob(encryptedDescription);
    const descBytes = new Uint8Array(descData.length);
    for (let i = 0; i < descData.length; i++) {
      descBytes[i] = descData.charCodeAt(i);
    }
    const descIv = descBytes.slice(0, 12);
    const descCiphertext = descBytes.slice(12);
    
    const decryptedDescBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: descIv },
      keyMaterial,
      descCiphertext
    );
    const description = decoder.decode(decryptedDescBuffer);

    return Response.json({
      projectName,
      description
    });

  } catch (error) {
    console.error('Decryption error:', error);
    return Response.json({ 
      error: 'Decryption failed', 
      details: error.message 
    }, { status: 500 });
  }
});
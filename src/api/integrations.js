// 集成 API - LLM 调用
// 使用 Supabase Edge Function 调用 HuggingFace 免费推理 API（Phi-2 模型）

import * as EdgeIntegrations from './integrations-edge';

// 使用 Edge Function 调用 HuggingFace Phi-2（免费，无需 API Key）
export const Core = {
  InvokeLLM: EdgeIntegrations.invokeLLM,
  
  // 以下功能暂未实现，如需使用请通过 Edge Functions 实现
  SendEmail: async () => {
    throw new Error('SendEmail is not implemented. Please use Supabase Edge Functions or email service.');
  },
  SendSMS: async () => {
    throw new Error('SendSMS is not implemented. Please use Supabase Edge Functions or SMS service.');
  },
  UploadFile: async () => {
    throw new Error('UploadFile is not implemented. Please use Supabase Storage or file upload service.');
  },
  GenerateImage: async () => {
    throw new Error('GenerateImage is not implemented. Please use DALL-E API or image generation service.');
  },
  ExtractDataFromUploadedFile: async () => {
    throw new Error('ExtractDataFromUploadedFile is not implemented. Please use Supabase Edge Functions.');
  }
};

// 导出兼容的接口
export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const SendSMS = Core.SendSMS;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;

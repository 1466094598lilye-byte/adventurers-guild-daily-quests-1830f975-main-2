import React, { useState } from 'react';
import { Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/components/LanguageContext';

export default function EditNameDialog({ open, onOpenChange }) {
  const { user, refreshUser } = useAuth();
  const { language, t } = useLanguage();
  const [name, setName] = useState(user?.full_name || user?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if (open && user) {
      setName(user.full_name || user.email || '');
      setError(null);
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(language === 'zh' ? '名称不能为空' : 'Name cannot be empty');
      return;
    }

    if (name.length > 50) {
      setError(language === 'zh' ? '名称不能超过50个字符' : 'Name cannot exceed 50 characters');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await base44.auth.updateMe({
        full_name: name.trim()
      });
      
      // 刷新用户数据
      await refreshUser();
      
      // 关闭对话框
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update name:', err);
      setError(language === 'zh' 
        ? '保存失败，请重试' 
        : 'Failed to save, please try again');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.full_name || user?.email || '');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5" />
            {language === 'zh' ? '修改名称' : 'Edit Name'}
          </DialogTitle>
          <DialogDescription>
            {language === 'zh' 
              ? '设置您喜欢的显示名称，这将显示在您的个人资料中。' 
              : 'Set your preferred display name, which will be shown in your profile.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {language === 'zh' ? '显示名称' : 'Display Name'}
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'zh' ? '请输入您的名称' : 'Enter your name'}
              maxLength={50}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving) {
                  handleSave();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              {language === 'zh' 
                ? `当前长度: ${name.length}/50` 
                : `Current length: ${name.length}/50`}
            </p>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>

          <div className="p-3 bg-muted rounded-md text-sm">
            <p className="text-muted-foreground">
              {language === 'zh' 
                ? '💡 提示：如果不设置名称，将使用您的邮箱地址作为显示名称。' 
                : '💡 Tip: If you don\'t set a name, your email address will be used as the display name.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            {language === 'zh' ? '取消' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving 
              ? (language === 'zh' ? '保存中...' : 'Saving...') 
              : (language === 'zh' ? '保存' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getGuestDataStats } from '@/lib/guestDataMigration';

export default function MigrationDialog({ prompt }) {
  const stats = getGuestDataStats();
  const totalItems = Object.values(stats).reduce((sum, count) => sum + count, 0);
  
  const tableNames = {
    quests: '任务',
    loot: '宝物',
    daily_chests: '每日宝箱',
    long_term_projects: '大项目'
  };

  return (
    <Dialog open={prompt.show} onOpenChange={() => prompt.onSkip()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            发现游客数据
          </DialogTitle>
          <DialogDescription>
            检测到您有 {totalItems} 项游客模式下的数据，是否要迁移到您的账户？
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-2 text-sm">
            {Object.entries(stats).map(([table, count]) => {
              if (count === 0) return null;
              return (
                <div key={table} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{tableNames[table] || table}:</span>
                  <span className="font-medium">{count} 项</span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">提示：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>迁移后，这些数据将保存到云端</li>
              <li>游客数据将被清空</li>
              <li>如果账户中已有相同数据，将进行合并</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={prompt.onSkip}
          >
            稍后再说
          </Button>
          <Button
            onClick={prompt.onMigrate}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            立即迁移
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


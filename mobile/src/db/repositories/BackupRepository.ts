/**
 * BackupRepository - 数据备份与恢复
 * 支持导出/导入所有训练数据到 JSON 文件
 */

import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { runRecordRepo } from './RunRecordRepository';
import { userProfileRepo } from './UserProfileRepository';
import { RunRecord, UserProfile } from '../../types';

export interface BackupData {
  version: string;
  exportDate: string;
  userProfile?: UserProfile;
  runRecords: RunRecord[];
}

class BackupRepository {
  /**
   * 导出所有数据到 JSON 文件
   */
  async exportToFile(): Promise<string> {
    const records = await runRecordRepo.fetchAll();
    const profile = await userProfileRepo.get();

    const backupData: BackupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      userProfile: profile || undefined,
      runRecords: records,
    };

    const fileName = `runforge_backup_${new Date().toISOString().split('T')[0]}.json`;
    const file = new File(Paths.document, fileName);

    // 若同名文件已存在则先删除，避免 FileAlreadyExistsException
    if (file.exists) {
      file.delete();
    }

    // 将数据写入文件
    await file.create();
    const jsonString = JSON.stringify(backupData, null, 2);
    await file.write(jsonString);

    return file.uri;
  }

  /**
   * 分享备份文件（可保存到文件、iCloud 等）
   */
  async shareBackup(): Promise<void> {
    const filePath = await this.exportToFile();
    
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('分享功能不可用');
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: '保存 RunForge 备份',
      UTI: 'public.json',
    });
  }

  /**
   * 从 JSON 文件导入数据
   */
  async importFromFile(fileUri: string): Promise<{ imported: number; skipped: number }> {
    const file = new File(fileUri);
    const content = await file.text();

    const backupData: BackupData = JSON.parse(content);

    // 验证版本
    if (!backupData.version || !backupData.runRecords) {
      throw new Error('无效的备份文件格式');
    }

    let imported = 0;
    let skipped = 0;

    // 导入用户档案
    if (backupData.userProfile) {
      await userProfileRepo.update(backupData.userProfile);
    }

    // 导入训练记录（检查重复）
    const existingRecords = await runRecordRepo.fetchAll();
    const existingDates = new Set(existingRecords.map(r => r.run_date));

    for (const record of backupData.runRecords) {
      // 跳过已存在的记录（按日期判断）
      if (existingDates.has(record.run_date)) {
        skipped++;
        continue;
      }

      await runRecordRepo.save(record);
      imported++;
    }

    return { imported, skipped };
  }

  /**
   * 从 JSON 字符串导入（用于从剪贴板粘贴）
   */
  async importFromText(jsonText: string): Promise<{ imported: number; skipped: number }> {
    const backupData: BackupData = JSON.parse(jsonText);
    
    if (!backupData.version || !backupData.runRecords) {
      throw new Error('无效的备份数据格式');
    }

    let imported = 0;
    let skipped = 0;

    if (backupData.userProfile) {
      await userProfileRepo.update(backupData.userProfile);
    }

    const existingRecords = await runRecordRepo.fetchAll();
    const existingDates = new Set(existingRecords.map(r => r.run_date));

    for (const record of backupData.runRecords) {
      if (existingDates.has(record.run_date)) {
        skipped++;
        continue;
      }

      await runRecordRepo.save(record);
      imported++;
    }

    return { imported, skipped };
  }
}

export const backupRepo = new BackupRepository();

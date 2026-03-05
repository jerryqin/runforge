/**
 * OCRService - 跑步截图识别
 * 接口保持稳定，底层实现可从本地切换到远程
 */

import * as FileSystem from 'expo-file-system';
import { OCRResult } from '../types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// ===== OCR 引擎接口（协议隔离）=====
export interface IOCREngine {
  analyze(imageUri: string): Promise<OCRResult>;
}

// ===== v1.0：调用 FastAPI + GPT-4o Vision =====
class RemoteOCREngine implements IOCREngine {
  async analyze(imageUri: string): Promise<OCRResult> {
    // 读取图片转 base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const response = await fetch(`${API_BASE}/api/ocr/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64 }),
    });

    if (!response.ok) {
      throw new Error(`OCR 识别失败: ${response.status}`);
    }

    const data = await response.json();
    return data as OCRResult;
  }
}

// ===== 导出单例，未来切换实现只改这一行 =====
export const ocrEngine: IOCREngine = new RemoteOCREngine();

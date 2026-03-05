/**
 * OCRService - 跑步截图识别
 * 接口保持稳定，底层实现可从本地切换到远程
 *
 * 路由说明：
 *   v1.0  POST /api/ocr/image  — multipart/form-data 上传图片（GPT-4o Vision）
 *   v1.0  POST /api/ocr/text   — JSON 上传文本（移动端本地 OCR 后传文本）
 */

import { OCRResult } from '../types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// ===== OCR 引擎接口（协议隔离）=====
export interface IOCREngine {
  analyzeImage(imageUri: string): Promise<OCRResult>;
  analyzeText(rawText: string): Promise<OCRResult>;
}

// ===== v1.0：调用 FastAPI 后端 =====
class RemoteOCREngine implements IOCREngine {

  /**
   * 上传图片文件（multipart/form-data）
   * 后端 POST /api/ocr/image 接收 UploadFile
   */
  async analyzeImage(imageUri: string): Promise<OCRResult> {
    // 从 URI 推断 MIME 类型
    const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
      webp: 'image/webp',
    };
    const mimeType = mimeMap[ext] ?? 'image/jpeg';

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: `run.${ext}`,
      type: mimeType,
    } as unknown as Blob);

    const response = await fetch(`${API_BASE}/api/ocr/image`, {
      method: 'POST',
      body: formData,
      // 不设置 Content-Type，让 fetch 自动填写 boundary
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OCR 识别失败 ${response.status}: ${err}`);
    }

    return (await response.json()) as OCRResult;
  }

  /**
   * 上传原始 OCR 文本（JSON）
   * 后端 POST /api/ocr/text 做结构化解析
   * 适用于移动端已做本地 OCR，只需后端解析的场景
   */
  async analyzeText(rawText: string): Promise<OCRResult> {
    const response = await fetch(`${API_BASE}/api/ocr/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText }),
    });

    if (!response.ok) {
      throw new Error(`文本解析失败: ${response.status}`);
    }

    return (await response.json()) as OCRResult;
  }
}

// ===== 导出单例，未来切换实现只改这一行 =====
export const ocrEngine: IOCREngine = new RemoteOCREngine();

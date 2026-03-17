/**
 * OCRService - 跑步截图识别
 * 当前阶段默认使用 Apple Vision 端侧 OCR + 本地规则解析
 * 保持接口稳定，未来如需回退到远程实现，只改导出实例即可
 */

import { OCRResult } from '../types';

function getNativeTextRecognitionModule() {
  try {
    const { NativeModules, Platform } = require('react-native') as {
      NativeModules?: { TextRecognition?: { recognize: (imagePath: string) => Promise<string[]> } };
      Platform?: { OS?: string };
    };

    if (Platform?.OS !== 'ios') {
      return null;
    }

    return NativeModules?.TextRecognition ?? null;
  } catch {
    return null;
  }
}

// ===== OCR 引擎接口（协议隔离）=====
export interface IOCREngine {
  analyzeImage(imageUri: string): Promise<OCRResult>;
  analyzeText(rawText: string): Promise<OCRResult>;
}

type NativeTextRecognitionModule = {
  recognize: (imageURL: string) => Promise<string[]>;
};

function normalizeOCRText(rawText: string): string {
  return rawText
    .replace(/[：∶]/g, ':')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/公里/g, ' km ')
    .replace(/千米/g, ' km ')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function sanitizeOCRDigits(value: string): string {
  return value
    .replace(/[Oo○◦]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');
}

function parsePlausibleInteger(value: string, min: number, max: number): number | null {
  const normalized = sanitizeOCRDigits(value);
  const match = normalized.match(/\d{2,3}/);
  if (!match) return null;

  const parsed = parseInt(match[0], 10);
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function findMetricNearKeywords(
  text: string,
  keywords: string[],
  min: number,
  max: number
): number | null {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const hasKeyword = keywords.some(keyword => line.includes(keyword));
    if (!hasKeyword) continue;

    const candidates = [line, lines[index - 1], lines[index + 1], lines[index - 2], lines[index + 2]].filter(
      (item): item is string => Boolean(item)
    );

    for (const candidate of candidates) {
      const parsed = parsePlausibleInteger(candidate, min, max);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function parseOCRText(rawText: string): OCRResult {
  const text = normalizeOCRText(rawText);
  const result: OCRResult = {
    raw_text: text,
    confidence: 0,
  };
  let confidenceScore = 0;

  let match = text.match(/(\d+\.?\d*)\s*(?:km|公里)/i);
  if (match) {
    result.distance = parseFloat(match[1]);
    confidenceScore += 0.25;
  }

  match = text.match(/(\d+)'(\d{2})"/);
  if (!match) match = text.match(/(\d+):(\d{2})\s*\/?\s*[kK][mM]/);
  if (!match) match = text.match(/(\d+)分(\d{2})秒/);
  if (match) {
    const paceMin = parseInt(match[1], 10);
    const paceSec = parseInt(match[2], 10);
    result.avg_pace = paceMin * 60 + paceSec;
    result.avg_pace_str = `${paceMin}'${paceSec.toString().padStart(2, '0')}"`;
    confidenceScore += 0.2;
  }

  match = text.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (!match) match = text.match(/(\d{1,2})小时(\d{1,2})分(\d{1,2})秒/);
  if (match) {
    const h = parseInt(match[1], 10);
    const mn = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    result.duration_sec = h * 3600 + mn * 60 + s;
    result.duration_str = `${h.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    confidenceScore += 0.2;
  }

  match = text.match(/(?:平均心率|心率)\D{0,8}([0-9OoIl|SsBb]{2,3})/);
  if (!match) match = text.match(/([0-9OoIl|SsBb]{2,3})\s*\n?\s*(?:平均心率|心率)/);
  if (!match) match = text.match(/([0-9OoIl|SsBb]{2,3})\s*(?:bpm|BPM)/);

  let avgHr = match ? parsePlausibleInteger(match[1], 40, 220) : null;
  if (avgHr === null) {
    avgHr = findMetricNearKeywords(text, ['平均心率', '心率', 'bpm', 'BPM'], 40, 220);
  }

  if (avgHr !== null) {
    result.avg_hr = avgHr;
    confidenceScore += 0.2;
  }

  match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const mo = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    result.run_date = `${y}-${mo.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    confidenceScore += 0.1;
  }

  match = text.match(/(\d{2,3})\s*(?:步\/分钟|spm|SPM)/);
  if (!match) match = text.match(/(\d{2,3})\s*\n?\s*(?:平均步频|步频)/);
  if (match) {
    result.cadence = parseInt(match[1], 10);
  }

  match = text.match(/(\d+\.?\d*)\s*千卡/);
  if (match) {
    result.calories = parseFloat(match[1]);
  }

  result.confidence = Math.round(Math.min(confidenceScore, 1) * 100) / 100;
  return result;
}

async function loadTextRecognitionModule(): Promise<NativeTextRecognitionModule> {
  const nativeModule = getNativeTextRecognitionModule() as NativeTextRecognitionModule | null;
  if (!nativeModule || typeof nativeModule.recognize !== 'function') {
    throw new Error('当前版本仅支持 iPhone 端侧 OCR。请重新安装包含 Apple Vision OCR 的最新 iOS 开发包后再试。');
  }

  return nativeModule;
}

async function recognizeRawText(imageUri: string): Promise<string[]> {
  const module = await loadTextRecognitionModule();
  const lines = await module.recognize(imageUri);
  const text = normalizeOCRText(lines.join('\n'));

  if (!text) {
    throw new Error('本地文字识别失败，请确认截图清晰且包含距离、时长、心率等信息。');
  }

  return [text];
}

function pickBestResult(results: OCRResult[]): OCRResult {
  return [...results].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (b.raw_text?.length ?? 0) - (a.raw_text?.length ?? 0);
  })[0];
}

// ===== v2.0：Apple Vision 端侧 OCR + 本地解析 =====
class LocalOCREngine implements IOCREngine {

  /**
   * 在设备端识别图片，再用本地规则抽取结构化字段
   */
  async analyzeImage(imageUri: string): Promise<OCRResult> {
    const rawTexts = await recognizeRawText(imageUri);
    const parsedResults = rawTexts.map(parseOCRText);
    return pickBestResult(parsedResults);
  }

  /**
   * 对端侧 OCR 原始文本做本地结构化解析
   */
  async analyzeText(rawText: string): Promise<OCRResult> {
    return parseOCRText(rawText);
  }
}

// ===== 导出单例，未来切换实现只改这一行 =====
export const ocrEngine: IOCREngine = new LocalOCREngine();

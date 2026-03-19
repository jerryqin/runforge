// ===== 强度等级 =====
export enum Intensity {
  EASY = 1,    // 轻松跑
  NORMAL = 2,  // 中等强度
  HIGH = 3,    // 高强度
  OVER = 4,    // 过度训练
}

export const IntensityLabel: Record<Intensity, string> = {
  [Intensity.EASY]: '轻松跑',
  [Intensity.NORMAL]: '中等强度',
  [Intensity.HIGH]: '高强度',
  [Intensity.OVER]: '过度训练',
};

// ===== 身体状态 =====
export enum BodyStatus {
  READY = 1,   // 适合训练
  NORMAL = 2,  // 正常
  TIRED = 3,   // 轻微疲劳
  REST = 4,    // 建议休息
}

export const BodyStatusLabel: Record<BodyStatus, string> = {
  [BodyStatus.READY]: '适合训练',
  [BodyStatus.NORMAL]: '正常',
  [BodyStatus.TIRED]: '轻微疲劳',
  [BodyStatus.REST]: '建议休息',
};

// ===== 跑步记录 =====
export interface RunRecord {
  id?: number;
  create_time: number;       // 毫秒时间戳
  run_date: string;          // 格式：2026-03-05
  distance: number;          // 公里
  duration_sec: number;      // 总时长（秒）
  avg_pace: number;          // 配速：秒/公里
  avg_hr: number;            // 平均心率
  intensity: Intensity;
  conclusion: string;        // 一句话结论
  suggest: string;           // 明日行动
  risk: string;              // 风险提示
  // 扩展字段
  tss?: number;              // 训练压力分
  elevation_gain?: number;   // 累计爬升(m)
  temperature?: number;      // 气温(℃)
  rpe?: number;              // 主观感受(1-10)
  vdot?: number;             // 本次估算 VDOT
  cadence?: number;          // 步频
}

// ===== 比赛计划 =====
export interface RacePlan {
  id?: number;
  race_date: string;         // 比赛日期
  target_time_sec: number;   // 目标完赛秒数
  target_pace: number;       // 目标配速（秒/公里）
  plan_content: string;      // 备赛计划
}

// ===== 用户档案 =====
export interface UserProfile {
  id?: number;
  max_hr: number;            // 最大心率
  resting_hr: number;        // 静息心率
  hr_threshold: number;      // 乳酸阈值心率(LTHR)
  birth_year?: number;       // 出生年份
  running_start_year?: number; // 开始跑步年份
  weekly_km: number;         // 当前周跑量(km)
}

// ===== ATL/CTL/TSB =====
export interface FitnessMetrics {
  atl: number;  // 急性训练负荷（7天，疲劳）
  ctl: number;  // 慢性训练负荷（42天，体能）
  tsb: number;  // 训练压力平衡（CTL - ATL，状态）
}

// ===== OCR 解析结果 =====
export interface OCRResult {
  distance?: number;
  duration_str?: string;
  duration_sec?: number;
  avg_pace_str?: string;
  avg_pace?: number;
  avg_hr?: number;
  run_date?: string;
  cadence?: number;
  calories?: number;
  confidence: number;  // 0-1 识别置信度
  raw_text?: string;   // OCR 原始文本
}

import { BodyStatus, Intensity } from '../types';

// ===== 核心色彩 =====
export const Colors = {
  // 品牌色
  primary: '#FF6B35',       // 橙红，RunForge 主色
  primaryLight: '#FF8C5A',

  // 状态色
  statusGreen: '#34C759',   // 适合训练
  statusOrange: '#FF9500',  // 轻微疲劳
  statusRed: '#FF3B30',     // 建议休息

  // 中性色
  black: '#1A1A1A',
  gray1: '#3C3C3C',
  gray2: '#6C6C6C',
  gray3: '#ADADAD',
  gray4: '#D1D1D1',
  gray5: '#F2F2F2',
  white: '#FFFFFF',

  // 背景
  background: '#FFFFFF',
  backgroundDark: '#000000',
  cardBackground: '#F8F8F8',

  // 分割线
  separator: '#E5E5EA',

  // 强度色
  intensityEasy: '#34C759',
  intensityNormal: '#FF9500',
  intensityHigh: '#FF6B35',
  intensityOver: '#FF3B30',
};

// ===== 字体大小 =====
export const FontSize = {
  hero: 56,       // 主数字（距离、配速）
  h1: 28,
  h2: 22,
  h3: 20,
  body: 15,
  caption: 13,
  small: 11,
};

// ===== 字体粗细 =====
export const FontWeight = {
  bold: '700' as const,
  semibold: '600' as const,
  medium: '500' as const,
  regular: '400' as const,
};

// ===== 间距 =====
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ===== 圆角 =====
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// ===== 身体状态颜色映射 =====
export const BodyStatusColors: Record<BodyStatus, string> = {
  [BodyStatus.READY]: Colors.statusGreen,
  [BodyStatus.NORMAL]: Colors.statusGreen,
  [BodyStatus.TIRED]: Colors.statusOrange,
  [BodyStatus.REST]: Colors.statusRed,
};

// ===== 强度颜色映射 =====
export const IntensityColors: Record<Intensity, string> = {
  [Intensity.EASY]: Colors.intensityEasy,
  [Intensity.NORMAL]: Colors.intensityNormal,
  [Intensity.HIGH]: Colors.intensityHigh,
  [Intensity.OVER]: Colors.intensityOver,
};

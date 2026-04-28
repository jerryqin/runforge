/**
 * 后端 API 配置
 *
 * 开发环境：在 mobile/.env.local 中设置 EXPO_PUBLIC_API_URL
 *   例：EXPO_PUBLIC_API_URL=http://192.168.1.5:8000
 *   （iOS 真机不能用 localhost，需要用电脑局域网 IP；IP 变了只改 .env.local）
 *
 * 生产环境：设置 EXPO_PUBLIC_API_URL=https://api.runforge.app
 *   或直接修改下方 PROD_BASE_URL
 *
 * 注意：教练解读功能有完整降级，后端不可达时自动使用本地规则引擎文案，不会报错。
 */

const PROD_BASE_URL = 'https://api.runforge.app';

// EXPO_PUBLIC_ 前缀的变量在打包时会被内联（Expo SDK 49+）
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;

export const BACKEND_BASE_URL = ENV_URL ?? (__DEV__ ? '' : PROD_BASE_URL);

export const API_ENDPOINTS = {
  coachInsight: `${BACKEND_BASE_URL}/api/analysis/coach-insight`,
} as const;

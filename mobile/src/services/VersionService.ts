import Constants from 'expo-constants';

/**
 * 获取当前应用版本号
 * @returns 版本号字符串，如 "1.0.1"
 */
export function getAppVersion(): string {
  const version = Constants.expoConfig?.version;
  return version || 'Unknown';
}

/**
 * 获取完整版本信息（包含iOS 构建号）
 * @returns 完整版本字符串，如 "1.0.1 (build 3)"
 */
export function getFullAppVersion(): string {
  const version = Constants.expoConfig?.version;
  const buildNumber = Constants.expoConfig?.ios?.buildNumber;
  return buildNumber ? `${version} (build ${buildNumber})` : version || 'Unknown';
}

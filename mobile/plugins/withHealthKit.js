/**
 * Expo Config Plugin for HealthKit Build Settings
 * 
 * 配置 Xcode 项目以允许构建时修改 Entitlements
 * 这个设置是 react-native-health 官方 plugin 没有提供的
 */

const { withXcodeProject } = require('@expo/config-plugins');

/**
 * 允许构建时修改 Entitlements
 * 解决 "Entitlements file was modified during build" 错误
 */
const withAllowEntitlementsModification = (config) => {
  return withXcodeProject(config, (mod) => {
    const xcodeProject = mod.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    
    for (const key in configurations) {
      if (typeof configurations[key] === 'object' && configurations[key].buildSettings) {
        configurations[key].buildSettings.CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION = 'YES';
      }
    }
    
    return mod;
  });
};

module.exports = withAllowEntitlementsModification;

# 修复 Apple Health 原生模块问题

## 问题原因

`react-native-health` 是一个原生模块，需要通过 Expo config plugin 正确链接到 iOS 项目。之前缺少官方 plugin 配置，导致原生方法 `getSamples` 等无法使用。

## 已完成的修复

1. ✅ 添加 `react-native-health` 官方 plugin 到 `app.json`
2. ✅ 更新 `HealthService.ts`，修复模块导入方式（使用 `mod` 而非 `mod.default`）
3. ✅ 简化自定义 plugin，只保留必要的 Xcode 构建设置

## 需要执行的步骤

### 1. 清理并重新生成原生代码

```bash
cd /Users/jerryqin/Projects/runforge/mobile

# 清理旧的原生代码
npx expo prebuild --clean
```

这个命令会：
- 删除 `ios/` 和 `android/` 目录
- 根据 `app.json` 中的 plugins 重新生成原生代码
- 自动运行 `pod install` 链接原生依赖

### 2. 重新安装 Pods（可选，prebuild 会自动执行）

```bash
cd ios
pod install
cd ..
```

### 3. 重新构建并运行到设备

```bash
npx expo run:ios --device
```

或者使用 Xcode：
```bash
open ios/RunForge.xcworkspace
```
然后在 Xcode 中选择您的设备并点击 Run。

## 验证修复

App 启动后，在"数据录入"页面：

1. 点击 **"连接 Apple Health"** 按钮
2. 应该看到系统权限弹窗
3. 授权后，点击 **"同步最近 30 天"**
4. 控制台应该显示：
   ```
   [HealthService] HealthKit loaded: object
   [HealthService] HealthKit methods: function function
   [HealthService] Has getSamples: function
   [HealthService] Raw results count: X
   ```

如果看到 `has getSamples: function`（而不是 `undefined`），说明修复成功！

## 技术细节

### react-native-health 导出结构

```javascript
// node_modules/react-native-health/index.js
const { AppleHealthKit } = require('react-native').NativeModules

export const HealthKit = Object.assign({}, AppleHealthKit, {
  Constants: { ... }
})

module.exports = HealthKit
```

所以：
- ❌ 错误：`const Health = mod.default` → undefined
- ✅ 正确：`const Health = mod` → NativeModules.AppleHealthKit

### Config Plugins 配置

```json
{
  "plugins": [
    ["react-native-health", { ... }],  // 官方 plugin：配置权限和 entitlements
    "./plugins/withHealthKit"          // 自定义：设置 CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION
  ]
}
```

## 常见问题

### Q: prebuild 后需要重新配置什么吗？
A: 不需要。所有配置都在 `app.json` 和 plugins 中，prebuild 会自动应用。

### Q: 数据会丢失吗？
A: 本地 SQLite 数据库在 App Documents 目录，prebuild 只影响原生代码，不会删除数据。但重新安装 App 会丢失数据，建议先导出备份。

### Q: 如何确认原生模块正确链接？
A: 检查 `ios/Podfile.lock` 文件，应该包含 `react-native-health` 相关的 pod。

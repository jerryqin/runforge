# RunForge EAS 热更新工作流

## 当前配置
- TestFlight / 预发布渠道：`preview`
- 正式版渠道：`production`
- 当前 `runtimeVersion`：`1.0.0-native-ocr-v1`
- 当前 EAS Project ID：`4c2b6c83-7790-40ad-b18f-1995248ad0f2`

## 重要规则
### 可以热更新
- TypeScript / JavaScript 逻辑
- 页面 UI
- 文案
- 本地 OCR 的正则解析与前端逻辑

### 不能热更新
- Swift / Objective-C
- Pods
- iOS 工程配置
- 新增原生模块
- Apple Vision 原生实现

只要改了原生层，就必须：
1. 修改 `runtimeVersion`
2. 重新打一个新的 TestFlight / App Store 安装包

## 当前项目如何出 TestFlight 基础包
你现在是本地 Xcode / `expo run:ios` 路线，因此需要先同步原生配置：

1. 在 `mobile/` 下执行一次原生同步构建
   - `npx expo run:ios --device`
2. 再用 Xcode Archive 上传新的 TestFlight build

这一步的作用是把 `app.json` 里的：
- `updates.url`
- `updates.requestHeaders`
- `runtimeVersion`

写入 iOS 原生配置中。

## 第一次带热更新能力的 TestFlight 最短清单
1. 确认 [app.json](app.json) 中：
   - `runtimeVersion = 1.0.0-native-ocr-v1`
   - `updates.url` 已配置
   - `updates.requestHeaders.expo-channel-name = preview`
   - `ios.buildNumber` 已递增
2. 执行一次：`npx expo run:ios --device`
3. 打开 [ios/RunForge.xcworkspace](ios/RunForge.xcworkspace)
4. Xcode 中选择：
   - Any iOS Device (arm64)
   - Product → Archive
   - Distribute App → App Store Connect → Upload
5. TestFlight 处理完成后，安装该 build，再发布一次小的 `preview` 更新验证热更新

如果上传失败，优先检查两项：
- Apple Developer 里是否已有 `Apple Distribution` 证书
- 当前上传的 build number 是否比 App Store Connect 里现有 build 更大

## 发布 preview 热更新
当新的 TestFlight 基础包安装完成后，后续纯 JS/TS 改动可直接发布到 `preview`：

```bash
npx eas-cli update --channel preview --message "修复首页状态文案" --environment preview
```

也可以使用项目脚本：

```bash
npm run update:preview "修复首页状态文案"
```

## 发布 production 热更新
正式版上架并安装到用户设备后，发布到 `production`：

```bash
npx eas-cli update --channel production --message "修复正式版问题" --environment production
```

也可以使用项目脚本：

```bash
npm run update:prod "修复正式版问题"
```

`update:production` 与 `update:prod` 等价。

## 切换到正式版前要做的事
如果将来要发正式版安装包，并让它只接收 `production` 更新：

1. 将 `app.json` 中 `updates.requestHeaders.expo-channel-name` 从 `preview` 改成 `production`
2. 重新构建正式版安装包
3. 上传 App Store

因为本项目当前不是 EAS Build 主流程，而是本地 Xcode 打包，所以渠道要在原生配置里固定到安装包中。

## 原生改动后的建议版本策略
推荐这样维护：
- 纯 JS/TS 更新：保持 `runtimeVersion` 不变
- 原生改动：手动升级 `runtimeVersion`

示例：
- `1.0.0-native-ocr-v1`
- `1.0.0-native-ocr-v2`
- `1.1.0-native-v1`

## 验证热更新是否生效
1. 安装新的 TestFlight 基础包
2. 发布一个小的 `preview` 更新
3. 彻底关闭 App 后重新打开 1-2 次
4. 检查更新是否生效

如需更主动的更新体验，后续可以再接入 `expo-updates` 的手动检查与提示刷新逻辑。

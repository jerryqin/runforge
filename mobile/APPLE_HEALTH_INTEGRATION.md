# Apple Health 集成说明

## 功能概述

RunForge 现已集成 Apple Health (HealthKit)，可以自动从 Apple Watch、Garmin、Keep 等设备同步跑步数据，无需手动输入。

### 支持的数据类型

- ✅ 跑步距离（km）
- ✅ 运动时长（秒）
- ✅ 平均心率（bpm）
- ✅ 最大心率（bpm）
- ✅ 卡路里消耗
- ✅ 跑步开始/结束时间

## 构建步骤

由于 Apple HealthKit 是原生模块，需要使用 Expo Dev Client 进行本地构建。

### 1. 安装依赖

依赖已自动安装：
- `react-native-health` - HealthKit SDK
- `expo-dev-client` - 原生模块支持

### 2. 生成原生项目（Prebuild）

```bash
cd mobile
npx expo prebuild --clean
```

这将应用 `plugins/withHealthKit.js` 配置插件，自动添加：
- HealthKit 权限说明（Info.plist）
- HealthKit Capabilities（Entitlements）

### 3. 安装 iOS 依赖

```bash
cd ios
pod install
cd ..
```

### 4. 本地构建并运行

```bash
# 方式 1: 使用 Expo CLI
npx expo run:ios

# 方式 2: 使用 Xcode
# 打开 ios/RunForge.xcworkspace
# 选择真实设备（HealthKit 不支持模拟器）
# 点击 Run
```

**⚠️ 重要提示：**
- HealthKit **仅在真实设备上运行**，不支持模拟器
- 需要 Apple Developer 账号签名
- 首次运行需要授权健康数据访问

## 使用方法

### 1. 首次授权

打开 RunForge App → 输入页面 → 点击 "🍎 健康数据" → "从 Apple Health 同步"

系统会弹出授权对话框，允许读取以下数据：
- 步行+跑步距离
- 心率
- 体能训练
- 活动能量

### 2. 同步跑步记录

授权成功后，App 会自动读取最近 30 天的跑步记录，包含：
- 来源 App（Apple Watch / Garmin / Keep 等）
- 跑步时间、距离、配速
- 平均/最大心率（如果可用）

### 3. 导入数据

点击任意跑步记录 → 数据自动填入表单 → 确认后提交

## 技术实现

### 核心文件

```
mobile/
├── plugins/
│   └── withHealthKit.js          # Expo Config Plugin
├── src/
│   └── services/
│       ├── HealthService.ts       # HealthKit 封装
│       └── useHealthData.ts       # React Hook
└── app/
    └── (tabs)/
        └── input.tsx              # 集成了健康数据同步
```

### 权限配置

`ios/RunForge/Info.plist`:
```xml
<key>NSHealthShareUsageDescription</key>
<string>我们需要读取您的运动数据以分析跑步表现、计算训练负荷并提供个性化建议</string>
```

`ios/RunForge/RunForge.entitlements`:
```xml
<key>com.apple.developer.healthkit</key>
<true/>
```

### API 调用示例

```typescript
import { useHealthData } from '../../src/services/useHealthData';

const healthData = useHealthData();

// 检查可用性
await healthData.checkAvailability();

// 请求权限
const granted = await healthData.requestPermission();

// 同步最近 30 天数据
await healthData.syncWorkouts(30);

// 访问数据
console.log(healthData.workouts);
```

## 常见问题

### Q: 为什么在 Expo Go 中无法使用？

A: HealthKit 是原生模块，Expo Go 不支持。需要使用 `expo run:ios` 构建开发版本。

### Q: 模拟器能测试吗？

A: 不能。HealthKit 仅支持真实 iOS 设备。

### Q: Garmin/咕咚数据如何同步？

A: 

**Garmin**：在 Garmin Connect App 中开启 "健康" → "数据共享" → "Apple Health"，数据会自动同步到 HealthKit，RunForge 再从 HealthKit 读取。

**咕咚**：咕咚暂不支持导出到 Apple Health。建议：
1. 使用截图 OCR 识别
2. 手动输入数据
3. 使用 Strava 作为中转（咕咚 → Strava → Apple Health）

### Q: 为什么有些跑步没有心率数据？

A: 心率数据需要设备支持（如 Apple Watch）。如果跑步时未佩戴手表，HealthKit 中不会有心率记录。

### Q: 如何重新授权？

A: iOS 设置 → 隐私 → 健康 → RunForge → 重新选择权限

## 数据隐私

- ✅ 所有健康数据仅存储在本地 SQLite 数据库
- ✅ 不会上传到任何服务器
- ✅ 用户可随时在系统设置中撤销权限
- ✅ 仅读取跑步相关数据，不访问其他健康信息

## 未来计划

- [ ] 支持 Android Health Connect
- [ ] 批量导入历史记录
- [ ] 实时同步（后台刷新）
- [ ] 支持更多运动类型（骑行、游泳等）

## 开发调试

### 查看 HealthKit 日志

```bash
# iOS 设备日志
xcrun simctl spawn booted log stream --predicate 'subsystem contains "com.jerryqin.runforge"'
```

### 测试数据

在 Apple Health App 中手动添加测试数据：
1. 打开健康 App
2. 浏览 → 活动 → 体能训练
3. 添加数据 → 跑步
4. 输入距离、时长、心率

---

**构建完成后，即可在输入页面看到 "🍎 健康数据" 选项卡！**

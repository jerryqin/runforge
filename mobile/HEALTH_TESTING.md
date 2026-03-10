# Apple Health 集成测试清单

## 快速验证步骤

### 1. 代码检查 ✅
- [x] 已安装 `react-native-health` 和 `expo-dev-client`
- [x] 已创建 `plugins/withHealthKit.js`
- [x] Info.plist 包含 HealthKit 权限说明
- [x] Entitlements 启用 HealthKit capability
- [x] 输入页面包含 "🍎 健康数据" 选项卡

### 2. 本地构建

```bash
# 在 mobile 目录下运行
cd /Users/jerryqin/Projects/runforge/mobile

# 清理并重新构建
npx expo prebuild --clean
cd ios && pod install && cd ..
npx expo run:ios --device
```

### 3. 功能测试

#### 测试 1: 权限请求
1. 打开 App → 输入 Tab
2. 点击 "🍎 健康数据"
3. 点击 "从 Apple Health 同步"
4. 应弹出系统授权对话框
5. 允许读取所有权限

**预期结果**: 授权成功，不报错

#### 测试 2: 数据同步
1. 在 Apple Health App 中添加测试跑步数据
   - 距离: 5.0 km
   - 时长: 30 分钟
   - 心率: 平均 135 bpm
2. 返回 RunForge → 刷新数据
3. 应显示刚添加的跑步记录

**预期结果**: 列表显示 1 条记录，数据匹配

#### 测试 3: 数据导入
1. 点击同步的跑步记录
2. 表单自动填充距离、时长、心率
3. 确认数据无误后提交
4. 跳转到记录详情页

**预期结果**: 数据正确保存，TSS/VDOT 自动计算

#### 测试 4: 真实设备数据
如果有 Apple Watch 或 Garmin:
1. 完成一次真实跑步
2. 数据同步到 Apple Health
3. 在 RunForge 中同步并导入

**预期结果**: 所有字段（包括心率）完整导入

### 4. 降级处理测试

#### 测试 5: Expo Go 环境
1. 使用 `expo start` 启动
2. 在 Expo Go 中打开
3. 点击 "🍎 健康数据"

**预期结果**: 显示提示 "需要使用 expo-dev-client 构建"，不崩溃

#### 测试 6: 无权限状态
1. iOS 设置 → 隐私 → 健康 → RunForge
2. 关闭所有权限
3. 返回 App 尝试同步

**预期结果**: 提示 "授权失败"，可重新请求权限

### 5. 边界情况

#### 测试 7: 无数据
1. 清空 Apple Health 中的跑步记录
2. 尝试同步

**预期结果**: 提示 "未找到跑步记录"

#### 测试 8: 大量数据
1. 同步超过 30 天的数据（修改代码中的天数）
2. 观察性能和 UI 响应

**预期结果**: 数据正确加载，列表可滚动

## 已知限制

- ❌ 不支持 iOS 模拟器（HealthKit 限制）
- ❌ 不支持 Expo Go
- ⚠️ 需要真实设备 + Apple Developer 签名

## 错误排查

### 问题: "Module not found: react-native-health"
**解决**: 
```bash
npm install react-native-health
npx pod-install
```

### 问题: "HealthKit capability not enabled"
**解决**: 
1. 打开 Xcode → RunForge.xcworkspace
2. 选择 RunForge Target → Signing & Capabilities
3. 点击 "+ Capability" → 添加 HealthKit

### 问题: 授权对话框不弹出
**解决**:
1. 检查 Info.plist 是否包含权限说明
2. 卸载 App 重新安装
3. 重启设备

### 问题: 同步后无数据
**解决**:
1. 检查 Apple Health 中是否有 "运动" → "体能训练" → "跑步" 类型数据
2. 确认数据源应用已授权给 Apple Health
3. 查看控制台日志排查错误

## 调试日志

```typescript
// 在 HealthService.ts 中添加日志
console.log('[Health] Status:', await checkHealthAvailability());
console.log('[Health] Workouts:', await fetchRunningWorkouts(30));
```

---

**测试通过标准**: 所有 8 个测试用例 PASS，无崩溃和错误

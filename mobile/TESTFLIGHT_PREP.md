# RunForge TestFlight 准备清单

## 当前版本定位

本轮 TestFlight 目标是验证阶段 1 的本地优先闭环：
- Apple Health 导入
- 手动录入
- 训练反馈
- 历史查看
- 每日提醒
- 本地备份 / 导入

## 当前功能边界

### 开放功能
- 首页今日行动
- Apple Health 同步跑步记录
- 手动录入训练
- 训练反馈页
- 历史记录与 VDOT 趋势
- 每日训练提醒
- 本地备份与恢复

### 暂时隐藏
- 本地 OCR 识别入口
  - 原因：真机稳定性不足
  - 状态：代码保留，UI 入口隐藏

### 明确限制
- 无账号系统
- 无云同步
- 删除 App 会清空本地数据
- 建议测试员在重要操作前先导出备份

## 发布前检查

- [ ] 确认 [mobile/app.json](app.json) 中 `ios.buildNumber` 已递增
- [ ] 运行 `npx tsc --noEmit`
- [ ] 真机回归以下流程：
  - [ ] Apple Health 导入
  - [ ] 手动录入并进入训练反馈
  - [ ] 历史页查看记录
  - [ ] 每日提醒开启 / 关闭 / 测试提醒
  - [ ] 备份导出 / 导入
- [ ] 确认“本地识别”入口已隐藏
- [ ] 确认个人页保留“本地模式”说明

## 建议测试重点

### 首次使用
1. 填写个人档案
2. 开启 Apple Health 权限
3. 导入一条或多条跑步记录
4. 查看首页今日行动是否出现

### 日常使用
1. 手动录入一次训练
2. 查看训练反馈是否合理
3. 去历史页看记录是否正确归档
4. 检查 VDOT 趋势与配速区间是否可读

### 召回与留存
1. 开启每日训练提醒
2. 发送测试提醒
3. 第二天确认提醒是否能正常到达

### 数据安全
1. 导出备份
2. 导入备份
3. 确认数据没有重复异常

## TestFlight 提交建议文案

### Beta App Review 信息
- This build validates a local-first running companion for serious runners.
- Core flows include Apple Health import, manual workout entry, training feedback, reminder, and local backup.
- No account system or cloud sync is included in this phase.

### 给测试员的说明
- 当前版本是本地优先验证版
- 所有数据仅保存在本机
- 删除 App 前请先导出备份
- 图片识别入口已临时隐藏，不影响本轮核心测试

## 建议上传流程

1. 打开 [mobile/ios/RunForge.xcworkspace](ios/RunForge.xcworkspace)
2. 选择 `Any iOS Device (arm64)` 或连接真机
3. `Product` → `Archive`
4. 在 Organizer 中选择 `Distribute App`
5. 选择 `App Store Connect`
6. 上传后在 App Store Connect 中配置 TestFlight 测试员

## 本轮通过标准

满足以下条件即可进入外部小范围测试：
- 无启动闪退
- Apple Health 导入可用
- 手动录入可用
- 训练反馈可用
- 提醒可用
- 备份可用
- 本地 OCR 已隐藏，不影响主流程

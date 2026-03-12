# RunForge：用 Xcode 上传 TestFlight 的最短操作清单

## 0. 上传前只检查 4 件事

1. 确认代码已是可发布状态
   - 本地 OCR 入口已隐藏
   - 核心流程可用：Health 导入、手动录入、训练反馈、历史、提醒、备份

2. 确认版本号 / 构建号
   - 查看 [app.json](app.json)
   - 当前已配置：`ios.buildNumber = 2`
   - 如果再次上传新包，先把 `buildNumber` 继续加 1

3. 做一次本地类型检查
   - 在 [mobile](.) 目录执行：`npx tsc --noEmit`

4. 确认已登录 Xcode 的 Apple Developer 账号
   - Xcode → Settings → Accounts

---

## 1. 打开正确工程

打开：
- [ios/RunForge.xcworkspace](ios/RunForge.xcworkspace)

不要打开：
- `RunForge.xcodeproj`

---

## 2. 选择归档目标

在 Xcode 顶部 Scheme 区域：
- Scheme 选择 `RunForge`
- Device 选择 `Any iOS Device (arm64)`

---

## 3. 执行 Archive

菜单栏：
- `Product` → `Archive`

等待打包完成。
完成后会自动打开 Organizer。

---

## 4. 上传到 App Store Connect

在 Organizer 中：
1. 选中刚生成的 Archive
2. 点击 `Distribute App`
3. 选择 `App Store Connect`
4. 选择 `Upload`
5. 默认选项通常直接继续即可
6. 等待上传完成

---

## 5. 在 App Store Connect 打开 TestFlight

进入：
- App Store Connect → My Apps → RunForge → TestFlight

然后等待构建处理完成。
通常需要几分钟到十几分钟。

---

## 6. 添加测试员

### 内部测试
如果只是自己或团队先测：
- 直接加内部测试员
- 选择刚上传的 build
- 开始测试

### 外部测试
如果要发给外部用户：
- 填写 Beta App Review 信息
- 提交审核
- 审核通过后再添加外部测试员

---

## 7. 当前项目建议填写的 Beta 说明

### Beta App Review
- This build validates a local-first running companion for serious runners.
- Core flows include Apple Health import, manual workout entry, training feedback, history review, reminder, and local backup.
- No account system or cloud sync is included in this phase.
- OCR entry is temporarily hidden in this build due to stability reasons.

### 给测试员的话
- 当前版本是阶段 1 本地优先验证版
- 所有数据仅保存在本机
- 删除 App 前请先导出备份
- 当前版本重点测试：Health 导入、手动录入、训练反馈、提醒、备份

---

## 8. 上传后建议立刻验证

安装 TestFlight 包后，至少走一遍：
1. 打开 App
2. 填写个人档案
3. Apple Health 导入
4. 手动录入一条训练
5. 查看训练反馈
6. 查看历史页
7. 开启提醒并发送测试提醒
8. 导出一次备份

---

## 9. 如果上传失败，优先检查

1. `buildNumber` 是否重复
2. 签名账号是否正确
3. 是否打开了 `RunForge.xcworkspace`
4. Xcode 是否已登录开发者账号
5. Archive 是否来自 `Release`/标准分发流程

---

## 最短版一句话流程

打开 [ios/RunForge.xcworkspace](ios/RunForge.xcworkspace) → 选 `RunForge` + `Any iOS Device (arm64)` → `Product > Archive` → Organizer 里 `Distribute App` → `App Store Connect` → `Upload`。

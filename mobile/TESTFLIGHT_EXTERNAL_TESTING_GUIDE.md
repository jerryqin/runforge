# RunForge TestFlight 外部测试指南

## 📋 目录

- [一、外部测试者邀请流程](#一外部测试者邀请流程)
- [二、推荐发布平台](#二推荐发布平台)
- [三、重要注意事项](#三重要注意事项)
- [四、文案模板](#四文案模板)

---

## 一、外部测试者邀请流程

### 1.1 App Store Connect 配置步骤

#### 步骤 1：提交 Beta 审核
1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 选择 **My Apps** → **RunForge** → **TestFlight**
3. 点击刚上传的构建版本
4. 填写 **测试详情**：
   - **测试信息**（Test Information）
   - **Beta App 审核信息**（见下方模板）
   - **测试员须知**（What to Test）
5. 提交审核（通常 1-2 个工作日）

#### 步骤 2：创建外部测试组
1. 进入 **TestFlight** → **External Testing**
2. 点击 ➕ 创建新测试组
3. 填写组名：如 "首批体验用户" 或 "跑步爱好者组"
4. 选择要测试的构建版本
5. 保存

#### 步骤 3：添加测试员
**方法 A：通过邮箱邀请**
1. 在测试组中点击 **Add Testers**
2. 输入测试员邮箱地址（可批量添加，每行一个）
3. 点击 **Add**
4. 测试员会收到邮件，包含 TestFlight 邀请链接

**方法 B：生成公开链接**
1. 在测试组页面找到 **Public Link**
2. 点击 **Enable Public Link**
3. 复制链接分享给测试员
4. 设置最大测试员数量（最多 10,000 人）

### 1.2 测试员加入流程

测试员需要：
1. 在 iPhone/iPad 上安装 [TestFlight App](https://apps.apple.com/app/testflight/id899247664)
2. 点击邀请邮件中的链接，或扫描二维码
3. 在 TestFlight 中接受邀请
4. 点击 **安装** 下载 RunForge

### 1.3 TestFlight 限制

- **外部测试员上限**：10,000 人
- **每个构建测试期限**：90 天
- **审核时间**：1-2 个工作日
- **设备要求**：iOS 13.0 或更高版本

---

## 二、推荐发布平台

### 2.1 跑步垂直社区

#### 国内平台
| 平台 | 用户特点 | 推荐指数 | 发布方式 |
|------|---------|---------|---------|
| **跑步圈 App** | 认真跑者，关注训练科学 | ⭐⭐⭐⭐⭐ | 社区发帖 + 私信邀请 |
| **Keep** | 大众健身用户，跑步板块活跃 | ⭐⭐⭐⭐ | 发布跑步动态 + 评论区互动 |
| **咕咚** | 跑步打卡用户多 | ⭐⭐⭐⭐ | 社区发帖 |
| **悦跑圈** | 马拉松爱好者集中 | ⭐⭐⭐⭐ | 话题讨论区 |
| **小红书** | 年轻用户，适合图文种草 | ⭐⭐⭐⭐⭐ | #跑步训练 #马拉松备赛 标签 |

#### 国际平台
| 平台 | 用户特点 | 推荐指数 | 备注 |
|------|---------|---------|------|
| **Strava** | 全球最大跑步社区 | ⭐⭐⭐⭐⭐ | 发布到 Club 或个人动态 |
| **Reddit** | 英文用户，深度讨论 | ⭐⭐⭐⭐ | r/running, r/AdvancedRunning |
| **Twitter/X** | 科技早期采用者 | ⭐⭐⭐ | #RunningApp #TrainingApp |

### 2.2 开发者/科技社区

| 平台 | 受众 | 推荐指数 |
|------|------|---------|
| **Product Hunt** | 全球产品爱好者 | ⭐⭐⭐⭐⭐ |
| **V2EX** | 中国开发者社区 | ⭐⭐⭐⭐ |
| **即刻 App** | 科技产品早期用户 | ⭐⭐⭐⭐⭐ |
| **少数派** | iOS 用户，重度数字工具用户 | ⭐⭐⭐⭐⭐ |

### 2.3 私域渠道

- **微信朋友圈**：个人背书 + 邀请码
- **跑步微信群**：直接邀请活跃跑者
- **企业/校园跑团**：定向邀请组织成员

---

## 三、重要注意事项

### 3.1 测试前自查（每次发布前）

- [ ] **版本号检查**：`app.json` 中 `ios.buildNumber` 已递增
- [ ] **类型检查**：运行 `npx tsc --noEmit` 无错误
- [ ] **真机回归**：
  - [ ] Apple Health 导入可用
  - [ ] 手动录入 + 训练反馈流程正常
  - [ ] 历史记录与 VDOT 趋势显示正确
  - [ ] 每日提醒可正常触发
  - [ ] 备份导出/导入功能正常
  - [ ] TSB < -30 时恢复计划正确显示
- [ ] **隐私合规**：确认隐私政策 URL 可访问

### 3.2 发布时机建议

**最佳发布时间**：
- 工作日 **周二 ~ 周四** 上午 9-11 点
- 避开周末和节假日（审核慢）
- 避开苹果春季/秋季发布会周（审核严格）

### 3.3 风险提示

**必须告知测试员的内容**：
1. ⚠️  **本地存储**：所有数据仅保存在设备本地
2. ⚠️  **无云备份**：删除 App 会永久丢失数据
3. ⚠️  **操作建议**：重要操作前先导出备份
4. ⚠️  **版本限制**：每个 TestFlight 构建仅 90 天有效期

### 3.4 法律与隐私

- 确保 `privacy-policy.html` 已部署到可访问的 URL
- TestFlight 审核会检查隐私说明
- 确保 Apple Health 权限请求文案清晰合理

### 3.5 反馈收集

建议准备：
- **问卷表单**（腾讯问卷 / Google Forms）
- **反馈微信群**（测试员专属）
- **Issue 追踪**（GitHub Issues 或内部工具）

---

## 四、文案模板

### 4.1 Beta App Review 信息（提交审核时填写）

```
App Name: RunForge
Category: Health & Fitness
Language: Chinese (Simplified), English

What to Test:
This is a local-first running companion app for serious runners training for marathons.

Core features to test:
1. Apple Health integration - Import running workouts automatically
2. Manual workout entry - Record training sessions with HR, pace, distance
3. Training feedback - View post-workout analysis and recommendations
4. Recovery planning - Auto-generate recovery plans when TSB < -30
5. Daily reminders - Schedule and receive training notifications
6. Local backup - Export and import all training data

Key points:
- No account system or cloud sync in this phase
- All data stored locally on device
- Users should export backups before app deletion
- OCR image recognition is temporarily hidden due to stability issues

Test Account: Not required (no login system)

Notes for Reviewer:
This build targets experienced runners who understand training concepts like VDOT, TSB, ATL/CTL. The app uses Jack Daniels' training methodology and provides science-based training guidance.
```

### 4.2 测试员须知（TestFlight App 内显示）

#### 中文版
```
欢迎测试 RunForge！

【当前版本定位】
这是阶段 1 本地优先验证版，专注于核心训练记录与分析功能。

【重点测试内容】
✅ Apple Health 同步跑步记录
✅ 手动录入训练数据
✅ 训练后查看反馈分析
✅ 身体状态监测（ATL/CTL/TSB）
✅ TSB < -30 时查看恢复计划
✅ 每日训练提醒
✅ 本地备份与恢复

【重要提醒】
⚠️ 所有数据仅保存在本机，删除 App 前请先导出备份
⚠️ 当前无账号系统和云同步
⚠️ 图片识别入口已临时隐藏（不影响核心功能）

【如何反馈】
遇到问题或有建议，请通过以下方式反馈：
- 邀请邮件中的反馈表单
- 测试群反馈（进群链接见邮件）
- 直接回复邀请邮件

感谢你的测试！🏃‍♂️
```

#### English Version
```
Welcome to RunForge Beta Testing!

【Current Version Focus】
This is Phase 1 local-first validation build, focusing on core training tracking and analysis.

【What to Test】
✅ Apple Health workout sync
✅ Manual training entry
✅ Post-workout feedback & analysis
✅ Body condition monitoring (ATL/CTL/TSB)
✅ Recovery plan generation when TSB < -30
✅ Daily training reminders
✅ Local backup & restore

【Important Notes】
⚠️ All data stored locally - export backups before deleting app
⚠️ No account system or cloud sync in this phase
⚠️ OCR image recognition temporarily hidden (doesn't affect core features)

【How to Provide Feedback】
Report issues or suggestions via:
- Feedback form in invitation email
- Testing group chat (link in email)
- Reply to invitation email directly

Thank you for testing! 🏃‍♂️
```

### 4.3 社交媒体发布文案

#### 小红书 / 即刻文案
```
🏃‍♂️ 寻找 20 位认真跑者，测试我的新 App

我是一名马拉松爱好者 + 开发者，花了几个月时间做了一款跑步训练 App —— RunForge。

它不是又一个跑步打卡工具，而是你的**训练科学顾问**：

✨ 核心功能
• Apple Health 自动同步跑步数据
• 智能分析每次训练的强度和恢复情况
• 基于 Jack Daniels 训练法计算 VDOT 和配速区间
• 监测身体疲劳指数（TSB），过度疲劳时自动生成恢复计划
• 每日训练提醒，不会让你忘记练

📱 为什么需要测试员？
刚上 TestFlight，需要真实跑者的反馈来打磨细节。

🎯 适合谁？
• 正在备战马拉松 / 半马
• 关心训练科学（知道 VDOT、心率区间、TSB 等概念更佳）
• 使用 iPhone + Apple Watch / 跑步 App
• 愿意花 10-15 分钟体验 + 反馈

🎁 测试员福利
• 抢先体验完整功能
• 直接影响产品走向
• 正式版免费使用（未来可能付费）

💌 如何加入？
1. 扫描下方 TestFlight 二维码
2. 或评论留言，我私信发邀请链接
3. 加入测试群获取最新动态

数量有限，先到先得！

[附上 TestFlight 公开链接二维码]

#跑步训练 #马拉松备赛 #跑步App #TestFlight #跑步科学
```

#### Twitter/X 文案
```
🏃‍♂️ Calling serious runners for beta testing!

I built RunForge - a local-first training companion for marathon runners.

Not just another tracking app, but your training science advisor:
• Auto-sync from Apple Health
• VDOT-based pace zones (Jack Daniels method)
• Body condition monitoring (ATL/CTL/TSB)
• Auto recovery plans when overtrained
• Science-backed training feedback

Now on TestFlight. Looking for 20 runners who:
✅ Training for marathon/half
✅ Care about training science
✅ Use iPhone + running apps
✅ Can provide feedback

DM me or comment for invite link!

#RunningApp #Marathon #TrainingApp #TestFlight #iOSApp
```

#### Product Hunt 文案
```
RunForge - Your Local-First Running Training Advisor

Tagline: Science-based training companion for serious marathon runners

Description:
RunForge is a mobile app that helps marathon runners train smarter, not just harder. Built for runners who care about training science.

🎯 Problem
Existing running apps are great for tracking, but poor at training guidance. Swimmers get instant feedback from pool times, but runners struggle to balance training load, recovery, and avoid overtraining.

💡 Solution
RunForge brings training science concepts (VDOT, TSB, ATL/CTL) into an easy-to-use app:
• Auto-import workouts from Apple Health
• Instant post-workout analysis & recommendations
• Body condition monitoring (fatigue vs. fitness)
• Auto-generate recovery plans when overtrained
• VDOT-based pace zones using Jack Daniels methodology

🔒 Privacy-First
• Local-first: All data stored on device
• No account required
• No cloud sync (Phase 1)
• Full data export anytime

📱 Now on TestFlight
Looking for experienced runners to test and provide feedback!

#HealthAndFitness #Running #Marathon #Training #iOS
```

### 4.4 邀请邮件模板

#### 主题
```
【RunForge TestFlight】邀请你测试我的跑步训练 App
```

#### 正文（中文）
```
嗨，

感谢你愿意测试 RunForge！

我是 [你的名字]，一名马拉松爱好者 + iOS 开发者。过去几个月，我一直在开发一款跑步训练 App，现在它已经准备好接受真实跑者的检验了。

🎯 RunForge 是什么？
一款本地优先的跑步训练助手，专为认真训练的跑者设计。它不只是记录数据，而是帮你理解训练、管理疲劳、科学恢复。

核心功能：
• Apple Health 自动同步跑步记录
• 训练后即时分析与建议
• 身体状态监测（ATL/CTL/TSB 疲劳与体能指标）
• 疲劳过度时自动生成恢复计划
• VDOT 计算与训练配速区间
• 每日训练提醒

📱 如何开始测试？
1. 在 iPhone 上安装 TestFlight App（App Store 搜索 "TestFlight"）
2. 点击下方链接加入测试：
   👉 [TestFlight 邀请链接]
3. 在 TestFlight 中点击"安装"下载 RunForge

⚠️ 重要提醒
• 当前版本所有数据仅保存在本机，无云同步
• 删除 App 前请先使用"导出备份"功能
• 每个测试版本有效期 90 天，到期前会推送新版本

🧪 测试建议
第一次使用：
1. 填写个人档案（最大心率、乳酸阈值心率、周跑量）
2. 授权 Apple Health 读取权限
3. 导入历史跑步记录
4. 查看首页"今日行动"是否生成
5. 手动录入一次新训练，查看反馈

日常使用：
• 每次跑步后看看训练反馈
• 留意身体状态指标变化
• 如果 TSB < -30（疲劳过高），尝试查看恢复计划

💬 如何反馈？
遇到问题或有建议，请通过以下方式告诉我：
• 填写反馈问卷：[问卷链接]
• 加入测试群：[微信群二维码]
• 直接回复本邮件

🙏 最后
感谢你花时间测试 RunForge！你的反馈对产品改进至关重要。

如果测试过程中遇到任何问题，随时联系我。

祝跑步愉快！🏃‍♂️

[你的名字]
RunForge 开发者

---
P.S. 如果你身边有其他认真训练的跑者朋友，欢迎把这封邮件转发给他们！
```

### 4.5 反馈问卷模板

建议使用腾讯问卷或 Google Forms，包含以下问题：

#### 基本信息
1. 你是通过什么渠道了解到这次测试的？
   - [ ] 小红书
   - [ ] 即刻
   - [ ] 朋友推荐
   - [ ] 跑步社区
   - [ ] 其他：______

2. 你的跑步经验？
   - [ ] 1 年以内
   - [ ] 1-3 年
   - [ ] 3-5 年
   - [ ] 5 年以上

3. 你最常使用的跑步 App？（多选）
   - [ ] Apple Watch 健身记录
   - [ ] Nike Run Club
   - [ ] Strava
   - [ ] Keep
   - [ ] 咕咚
   - [ ] 悦跑圈
   - [ ] 其他：______

#### 功能体验
4. 你成功完成了哪些操作？（多选）
   - [ ] Apple Health 数据导入
   - [ ] 手动录入训练
   - [ ] 查看训练反馈
   - [ ] 查看身体状态（ATL/CTL/TSB）
   - [ ] 查看恢复计划
   - [ ] 设置每日提醒
   - [ ] 导出备份
   - [ ] 导入备份

5. 使用过程中遇到的问题？（多选）
   - [ ] Health 数据导入失败
   - [ ] 手动录入卡顿
   - [ ] 训练反馈不准确
   - [ ] 界面显示异常
   - [ ] 提醒没有到达
   - [ ] 备份功能出错
   - [ ] 其他：______

6. 首页"今日行动"的建议是否合理？
   - [ ] 非常合理
   - [ ] 基本合理
   - [ ] 不太合理
   - [ ] 完全不合理
   - [ ] 还未看到今日行动

7. 身体状态监测（ATL/CTL/TSB）对你有帮助吗？
   - [ ] 非常有帮助，理解了疲劳和体能关系
   - [ ] 有帮助，但还不太理解这些指标
   - [ ] 没什么帮助，不关心这些数据
   - [ ] 还未使用这个功能

8. 如果 TSB < -30（疲劳过高），恢复计划是否实用？
   - [ ] 非常实用，会按计划执行
   - [ ] 基本实用，会作为参考
   - [ ] 不太实用，建议太简单
   - [ ] 还未看到恢复计划

#### 整体评价
9. 整体使用体验打分（1-5 分）
   - 1 分（很差）
   - 2 分（较差）
   - 3 分（一般）
   - 4 分（较好）
   - 5 分（很好）

10. 你最喜欢的功能是？
    [文本输入]

11. 你最希望改进的功能是？
    [文本输入]

12. 如果正式版免费，你会继续使用吗？
    - [ ] 一定会
    - [ ] 可能会
    - [ ] 可能不会
    - [ ] 一定不会

13. 如果正式版付费（一次性买断 ¥18-30），你会购买吗？
    - [ ] 一定会
    - [ ] 可能会
    - [ ] 可能不会
    - [ ] 一定不会

14. 其他建议或意见
    [文本输入]

---

## 五、发布后跟进计划

### 5.1 第一周（冷启动期）

**Day 1-2：小范围邀请**
- 目标：10-15 人
- 渠道：个人朋友圈、跑步微信群
- 关注：是否有闪退、核心流程是否可用

**Day 3-4：扩大范围**
- 目标：50-100 人
- 渠道：小红书、即刻、V2EX
- 动作：
  - 发布测试邀请帖
  - 回复评论，私信发送邀请链接
  - 创建测试反馈群

**Day 5-7：收集第一轮反馈**
- 发送反馈问卷
- 建立 FAQ 文档
- 修复紧急 Bug

### 5.2 第二周（稳定迭代期）

- 根据反馈优化核心功能
- 发布 OTA 热更新（纯 JS 改动）
- 如需原生改动，准备新的 TestFlight 构建

### 5.3 持续运营

**每周**：
- 发布更新日志（TestFlight 内 + 测试群）
- 整理反馈 Top 3 问题
- 至少发一次产品动态（社交媒体）

**每两周**：
- 发送反馈问卷（监测体验变化）
- 分析留存数据（TestFlight 仪表盘）

---

## 六、成功指标

### 6.1 量化目标（首月）

| 指标 | 目标值 | 评估标准 |
|-----|--------|---------|
| 测试员人数 | 100-200 人 | 基础量级 |
| 7 日留存率 | > 40% | 产品吸引力 |
| 问卷回收率 | > 30% | 用户参与度 |
| 导出备份率 | > 50% | 用户信任度 |
| 每周活跃率 | > 50% | 产品使用频率 |

### 6.2 定性目标

- 收到至少 30 份详细反馈
- 识别出 3-5 个高优先级改进点
- 确认核心价值主张（用户真正在意什么功能）
- 建立种子用户社群（20-30 活跃用户）

---

## 七、常见问题 FAQ

### Q1: TestFlight 链接失效了怎么办？
A: TestFlight 构建有 90 天有效期，到期前会推送新版本。如遇链接失效，请联系我重新发送。

### Q2: 为什么只支持 iOS？
A: 当前是 Phase 1 验证版本，优先支持 iPhone。后续会考虑 Android 版本。

### Q3: 数据会丢失吗？
A: 所有数据存储在本地，删除 App 会丢失。建议定期使用"导出备份"功能。

### Q4: 什么时候正式发布？
A: 预计 TestFlight 测试 1-2 个月后，会提交 App Store 审核正式上架。

### Q5: 测试员有人数限制吗？
A: TestFlight 外部测试最多 10,000 人，目前还有大量名额。

### Q6: 我不懂 VDOT、TSB 这些概念，适合我吗？
A: 这些是训练科学概念，App 内有简单解释。如果你只是记录跑步，可能不太适合。

### Q7: 会有付费版吗？
A: 未来可能会有高级功能付费或一次性买断，但测试员会获得永久免费权益。

---

## 八、应急预案

### 场景 1：批量闪退
**应对**：
1. 立即在测试群发公告
2. 通过 EAS Update 推送热修复（如果是 JS 问题）
3. 如果是原生问题，紧急打新包上传 TestFlight
4. 跟进受影响用户，确保问题解决

### 场景 2：数据丢失投诉
**应对**：
1. 确认是否是备份功能问题
2. 如果是 Bug，立即修复并发版
3. 在测试须知中加粗强调备份重要性
4. 提供数据恢复指导（如果可能）

### 场景 3：Apple 审核被拒
**常见原因**：
- 隐私政策不完整
- 功能描述不清楚
- 缺少必要的使用说明

**应对**：
1. 查看拒绝原因详情
2. 按要求修改后重新提交
3. 如有疑问，通过 App Store Connect 与审核团队沟通

### 场景 4：负面反馈集中爆发
**应对**：
1. 快速响应，表示正在处理
2. 识别共性问题，按优先级修复
3. 发布更新说明，告知进展
4. 私下联系重点用户，深入了解问题

---

## 九、检查清单

### 发布前（每次上传新构建）

- [ ] `app.json` 中 `buildNumber` 已递增
- [ ] 运行 `npx tsc --noEmit` 通过
- [ ] 真机回归核心流程无问题
- [ ] 隐私政策 URL 可访问
- [ ] Beta Review 信息已更新
- [ ] 测试员须知已更新

### 邀请前

- [ ] TestFlight 构建已通过 Apple 审核
- [ ] 测试组已创建
- [ ] 公开链接已生成（或准备邮箱列表）
- [ ] 反馈问卷已准备好
- [ ] 测试群已建立

### 发布时

- [ ] 社交媒体文案已准备
- [ ] 邀请邮件模板已准备
- [ ] 监控渠道已设置（TestFlight 后台 + 反馈群）
- [ ] 应急联系方式已公布

---

🎉 **祝 TestFlight 测试顺利！你的每一步反馈都在让 RunForge 变得更好。**

如有任何问题，随时查阅本文档或联系团队。

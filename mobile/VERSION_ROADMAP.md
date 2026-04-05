# RunForge 版本演进路线图

**当前版本：1.0.2(3)**  
**制定日期：2026-04-05**

版本号约定：`主版本.功能版本.修复版本(构建号)`，括号内构建号每次 App Store 提交递增。

---

## Phase 1 — 打磨期（1-3个月）

### 1.0.3(4) HealthKit 深化 + 体验打磨
> 🔄 OTA可推送（纯JS优化），原生改动需重建

**HealthKit 强化：**
- 同步步频（cadence）数据并在记录详情中展示（代码中已有字段但未完整显示）
- 同步卡路里消耗数据
- HealthKit 同步失败时提供更友好的排查引导（当前只有 log，用户无提示）
- 支持 Garmin / Nike Run / Keep 数据通过 HealthKit 桥接导入（这些 App 都写入 HealthKit）

**UX 细节：**
- 历史页支持按距离/强度/日期范围筛选
- 历史记录支持左滑快速删除
- 训练记录详情增加分享功能（生成精美图卡，可分享至微信/朋友圈）
- OCR 识别增加 Garmin、Strava 截图格式支持

**关键文件修改：**
- `app/(tabs)/history.tsx` - 添加筛选器
- `app/record/[id].tsx` - 添加分享按钮
- `src/services/HealthService.ts` - 补全字段显示
- `src/services/OCRService.ts` - 扩展格式识别

---

### 1.0.4(5) 数据可视化升级
> 🔄 OTA可推送

- 历史页新增月度里程柱状图
- VDOT 趋势由10条扩展到30/60/90天可选
- 过去30天训练类型饼图（E/M/T/I/R 各占比例）
- 档案页增加"配速进化曲线"（同距离配速随时间变化）
- **iOS 主屏小组件（Widget）**：显示今日训练处方（需新构建）

**关键文件修改：**
- `app/(tabs)/history.tsx` - 新增图表组件
- `app/(tabs)/profile.tsx` - 新增曲线图
- `ios/RunForge/RunForgeWidgets.swift` - 新增 Widget 逻辑

---

## Phase 2 — 留存期（3-6个月）

### 1.1.0(6) 自我挑战系统
> 📱 新模块，需提交 App Store

**个人记录（PB）系统：**
- 自动追踪 5K / 10K / 半马 / 全马个人最佳成绩
- 档案页展示 PB 里程碑时间线
- 录入记录后若破 PB 触发特别庆祝动画

**连续训练打卡：**
- Streak 统计（连续训练天数 / 周数）
- 打断连续记录时提供鼓励文案而非惩罚感
- 本周/本月/年度完成率 vs 目标对比

**成就徽章系统：**
- 里程碑类：首次100km、500km、1000km
- 进步类：VDOT 每提升5分
- 坚持类：连续4周完成周目标
- 挑战类：单月完成马拉松训练计划全程

**月度挑战：**
- 系统每月生成预设挑战（如"4月跑满150km"）
- 用户也可自建私人挑战目标

**关键文件修改：**
- `src/db/` - 新增表：`achievement_records` / `streaks` / `monthly_challenges`
- 新增组件：`AchievementBadge.tsx` / `StreakCard.tsx` / `ChallengeCard.tsx`
- `src/engine/` - 新增 `AchievementEngine.ts` 计算逻辑

---

### 1.1.1(7) Apple Watch 伴侣 App
> ⌚ 独立原生开发，需新构建

- Watch 表盘复杂功能（Complication）：显示今日训练处方
- 从手腕查看最近记录
- 快捷录入（跑完直接在 Watch 上确认导入）
- 实时心率区间提示（训练中振动提醒心率超低/超高）

**关键点：**
- 需要单独的 WatchKit 工程
- 与主 App 通过 WatchConnectivity 框架同步

---

## Phase 3 — 云端期（6-9个月）

### 1.2.0(8) 用户账号系统
> 🌐 Supabase 框架代码已预留（`SupabaseService.ts`）

**注册/登录：**
- 邮件 + Apple Sign In + Google Sign In（iOS 已支持，安卓需在 3.0.0 时补充）
- 匿名模式 → 实名账号数据无损迁移
- 账号头像 + 跑步昵称

**账号安全：**
- 账号注销 + 数据完整删除（配合 App Store 审核要求）
- GDPR 标准数据导出（已有 JSON 导出基础）

**关键文件修改：**
- `src/services/SupabaseService.ts` - 启用认证接口
- 新增屏幕：`auth/login.tsx` / `auth/signup.tsx` / `auth/profile-setup.tsx`
- `src/db/` - 新增表：`user_accounts` / `account_metadata`
- 后端：Supabase PostgreSQL 初始化脚本

---

### 1.2.1(9) 多设备云同步
> ☁️ 依赖 1.2.0

- 训练数据自动加密同步至 Supabase（端对端加密可选）
- iPhone + iPad 数据实时同步
- 新设备登录自动恢复全部历史数据
- 云端备份替代现有手动 JSON 导出
- 离线优先架构：无网络时正常使用，恢复网络后自动同步

**关键文件修改：**
- `src/services/SyncService.ts` - 新增双向同步引擎
- `src/db/` - 新增冲突解决策略
- 后端：Supabase 实时订阅(Realtime)配置

---

## Phase 4 — 智能期（9-12个月）

### 1.3.0(10) AI 训练教练
> 🤖 依赖云端账号，需后端服务

**智能周报：**
- 每周日自动推送：本周训练质量评分、疲劳趋势、下周训练建议
- 对比同 VDOT 水平用户的匿名训练数据（需有一定用户基数）

**训练计划自适应调整：**
- 当前训练计划是静态生成的，此版本改为动态调整
- 实际完成情况 vs 计划偏差时，自动重新计算后续安排
- "伤病风险预警"：急性负荷比（ATL/CTL）异常时主动提醒

**比赛预测升级：**
- 加入置信区间（"你有80%概率跑进 3:45"）
- 基于历史 VDOT 波动生成悲观/预期/最优三条预测线

**关键文件修改：**
- `src/engine/AnalysisEngine.ts` - 增强分析模型
- 新增屏幕：`intelligence/weekly-report.tsx`
- 后端：AI/ML 模型服务（推荐 OpenAI/Anthropic API 或本地 TFLite）

---

### 1.3.1(11) 第三方平台集成
> 🔗 需申请各平台 API

- **Strava**：OAuth 授权，双向同步跑步记录
- **Garmin Connect**：导入历史数据
- **佳明/咕咚/悦跑圈**：国内平台数据导入
- 统一数据源管理（避免重复导入）

**关键文件修改：**
- `src/services/IntegrationService.ts` - 新增第三方接口
- 后端：代理第三方 API（处理认证、频率限制等）

---

## Phase 5 — 社交期（12-18个月）

### 2.0.0(12) 社交核心
> 👥 架构级变化，依赖云端账号系统

**关系系统：**
- 关注跑友（私信功能不做，避免内容审核复杂性）
- 动态 Feed：跑友的跑步记录、PB 突破、成就解锁
- Kudos 点赞（类似 Strava）

**内容分享：**
- 一键生成精美跑步成绩图卡（含 VDOT、配速、地图轨迹如果有的话）
- 分享至微信、朋友圈、Instagram Stories

**关键文件修改：**
- 新增屏幕：`social/feed.tsx` / `social/profile.tsx` / `social/follow.tsx`
- `src/services/SocialService.ts` - 新增社交接口
- 后端：社交图谱、动态 Feed 算法

---

### 2.0.1(13) 群组挑战
> 🏆 依赖 2.0.0

- 创建/加入挑战组（如"我们公司4月跑满500km"）
- 组内实时排行榜
- 挑战链接邀请（无需 App 也能看排行，提升传播）
- 系统级全球挑战赛事（节气挑战、重大赛事联动）

**关键文件修改：**
- 新增屏幕：`social/challenges.tsx` / `social/leaderboard.tsx` / `social/group-detail.tsx`
- 后端：群组管理、排行榜计算、实时排名更新

---

### 2.0.2(14) 游戏化系统
> 🎮 依赖社交基础

**等级与经验值：**
- XP 系统：训练负荷（TSS）直接兑换经验值，强化训练有双倍 XP
- 等级体系：新手跑者 → 业余跑者 → 进阶跑者 → 竞技跑者 → 精英跑者
- 等级影响训练建议文案的"措辞风格"（新手温柔引导，精英直接干练）

**虚拟赛道：**
- 在地图上完成"虚拟环游中国"（按里程累计逐段解锁城市）
- 虚拟奖牌可收藏展示

**关键文件修改：**
- `src/engine/GamificationEngine.ts` - XP/等级计算
- 新增屏幕：`gamification/badges.tsx` / `gamification/routes.tsx` / `gamification/leaderboard.tsx`
- 后端：虚拟徽章、地图数据

---

## Phase 6 — 平台期（18个月+）

### 3.0.0 全平台化
- **Android** 完整功能支持（Health Connect 对接）
- **iPad** 优化布局（大屏双栏视图）
- **Mac Catalyst** 版本（供教练用大屏分析运动员数据）

**关键点：**
- 需要 Android 原生模块（Health Connect、HealthKit 等价物）
- 跨平台 UI 适配（响应式设计）

---

### 3.0.1 教练模式
- 教练账号可管理多名运动员
- 批量查看运动员训练状态、疲劳指数
- 远程修改运动员训练计划
- 适合马拉松训练团队/跑步俱乐部使用

**关键屏幕：**
- `coach/athletes-list.tsx` / `coach/athlete-detail.tsx` / `coach/plan-editor.tsx`

---

## 优先级与时间轴总结

| 优先级 | 版本 | 核心价值 | 预估周期 | 关键依赖 |
|---|---|---|---|---|
| P0 | 1.0.3 – 1.0.4 | 留住现有用户，打磨体验 | 1-2个月 | 无 |
| P1 | 1.1.0 – 1.1.1 | 自我挑战 + Watch，大幅提升留存率 | 2-3个月 | iOS 12+ / WatchOS 6+ |
| P2 | 1.2.0 – 1.2.1 | 账号+云同步，跨设备 | 2-3个月 | Supabase 后端 |
| P3 | 1.3.0 – 1.3.1 | AI 智能训练 + 第三方集成 | 2-3个月 | 服务端 API / 第三方 SDK |
| P4 | 2.0.x | 社交裂变，用户增长 | 3-4个月 | Feed 算法、内容审核 |
| P5 | 3.0.x | 平台化 / B端 | 6个月+ | Android / 教练系统 |

---

## 快速推进策略

**近期立即可做（不需要服务器）：**
1. **1.0.3 的 HealthKit 数据补全、左滑删除、分享图卡** — 纯本地逻辑，可 OTA 推送或小版本快速迭代
2. **1.1.0 的 PB 系统和成就徽章** — 计算逻辑已在 `AnalysisEngine`，仅需 UI 封装
3. **1.0.4 的数据可视化** — 基于现有数据，图表库集成

**并行准备（预研，不阻塞主线）：**
- Supabase 账号系统架构设计
- AI 模型选型（OpenAI vs Anthropic vs 本地 TFLite）
- Strava / Garmin API 集成方案
- Android 版本技术选型（Expo/EAS 支持度评估）

---

## 技术栈补充

| 层级 | 现状 | 1.0-1.1 | 1.2+ | 2.0+ | 3.0+ |
|---|---|---|---|---|---|
| **前端框架** | Expo / React Native | ✅ 保持 | ✅ Expo | ✅ | ✅ + Android |
| **后端** | 无 | — | Supabase | Supabase + 业务 API | + 教练系统 |
| **数据库** | SQLite 本地 | ✅ | + Supabase PostgreSQL | ✅ | ✅ |
| **认证** | 无 | — | Supabase Auth | ✅ + OAuth | ✅ |
| **实时通信** | 无 | — | Supabase Realtime | Websocket/MQTT | ✅ |
| **AI/ML** | 无 | — | — | 第三方 API / TFLite | ✅ |
| **社交图谱** | 无 | — | — | Redis / Graph DB | ✅ |

---

## 文档与工程记录

- 每个版本发布时更新本文件
- 关键架构变更单独记录在 `ARCHITECTURE.md`
- 数据库迁移脚本存放在 `backend/migrations/`
- 第三方集成文档存放在 `docs/integrations/`

---

## Git 分支与发布工作流

### 核心思路

开发进度和发布进度完全独立，通过两类长期分支实现：

```
main            ────●────●────●────●────●────●──→  (开发主干，功能持续迭代)
                    │              │
release/1.x    ─────●──────────────●───────────→  (1.x 系列对外发布)
                  1.0.3          1.1.0
```

- `main`：日常开发，版本号可以写成 `2.0.0-dev`，永远不直接提交 App Store
- `release/1.x`：只包含已完成、可对外发布的功能；所有 App Store 提交从这里出
- 以后开 2.x 系列时，再创建 `release/2.x` 分支，两条线互不干扰

---

### 一次性初始化（只需做一次）

**第一步：确认当前在 main 分支**

```bash
cd /Users/jerryqin/Projects/runforge
git status
# 确认显示 On branch main，且没有未提交的改动
# 如果有改动，先 git add . && git commit -m "xxx"
```

**第二步：创建发布分支**

```bash
# 基于当前 main 的代码，创建 release/1.x 分支
git checkout -b release/1.x

# 推送到远端（如果有 GitHub/GitLab 远程仓库）
git push origin release/1.x

# 切回 main 继续开发
git checkout main
```

这样两条线就分开了。此后：
- 平时开发：永远在 `main`
- 要发版本：切到 `release/1.x`

---

### 日常开发流程（99%的时间）

在 `main` 上正常开发、提交，版本号不重要：

```bash
# 确认在 main
git checkout main

# 开发、改代码...
git add .
git commit -m "feat: 添加历史记录左滑删除功能"

# 继续开发，不需要管发布的事
```

---

### 发布新版本（完整步骤）

以从 `1.0.2` 发布 `1.0.3` 为例：

**第一步：切到发布分支，合并要发布的功能**

```bash
git checkout release/1.x

# 把 main 上要发布的内容合并过来
# --no-ff 保留合并记录，方便以后查看
git merge main --no-ff -m "merge: 准备发布 1.0.3"
```

> ⚠️ 如果 main 上有些功能还没做好、不想这次发，则不要整体 merge，
> 改用 `git cherry-pick <commit哈希>` 只挑选特定提交合并过来（见下方说明）。

**第二步：修改版本号**

打开 `mobile/app.json`，修改以下两个字段：

```json
{
  "expo": {
    "version": "1.0.3",
    "ios": {
      "buildNumber": "4"
    }
  }
}
```

- `version`：用户在 App Store 看到的版本号，每次发布递增
- `buildNumber`：App Store 内部构建号，每次提交必须比上次大（4 → 5 → 6...）

```bash
git add mobile/app.json
git commit -m "chore: 版本号更新至 1.0.3(4)"
```

**第三步：构建并提交 App Store**

```bash
cd mobile

# 生产构建（耗时约 15-30 分钟，在 EAS 云端执行）
eas build --profile production --platform ios

# 构建完成后提交 App Store（自动使用最新一次构建）
eas submit --platform ios --latest
```

**第四步：打 Git 标签存档**

```bash
# 给这个发布版本打标签，方便以后回溯
git tag v1.0.3
git push origin v1.0.3
git push origin release/1.x
```

**第五步：切回 main 继续开发**

```bash
git checkout main
# 把版本号改回开发中的占位版本（可选，让 main 和 release 有明显区别）
# 例如把 app.json 的 version 改为 "1.1.0-dev"
```

---

### 只挑选部分提交发布（cherry-pick）

当 main 上有些功能做了一半不想发，只想发其中几个提交时：

```bash
# 先看 main 上最近的提交历史，找到想发布的提交哈希
git log main --oneline
# 输出示例：
# a3f8c12 feat: 左滑删除历史记录
# b1d2e45 feat: OCR 支持 Garmin 截图（未完成）
# c9f0a23 fix: 修复心率显示为 0 的 bug

# 切换到发布分支
git checkout release/1.x

# 只挑选已完成的两个提交（不包含未完成的 Garmin OCR）
git cherry-pick a3f8c12
git cherry-pick c9f0a23

# 然后继续修改版本号、构建、提交（同上）
```

---

### 热修复线上 bug（bugfix 流程）

当已发布版本有紧急 bug 需要修复时：

```bash
# 切到发布分支，直接修复
git checkout release/1.x

# 修改 bug...
git add .
git commit -m "fix: 修复 HealthKit 同步崩溃问题"

# 修改版本号（patch 版本递增：1.0.3 → 1.0.4，buildNumber: 4 → 5）
# 修改 app.json...
git add mobile/app.json
git commit -m "chore: 版本号更新至 1.0.4(5)"

# 构建提交
eas build --profile production --platform ios
eas submit --platform ios --latest
git tag v1.0.4
git push origin v1.0.4

# 重要：把这个修复也同步回 main，避免以后又出现同样的 bug
git checkout main
git cherry-pick <刚才修复的commit哈希>
git push origin main
```

---

### 版本号速查规则

| 情况 | 递增哪一位 | 示例 |
|---|---|---|
| 修复 bug，无新功能 | 最后一位（patch） | `1.0.2` → `1.0.3` |
| 新增功能，向后兼容 | 中间一位（minor） | `1.0.3` → `1.1.0` |
| 架构重大变化（如加社交、云端） | 第一位（major） | `1.x.x` → `2.0.0` |
| buildNumber | 每次向 App Store 提交必须递增 | `3` → `4` → `5` |

`buildNumber` 跟版本号没有对应关系，只要比上次大就行。比如 `1.0.3` 的 buildNumber 可以是 `7`，只要比 `1.0.2` 那次提交时用的数字大即可。

---

### 常用命令速查

```bash
# 查看当前在哪个分支
git branch

# 查看所有分支（包括远端）
git branch -a

# 查看提交历史（简洁版）
git log --oneline --graph --all

# 查看所有已发布的标签
git tag

# 切换分支
git checkout main
git checkout release/1.x

# 查看两个分支的差异（main 比 release/1.x 多了哪些提交）
git log release/1.x..main --oneline
```


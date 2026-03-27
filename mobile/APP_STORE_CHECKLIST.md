# App Store 上架准备清单

## ✅ 已完成 (P0 - 必须项)

### 1. Info.plist 权限描述中文化
- ✅ **NSCameraUsageDescription**: "允许 RunForge 使用相机拍摄训练相关截图或图片。"
- ✅ **NSPhotoLibraryUsageDescription**: "允许 RunForge 访问你的照片，用于选择跑步截图或导入训练相关文件。"
- ✅ **NSHealthShareUsageDescription**: "允许 RunForge 读取您的健康和健身数据，包括跑步记录、心率等" (已在 app.json 配置)

### 2. 清理开发环境配置
- ✅ `.env` 文件已清理本地 IP 地址 (`http://172.20.10.10:8000`)
- ✅ 添加注释说明当前为纯本地模式

### 3. 隐私政策文档
- ✅ 创建 `PRIVACY_POLICY.md` (Markdown 版本)
- ✅ 创建 `privacy-policy.html` (HTML 版本，带完整样式)
- ⚠️ **待完成**: 需要托管到在线地址（见下方"待办事项"）

### 4. Console 日志清理
- ✅ 创建 `src/utils/Logger.ts` (生产环境自动禁用日志)
- ✅ 替换所有文件中的 console 调用:
  - `src/services/HealthService.ts` (13 处)
  - `src/services/useHealthData.ts` (8 处)
  - `src/services/ReminderService.ts` (1 处)
  - `app/_layout.tsx` (2 处)
- ✅ 生产构建时，所有 `Logger.log/warn/error` 不会输出

---

## 📋 待办事项 (P1 - 强烈建议)

### 1. 托管隐私政策并配置 URL ⚠️ 重要
**方式一：GitHub Pages (推荐)**
```bash
# 1. 在 GitHub repo 中启用 Pages (Settings > Pages)
# 2. 将 privacy-policy.html 上传到 repo 根目录或 docs/ 文件夹
# 3. 访问 URL 会是: https://yourusername.github.io/runforge/privacy-policy.html
```

**方式二：其他静态托管**
- Vercel/Netlify: 拖拽 `privacy-policy.html` 即可部署
- 个人域名: 上传到服务器

**配置到 App Store Connect:**
1. 登录 App Store Connect
2. 进入应用 > App 信息
3. 找到"隐私政策 URL"字段
4. 填入托管后的 URL (如 `https://yourusername.github.io/runforge/privacy-policy.html`)
5. 保存

> **注意**: 隐私政策 URL 在 App Store Connect 后台配置，不需要在 app.json 中设置。

### 2. 准备 App Store 元数据
**截图准备 (3-5 张):**
- 首页: 显示今日行动、身体状态、本周推进
- 训练详情: VDOT趋势、训练区间图表
- 训练计划: 马拉松训练计划示例
- 个人档案: 用户信息、训练参数
- HealthKit 集成: 数据同步示例

**应用描述 (中文):**
```
RunForge - 基于 VDOT 的科学跑步训练助手

🎯 核心功能
• VDOT 能力评估与趋势追踪
• ATL/CTL/TSB 疲劳管理系统
• 个性化训练强度推荐
• 马拉松训练计划生成

📊 数据同步
• 无缝集成 Apple Health
• OCR 识别跑步截图
• 完全本地存储，隐私优先

🏃‍♂️ 适合人群
• 马拉松训练者
• 追求科学训练的跑者
• 需要疲劳管理的运动员

💪 特色优势
• 基于 Jack Daniels VDOT 算法
• 考虑年龄、跑龄等多因素个性化
• 纯本地运行，无需联网
```

**关键词 (100字符以内):**
```
跑步,马拉松,训练计划,VDOT,心率分析,HealthKit,跑步记录,配速计算,疲劳管理,运动数据
```

**支持 URL:**
- 可以使用隐私政策 URL: `https://jerryqin.github.io/runforge/privacy-policy.html`
- 或创建专门的支持页面

### 3. 完整测试清单
**HealthKit 集成:**
- [ ] 首次授权流程 (权限请求弹窗是否显示中文)
- [ ] 同步跑步记录 (全量 & 增量)
- [ ] 心率数据读取

**核心功能:**
- [ ] 手动录入训练记录
- [ ] OCR 识别跑步截图
- [ ] VDOT 计算与趋势
- [ ] 训练计划生成 (马拉松、半马、5K)
- [ ] 今日行动推荐

**数据管理:**
- [ ] 导出备份 (JSON 格式)
- [ ] 导入备份 (覆盖确认)
- [ ] 删除训练记录

**边界情况:**
- [ ] 无数据时的新手引导
- [ ] 网络断开状态 (应用应完全正常运行)
- [ ] 首次安装流程

---

## 🚀 提交前最后检查

### EAS Build 配置
```bash
# 1. 确保 eas.json 配置正确
# 2. 运行生产构建
eas build --profile production --platform ios

# 3. 提交到 App Store
eas submit --platform ios --latest
```

### App Store Connect 检查清单
- [ ] 隐私政策 URL 已填写
- [ ] 截图已上传 (6.7" 和 5.5" 两种尺寸)
- [ ] 应用描述已填写 (中文)
- [ ] 关键词已配置
- [ ] 支持 URL 已填写
- [ ] 分类选择: **健康与健身**
- [ ] 年龄分级: **4+** (无敏感内容)
- [ ] 隐私问题回答完整:
  - "是否收集数据？" → **是** (健康数据、照片)
  - "数据是否用于追踪用户？" → **否**
  - "数据是否关联用户身份？" → **否**
- [ ] 导出合规信息: **否** (不使用加密)

---

## 📝 注意事项

### 版本号管理
- 当前版本: `1.0.1`
- 构建号: `3`
- 下次更新需递增构建号 (如 `4`, `5`, ...)

### OTA 更新能力
- ✅ 已配置 EAS Updates (production channel)
- ✅ RuntimeVersion: `1.0.0-native-ocr-v1`
- 🔄 纯 JS/TS 代码变更可通过 `npm run update:prod` 推送 OTA 更新
- ⚠️ 原生代码变更 (如 Info.plist) 需要重新构建并提交 App Store

### 审核注意事项
1. **HealthKit 权限**: Apple 会严格审查，确保用途描述清晰
2. **隐私政策**: 必须包含 HealthKit 数据使用说明
3. **测试账号**: 不需要 (无账号系统)
4. **演示视频**: 非必需，但可加速审核

---

## 🎉 完成状态

- ✅ P0 (必须项): **4/4 完成** (权限描述、.env清理、隐私政策、日志清理)
- ⏳ P1 (强烈建议): **0/3 完成** (隐私政策托管、截图准备、完整测试)

**下一步行动**: 
1. 托管 `privacy-policy.html` 到 GitHub Pages
2. 准备 App Store 截图和描述
3. 完整设备测试
4. 运行 `eas build --profile production --platform ios`

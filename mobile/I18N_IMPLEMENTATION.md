# RunForge 国际化功能实现

## 已完成功能

### 1. 国际化基础框架
- ✅ 安装了 `react-i18next`、`i18next`、`expo-localization` 依赖
- ✅ 创建了 `/src/i18n/` 目录结构
- ✅ 配置了自动语言检测（基于系统语言，默认中文）
- ✅ 实现了语言偏好持久化存储

### 2. 语言文件
- ✅ 创建了中文語言文件 `/src/i18n/locales/zh.json`
- ✅ 创建了英文語言文件 `/src/i18n/locales/en.json`
- ✅ 包含了应用的主要文案：首页、Tab导航、个人档案、通用按钮等

### 3. 核心组件国际化
- ✅ 主应用布局 (`app/_layout.tsx`) - 导入i18n配置
- ✅ Tab导航 (`app/(tabs)/_layout.tsx`) - Tab标题国际化
- ✅ 首页 (`app/(tabs)/index.tsx`) - 完整的首页文案国际化
  - 新用户引导界面
  - 快捷操作按钮
  - 各种卡片标题
  - 空状态提示
  - Alert消息
- ✅ 个人档案页 (`app/(tabs)/profile.tsx`) - 部分国际化
  - 页面标题和分组标题
  - 表单字段标签
  - 错误提示消息
  - 保存按钮状态

### 4. 语言切换功能
- ✅ 创建了 `LanguageSelector` 组件
- ✅ 在个人档案页添加了语言设置选项
- ✅ 支持中英文实时切换

### 5. 测试文件
- ✅ 创建了 `I18nTest.tsx` 测试组件用于验证国际化功能

## 待完成功能

### 1. 其他页面国际化
- ⏳ 跑步记录页 (`app/(tabs)/input.tsx`)
- ⏳ 历史记录页 (`app/(tabs)/history.tsx`)
- ⏳ 其他详情页面

### 2. 组件国际化
- ⏳ 各种Card组件 (RunSummaryCard, FitnessGauge等)
- ⏳ 分析引擎输出的文案
- ⏳ 训练处方文案

### 3. 增强功能
- ⏳ 根据语言调整日期格式
- ⏳ 数字格式本地化
- ⏳ RTL语言支持（如需要）

## 使用方法

### 在组件中使用国际化文本：

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <Text>{t('home.title')}</Text>
  );
}
```

### 切换语言：

```typescript
// 切换到英文
i18n.changeLanguage('en');

// 切换到中文
i18n.changeLanguage('zh');
```

### 参数化翻译：

```typescript
// 在语言文件中：
// "estimateMaxHrMessage": "基于年龄（{{age}}岁）估算最大心率为 {{hr}}"

// 在代码中：
t('profile.estimateMaxHrMessage', { age: 25, hr: 195 })
```

## 语言检测机制

1. 优先使用用户保存的语言设置
2. 如果没有保存设置，检测系统语言
3. 如果系统语言为中文相关（zh, zh-CN, zh-TW, zh-HK），使用中文
4. 其他情况默认使用英文

## 文件结构

```
src/
├── i18n/
│   ├── index.ts          # i18n配置
│   └── locales/
│       ├── zh.json       # 中文翻译
│       └── en.json       # 英文翻译
└── components/
    └── LanguageSelector.tsx  # 语言选择器组件
```

## 关键配置

- 默认语言：中文 (zh)
- 支持语言：中文 (zh)、英文 (en)
- 持久化存储键：`user_language`
- 语言检测：基于 `expo-localization`
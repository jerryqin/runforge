# RunForge 首页建议内容评价与改进方案

## 一、当前首页建议内容评价

### 1. 今日行动（训练处方）

#### ✅ 优点
- **科学基础扎实**：基于 TSB（训练压力平衡）、CTL（慢性训练负荷）、ATL（急性训练负荷）等运动科学指标
- **安全优先**：强制休息规则（连续2天高强度必须休息、TSB < -30 强制休息）
- **配速精准**：基于 VDOT 计算 5 种训练区间（E/M/T/I/R），给出明确配速范围
- **结构化周期**：按星期分配不同训练类型（周六长距离、周二间歇/节奏跑、周四马拉松配速）
- **动态调整**：根据当前恢复状态在节奏跑和间歇跑之间切换

#### ❌ 缺点
- **忽略个体差异**：
  - 未考虑跑者年龄（40岁和25岁恢复能力完全不同）
  - 未考虑跑龄（新手和老鸟耐疲劳能力差异巨大）
  - 未考虑个人恢复能力（同样TSB，有人还能练，有人已经累趴）

- **周训练模式固化**：
  - 强制周六长距离、周二质量课，不适合所有人的生活节奏
  - 不考虑跑者的个人偏好（有人喜欢周日长距离）

- **缺少渐进性**：
  - 对新手友好度不够（直接给8km节奏跑、12km长距离可能过激）
  - 对老鸟挑战性不足（没有根据跑龄提升训练量上限）

### 2. 身体状态评估

#### ✅ 优点
- **多维度综合**：结合近期训练强度（calcBodyStatus）和长期恢复负荷（TSB）
- **阈值清晰**：4档状态（READY/NORMAL/TIRED/REST）对应明确的恢复建议
- **长距离保护**：25km+ 长距离后强制进入 TIRED 状态

#### ❌ 缺点
- **恢复能力泛化**：
  - 同样 TSB = -20，25岁跑者可能只是轻微疲劳，45岁可能已经过度疲劳
  - 同样连续2天高强度，新手可能需要休息3天，老鸟2天即可
  
- **仅基于近期数据**：
  - 只看最近3-7天，不看跑者的整体训练基础
  - 体能好的跑者（CTL 高）应该有更高的疲劳承受能力

### 3. 本周推进跟踪

#### ✅ 优点
- **目标可视化**：清晰展示周公里数完成度、质量课、长距离完成情况
- **留存导向**：每次跑步后明确反馈对周目标的贡献

#### ❌ 缺点
- **周目标固定**：
  - 不随季节、年龄、跑龄动态调整
  - 新手可能周目标30km都吃力，老鸟可能需要60-80km

---

## 二、核心问题分析

### 当前系统的本质缺陷：**"一刀切"算法假设所有跑者同质化**

```typescript
// 当前逻辑：同样 TSB = -20 → 所有人都是 TIRED
if (tsb < RECOVERY_LOAD_THRESHOLDS.tiredTsb) return BodyStatus.TIRED;

// 现实情况：
// - 25岁，跑龄5年，CTL=80 → TSB -20 可能还能轻松应对
// - 45岁，跑龄1年，CTL=30 → TSB -20 可能已经过度疲劳
```

### 应该引入的维度

1. **年龄（Age）**
   - 影响恢复速度：年龄每增加10岁，恢复时间约增加20-30%
   - 影响最大训练量：40+ 建议周跑量上限降低15-20%

2. **跑步年限（Running Years）**
   - 影响疲劳耐受：跑龄3年+ 可承受更高 ATL
   - 影响训练密度：新手需要更多休息日

3. **当前体能基础（CTL）**
   - 高CTL跑者（>60）可以承受更高的TSB负值
   - 低CTL跑者（<30）对负TSB更敏感

---

## 三、改进方案设计

### 核心思路：**多因素加权模型**

```
最终建议 = f(
  近期训练[高权重],
  TSB/CTL[高权重],
  年龄[低权重],
  跑龄[低权重],
  个人恢复能力[低权重]
)
```

### 3.1 数据模型扩展

#### 扩展 UserProfile
```typescript
export interface UserProfile {
  // 现有字段
  max_hr: number;
  resting_hr: number;
  hr_threshold: number;
  birth_year?: number;
  weekly_km: number;

  // 新增字段
  running_start_year?: number;        // 开始跑步年份（如 2020）
  recovery_rate?: number;              // 恢复能力系数 [0.8 - 1.2]
                                       // 1.0 = 标准，1.2 = 快恢复体质
  preferred_rest_days?: number[];      // 偏好休息日 [0-6]，0=周日
  max_single_distance?: number;        // 单次最大距离（可选保护）
  training_phase?: 'base' | 'build' | 'peak' | 'recovery';  // 训练周期
}
```

### 3.2 多因素恢复阈值调整

#### 年龄修正系数
```typescript
function calcAgeModifier(age: number): number {
  if (age < 30) return 1.0;      // 基准
  if (age < 40) return 0.95;     // 30-39岁，恢复慢5%
  if (age < 50) return 0.85;     // 40-49岁，恢复慢15%
  return 0.75;                    // 50+，恢复慢25%
}
```

#### 跑龄修正系数
```typescript
function calcRunningYearsModifier(years: number): number {
  if (years < 1) return 0.85;    // 新手，疲劳耐受低
  if (years < 3) return 0.95;    // 进阶者
  if (years < 5) return 1.0;     // 基准
  return 1.1;                     // 5年+老鸟，疲劳耐受高10%
}
```

#### 体能修正系数（CTL）
```typescript
function calcCTLModifier(ctl: number): number {
  if (ctl < 30) return 0.9;      // 低体能，对负TSB敏感
  if (ctl < 50) return 1.0;      // 基准
  if (ctl < 70) return 1.1;      // 高体能，疲劳耐受好
  return 1.15;                    // 超高体能
}
```

### 3.3 动态阈值计算

```typescript
export function calcDynamicThresholds(profile: UserProfile, metrics: FitnessMetrics) {
  const age = new Date().getFullYear() - (profile.birth_year ?? 1990);
  const runningYears = new Date().getFullYear() - (profile.running_start_year ?? new Date().getFullYear() - 1);
  
  const ageMod = calcAgeModifier(age);
  const yearsMod = calcRunningYearsModifier(runningYears);
  const ctlMod = calcCTLModifier(metrics.ctl);
  const recoveryMod = profile.recovery_rate ?? 1.0;

  // 综合修正系数
  const modifier = ageMod * yearsMod * ctlMod * recoveryMod;

  // 动态阈值（基础阈值 × 修正系数）
  return {
    peakReadyTsb: RECOVERY_LOAD_THRESHOLDS.peakReadyTsb * modifier,
    readyTsb: RECOVERY_LOAD_THRESHOLDS.readyTsb * modifier,
    tiredTsb: RECOVERY_LOAD_THRESHOLDS.tiredTsb * modifier,
    restTsb: RECOVERY_LOAD_THRESHOLDS.restTsb * modifier,
    recoveryRunTsb: RECOVERY_LOAD_THRESHOLDS.recoveryRunTsb * modifier,
  };
}
```

#### 效果示例

**场景1：25岁新手，跑龄0.5年，CTL=25**
```
ageMod = 1.0, yearsMod = 0.85, ctlMod = 0.9, recoveryMod = 1.0
modifier = 0.765

动态阈值：
- restTsb: -30 × 0.765 = -23（更严格，更早休息）
- tiredTsb: -10 × 0.765 = -7.6
```

**场景2：45岁老鸟，跑龄8年，CTL=75**
```
ageMod = 0.85, yearsMod = 1.1, ctlMod = 1.15, recoveryMod = 1.0
modifier = 1.075

动态阈值：
- restTsb: -30 × 1.075 = -32.2（更宽松，可承受更多疲劳）
- tiredTsb: -10 × 1.075 = -10.75
```

### 3.4 训练量动态调整

#### 周跑量建议
```typescript
function suggestWeeklyKm(profile: UserProfile, metrics: FitnessMetrics): number {
  const age = new Date().getFullYear() - (profile.birth_year ?? 1990);
  const runningYears = new Date().getFullYear() - (profile.running_start_year ?? new Date().getFullYear() - 1);

  // 基础周跑量（根据跑龄）
  let baseKm = 30;
  if (runningYears < 1) baseKm = 20;
  else if (runningYears < 3) baseKm = 35;
  else if (runningYears >= 5) baseKm = 45;

  // 年龄折减
  if (age >= 40) baseKm *= 0.9;
  if (age >= 50) baseKm *= 0.85;

  // 体能加成
  if (metrics.ctl > 60) baseKm *= 1.1;

  return Math.round(baseKm);
}
```

---

## 四、实施建议

### 阶段1：数据收集（当前可做）
1. 在用户设置中增加"跑步开始年份"输入
2. 可选：增加"恢复能力自评"（快/正常/慢 → 1.2/1.0/0.8）

### 阶段2：算法渐进优化
1. 先实现年龄修正（最容易，影响最大）
2. 再加入跑龄修正
3. 最后加入CTL修正（需要一定历史数据积累）

### 阶段3：智能推荐
1. 根据历史数据学习用户的实际恢复能力
2. 动态调整 recovery_rate 系数

---

## 五、优先级建议

### 高优先级（立即可做）
1. ✅ **增加跑步开始年份字段**
2. ✅ **实现年龄修正逻辑**（ROI 最高）
3. ✅ **动态 TSB 阈值计算**

### 中优先级（本周可做）
1. 跑龄修正逻辑
2. CTL 修正逻辑
3. 周跑量动态建议

### 低优先级（迭代优化）
1. 偏好休息日设置
2. 训练周期管理
3. 自学习恢复能力

---

## 六、总结

当前系统的核心价值在于**科学的训练负荷监控和安全的强制休息机制**，但缺乏**个性化**。

通过引入年龄、跑龄、体能基础等维度，可以：
- 让新手更安全（更早触发休息）
- 让老鸟更挑战（承受更多训练量）
- 让中老年跑者更科学（更长恢复时间）

**关键原则**：近期训练和TSB始终是高权重主导因子，年龄/跑龄只是修正系数（0.7-1.2倍），不会颠覆核心逻辑。

/**
 * RecoveryPlanCard - 恢复计划卡片
 * 当 TSB < -30 时自动展示 1-2 周结构化恢复计划
 */
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../constants/theme';
import { RecoveryPlan, RecoveryWeekPlan } from '../engine/AnalysisEngine';

interface Props {
  plan: RecoveryPlan;
}

export function RecoveryPlanCard({ plan }: Props) {
  const [expandedWeek, setExpandedWeek] = useState<number>(1);
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>🔄</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('analysis.recoveryPlanTitle')}</Text>
          <Text style={styles.subtitle}>
            {plan.weeks.length === 1
              ? t('analysis.recoveryPlanSubtitle1')
              : t('analysis.recoveryPlanSubtitle2')}
          </Text>
        </View>
      </View>

      {/* 周选择 Tab */}
      {plan.weeks.length > 1 && (
        <View style={styles.weekTabs}>
          {plan.weeks.map(week => (
            <TouchableOpacity
              key={week.weekNumber}
              style={[
                styles.weekTab,
                expandedWeek === week.weekNumber && styles.weekTabActive,
              ]}
              onPress={() => setExpandedWeek(week.weekNumber)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.weekTabText,
                  expandedWeek === week.weekNumber && styles.weekTabTextActive,
                ]}
              >
                {t('analysis.recoveryWeekTab', { number: week.weekNumber })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 当前展示的周计划 */}
      {plan.weeks
        .filter(w => w.weekNumber === expandedWeek)
        .map(week => (
          <WeekPlanSection key={week.weekNumber} week={week} />
        ))}
    </View>
  );
}

function WeekPlanSection({ week }: { week: RecoveryWeekPlan }) {
  const { t } = useTranslation();
  return (
    <View style={styles.weekSection}>
      {/* 周标题 */}
      <View style={styles.weekHeader}>
        <Text style={styles.weekTitle}>
          {t('analysis.recoveryWeekTitle', { number: week.weekNumber, title: week.weekTitle })}
        </Text>
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>{week.weekSubtitle}</Text>
        </View>
      </View>

      {/* 表头 */}
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableCell, styles.cellDay, styles.tableHeaderText]}>{t('analysis.recoveryTableDay')}</Text>
        <Text style={[styles.tableCell, styles.cellTasks, styles.tableHeaderText]}>{t('analysis.recoveryTableTasks')}</Text>
        <Text style={[styles.tableCell, styles.cellObjective, styles.tableHeaderText]}>{t('analysis.recoveryTableObjective')}</Text>
      </View>

      {/* 每天的行 */}
      {week.days.map((day, idx) => (
        <View
          key={day.day}
          style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
        >
          <View style={[styles.tableCell, styles.cellDay]}>
            <Text style={styles.dayLabel}>{day.day}</Text>
          </View>
          <View style={[styles.tableCell, styles.cellTasks]}>
            {day.tasks.map((task, tIdx) => (
              <View key={tIdx} style={styles.taskRow}>
                <Text style={styles.taskCheckbox}>[ ]</Text>
                <Text style={styles.taskText}>{task}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.tableCell, styles.cellObjective]}>
            <Text style={styles.objectiveText}>{day.objective}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderLeftWidth: 3,
    borderLeftColor: Colors.statusRed,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  subtitle: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  // 周 Tab
  weekTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  weekTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.gray5,
    alignItems: 'center',
  },
  weekTabActive: {
    backgroundColor: Colors.statusRed + '18',
    borderWidth: 1,
    borderColor: Colors.statusRed,
  },
  weekTabText: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    fontWeight: FontWeight.medium,
  },
  weekTabTextActive: {
    color: Colors.statusRed,
    fontWeight: FontWeight.semibold,
  },
  // 周计划区
  weekSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  weekTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  weekBadge: {
    backgroundColor: Colors.statusOrange + '20',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  weekBadgeText: {
    fontSize: FontSize.small,
    color: Colors.statusOrange,
    fontWeight: FontWeight.medium,
  },
  // 表格
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  tableRowAlt: {
    backgroundColor: Colors.gray5 + 'AA',
  },
  tableHeader: {
    backgroundColor: Colors.gray5,
  },
  tableHeaderText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Colors.gray1,
    paddingVertical: 6,
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  cellDay: {
    width: 46,
    alignItems: 'center',
  },
  cellTasks: {
    flex: 3,
    paddingRight: 4,
  },
  cellObjective: {
    flex: 2,
  },
  dayLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: Colors.gray1,
  },
  taskRow: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 1,
  },
  taskCheckbox: {
    fontSize: FontSize.small,
    color: Colors.gray3,
  },
  taskText: {
    fontSize: FontSize.small,
    color: Colors.gray1,
    flex: 1,
    lineHeight: 16,
  },
  objectiveText: {
    fontSize: FontSize.small,
    color: Colors.gray2,
    lineHeight: 16,
  },
});

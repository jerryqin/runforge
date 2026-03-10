import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '../src/constants/theme';

const ITEMS = [
  {
    icon: '🏃',
    title: '每日训练提醒',
    desc: '在你常用训练时间前提醒查看今日行动。',
  },
  {
    icon: '🧘',
    title: '恢复与休息提醒',
    desc: '当系统判断疲劳偏高时，提醒优先恢复而不是继续加量。',
  },
  {
    icon: '📊',
    title: '周报提醒',
    desc: '每周固定提醒查看本周推进、质量课和长距离完成情况。',
  },
];

export default function ReminderSettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>提醒设置</Text>
          <Text style={styles.heroTitle}>先把入口预留好，下一阶段再接入真正的提醒能力</Text>
          <Text style={styles.heroBody}>
            这一页先用于承接提醒偏好。当前不会发送通知，但产品结构已经为“训练提醒、恢复提醒、周报提醒”预留好位置。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>规划中的提醒类型</Text>
          {ITEMS.map(item => (
            <View key={item.title} style={styles.itemCard}>
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>当前状态</Text>
          <Text style={styles.placeholderText}>提醒能力尚未接入系统通知。后续会在这里补充开关、提醒时间和提醒频率设置。</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)')} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>回首页继续看今日行动</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  heroCard: {
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroEyebrow: {
    fontSize: FontSize.caption,
    color: Colors.white + 'CC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  heroBody: {
    fontSize: FontSize.body,
    color: Colors.white,
    lineHeight: 22,
  },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  itemCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  itemIcon: { fontSize: 24 },
  itemContent: { flex: 1, gap: 2 },
  itemTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.black,
  },
  itemDesc: {
    fontSize: FontSize.caption,
    color: Colors.gray2,
    lineHeight: 18,
  },
  placeholderCard: {
    backgroundColor: Colors.primary + '12',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  placeholderTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  placeholderText: {
    fontSize: FontSize.body,
    color: Colors.gray1,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
});

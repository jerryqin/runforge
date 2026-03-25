import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Colors } from '../src/constants/theme';
import { configureReminderChannel, setupReminderNotificationHandler } from '../src/services/ReminderService';
import { Logger } from '../src/utils/Logger';

export default function RootLayout() {
  useEffect(() => {
    setupReminderNotificationHandler().catch((error) => {
      Logger.warn('[Reminder] failed to set notification handler', error);
    });

    configureReminderChannel().catch((error) => {
      Logger.warn('[Reminder] failed to configure channel', error);
    });
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.black,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.white },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="record/[id]"
          options={{ title: '跑步详情', headerBackTitle: '返回' }}
        />
        <Stack.Screen
          name="race-assistant"
          options={{ title: '比赛小助手', headerBackTitle: '返回' }}
        />
        <Stack.Screen
          name="training-plan"
          options={{ title: '周期化训练计划', headerBackTitle: '返回' }}
        />
        <Stack.Screen
          name="training-feedback"
          options={{ title: '训练反馈', headerBackTitle: '返回' }}
        />
        <Stack.Screen
          name="reminder-settings"
          options={{ title: '提醒设置', headerBackTitle: '返回' }}
        />
        <Stack.Screen
          name="vdot-progression"
          options={{ title: '跑力进阶路径', headerBackTitle: '返回' }}
        />
      </Stack>
    </>
  );
}

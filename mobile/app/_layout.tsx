import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
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
      </Stack>
    </>
  );
}

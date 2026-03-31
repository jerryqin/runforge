import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Colors } from '../src/constants/theme';
import { configureReminderChannel, setupReminderNotificationHandler } from '../src/services/ReminderService';
import { Logger } from '../src/utils/Logger';
import '../src/i18n';

export default function RootLayout() {
  const { t } = useTranslation();
  
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
          options={{ title: t('navigation.runDetails'), headerBackTitle: t('navigation.back') }}
        />
        <Stack.Screen
          name="race-assistant"
          options={{ title: t('navigation.raceAssistant'), headerBackTitle: t('navigation.back') }}
        />
        <Stack.Screen
          name="training-plan"
          options={{ title: t('navigation.trainingPlan'), headerBackTitle: t('navigation.back') }}
        />
        <Stack.Screen
          name="training-feedback"
          options={{ title: t('navigation.trainingFeedback'), headerBackTitle: t('navigation.back') }}
        />
        <Stack.Screen
          name="reminder-settings"
          options={{ title: t('navigation.reminderSettings'), headerBackTitle: t('navigation.back') }}
        />
        <Stack.Screen
          name="vdot-progression"
          options={{ title: t('navigation.vdotProgression'), headerBackTitle: t('navigation.back') }}
        />
      </Stack>
    </>
  );
}

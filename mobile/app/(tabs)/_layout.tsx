import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors, FontSize } from '../../src/constants/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: FontSize.caption, color: focused ? Colors.primary : Colors.gray3 }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray3,
        tabBarStyle: {
          borderTopColor: Colors.separator,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: { backgroundColor: Colors.white },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="input"
        options={{
          title: '录入',
          tabBarIcon: ({ focused }) => <TabIcon label="➕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '历史',
          tabBarIcon: ({ focused }) => <TabIcon label="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  focused,
}: {
  name: IoniconsName;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={name}
      size={26}
      color={focused ? Colors.primary : Colors.gray3}
    />
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray3,
        tabBarStyle: {
          height: 70,
          paddingBottom: 20,
          paddingTop: 4,
          borderTopColor: '#E5E5E5',
          borderTopWidth: 0.5,
          elevation: 0,
          shadowOpacity: 0,
          backgroundColor: Colors.white,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: -2,
        },
        headerStyle: { backgroundColor: Colors.white },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="input"
        options={{
          title: t('tabs.input'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'add-circle' : 'add-circle-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'list' : 'list-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import RecommendationsScreen from './src/screens/RecommendationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>
        {icon}
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#16213e',
            borderTopColor: '#2a2a4a',
            borderTopWidth: 1,
            height: 85,
            paddingBottom: 25,
            paddingTop: 10,
          },
          tabBarActiveTintColor: '#ff6b35',
          tabBarInactiveTintColor: '#888',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="홈"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="통계"
          component={StatisticsScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="추천"
          component={RecommendationsScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="🎯" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="설정"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: {
    fontSize: 24,
    opacity: 0.5,
  },
  tabIconTextActive: {
    opacity: 1,
  },
});

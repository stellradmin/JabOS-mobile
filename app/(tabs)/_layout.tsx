import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens, enableFreeze } from 'react-native-screens';
import { useMessaging } from '../../src/contexts/MessagingContext';
import ModernNavBar from '../../components/dashboard/ModernNavBar';
import { TabTransitionProvider } from '../../src/contexts/TabTransitionContext';
import { COLORS } from '../../constants/theme';

// Import tab screen components
import Dashboard from './dashboard';
import Messenger from './messenger';
import Profile from './profile';
import Settings from './settings';

const Tab = createBottomTabNavigator();

// Ensure screens do not freeze or detach on blur (prevents white flashes)
enableScreens(true);
enableFreeze(false);

export default function TabLayout() {
  const { unreadCounts } = useMessaging();
  
  // Calculate total unread messages
  const totalUnreadMessages = (Object.values(unreadCounts) as number[]).reduce((total: number, count: number) => total + count, 0);

  return (
    <TabTransitionProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          lazy: false,
        }}
        tabBar={(props) => (
          <ModernNavBar 
            {...props}
            unreadMessages={totalUnreadMessages}
          />
        )}
      >
        <Tab.Screen 
          name="dashboard" 
          component={Dashboard}
          options={{
            title: 'Home'
          }}
        />
        <Tab.Screen 
          name="messenger" 
          component={Messenger}
          options={{
            title: 'Messages'
          }}
        />
        <Tab.Screen 
          name="profile" 
          component={Profile}
          options={{
            title: 'Profile'
          }}
        />
        <Tab.Screen 
          name="settings" 
          component={Settings}
          options={{
            title: 'Settings'
          }}
        />
      </Tab.Navigator>
    </TabTransitionProvider>
  );
}

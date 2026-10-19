// Main = Drawer من اليمين (عرض 262) — يحتوي التبويبات + الشاشات الإضافية
import React from 'react';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import DrawerContent from '../components/DrawerContent';
import { useTheme, type ThemeColors } from '../theme';
import type { DrawerParamList } from './types';
import TabNavigator from './TabNavigator';
import CoursesTab from '../screens/tabs/CoursesTab';
import ChallengeTab from '../screens/tabs/ChallengeTab';
import FlashcardsTab from '../screens/tabs/FlashcardsTab';
import GuideTab from '../screens/tabs/GuideTab';
import SubjectDetailScreen from '../screens/bank/SubjectDetailScreen';
import SubjectTopicsScreen from '../screens/bank/SubjectTopicsScreen';
import QuestionScreen from '../screens/bank/QuestionScreen';
import BankQuestionScreen from '../screens/bank/BankQuestionScreen';
import ActivationScreen from '../screens/activation/ActivationScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import FlashcardsViewerScreen from '../screens/flashcards/FlashcardsViewer';
import ProfileScreen from '../screens/drawer/ProfileScreen';
import PrivacyScreen from '../screens/drawer/PrivacyScreen';
import ContactScreen from '../screens/drawer/ContactScreen';
import SocialLinksScreen from '../screens/drawer/SocialLinksScreen';
import SearchScreen from '../screens/drawer/SearchScreen';
import FavoritesScreen from '../screens/drawer/FavoritesScreen';
import NotesScreen from '../screens/drawer/NotesScreen';
import BadgesScreen from '../screens/gamification/BadgesScreen';
import MockExamScreen from '../screens/bank/MockExamScreen';
import PomodoroScreen from '../screens/focus/PomodoroScreen';
import WeakPointsScreen from '../screens/progress/WeakPointsScreen';

const Drawer = createDrawerNavigator<DrawerParamList>();

function renderDrawerContent(props: DrawerContentComponentProps) {
  return <DrawerContent {...props} />;
}

export default function DrawerNavigator() {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      initialRouteName="Tabs"
      drawerContent={renderDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerStyle: { width: 288, backgroundColor: colors.bg },
        drawerType: 'front',
        overlayColor: colors.scrim,
        swipeEdgeWidth: 40,
      }}>
      <Drawer.Screen name="Tabs" component={TabNavigator} />
      {/* شاشات الدرج: الكورسات/التحدي اليومي/البطاقات/دليل الدراسة (نُقلت من الشريط السفلي) */}
      <Drawer.Screen name="CoursesTab" component={CoursesTab} />
      <Drawer.Screen name="ChallengeTab" component={ChallengeTab} />
      <Drawer.Screen name="FlashcardsTab" component={FlashcardsTab} />
      <Drawer.Screen name="GuideTab" component={GuideTab} />
      <Drawer.Screen name="SubjectDetail" component={SubjectDetailScreen} />
      <Drawer.Screen name="SubjectTopics" component={SubjectTopicsScreen} />
      <Drawer.Screen name="Question" component={QuestionScreen} />
      <Drawer.Screen name="BankQuestion" component={BankQuestionScreen} />
      <Drawer.Screen name="Activation" component={ActivationScreen} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} />
      <Drawer.Screen name="FlashcardsViewer" component={FlashcardsViewerScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="Privacy" component={PrivacyScreen} />
      <Drawer.Screen name="Contact" component={ContactScreen} />
      <Drawer.Screen name="SocialLinks" component={SocialLinksScreen} />
      <Drawer.Screen name="Search" component={SearchScreen} />
      <Drawer.Screen name="Favorites" component={FavoritesScreen} />
      <Drawer.Screen name="Notes" component={NotesScreen} />
      <Drawer.Screen name="Badges" component={BadgesScreen} />
      <Drawer.Screen name="MockExam" component={MockExamScreen} />
      <Drawer.Screen name="Pomodoro" component={PomodoroScreen} />
      <Drawer.Screen name="WeakPoints" component={WeakPointsScreen} />
    </Drawer.Navigator>
  );
}

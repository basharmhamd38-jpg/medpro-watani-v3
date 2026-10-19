// تبويب «الكورسات» — ستاك داخلي مستقل لا يمس باقي الأقسام
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppHeader from '../../components/AppHeader';
import { useTheme, type ThemeColors } from '../../theme';
import CoursesListScreen from '../courses/CoursesListScreen';
import CourseDetailScreen from '../courses/CourseDetailScreen';
import UnitDetailScreen from '../courses/UnitDetailScreen';
import CourseQuestionScreen from '../courses/CourseQuestionScreen';
import CourseTestScreen from '../courses/CourseTestScreen';
import CourseProgressScreen from '../courses/CourseProgressScreen';

export type CoursesStackParamList = {
  CoursesList: undefined;
  CourseDetail: { courseId: string; title: string };
  UnitDetail: { courseId: string; unitId: string; title: string };
  CourseQuestion: { courseId: string; unitId: string; index: number; title: string };
  CourseTest: { courseId: string; unitId: string; title: string };
  CourseProgress: { courseId: string; title: string };
};

export type CoursesStackNav = NativeStackNavigationProp<CoursesStackParamList>;

export type CoursesStackRoute<T extends keyof CoursesStackParamList> = {
  params: CoursesStackParamList[T];
};

const Stack = createNativeStackNavigator<CoursesStackParamList>();

function CoursesListWithHeader({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <CoursesListScreen navigation={navigation} />
    </SafeAreaView>
  );
}

export default function CoursesTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_left' }}>
      <Stack.Screen name="CoursesList" component={CoursesListWithHeader} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <Stack.Screen name="UnitDetail" component={UnitDetailScreen} />
      <Stack.Screen name="CourseQuestion" component={CourseQuestionScreen} />
      <Stack.Screen name="CourseTest" component={CourseTestScreen} />
      <Stack.Screen name="CourseProgress" component={CourseProgressScreen} />
    </Stack.Navigator>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
});

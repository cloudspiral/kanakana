import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

interface AppScreenProps extends PropsWithChildren {
  scroll?: boolean;
  bottomNav?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
}

export function AppScreen({
  children,
  scroll = true,
  bottomNav,
  contentStyle,
  keyboardAvoiding = false,
}: AppScreenProps) {
  const content = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flexContent, contentStyle]}>
      {children}
    </View>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {body}
        {bottomNav}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  flexContent: {
    flex: 1,
  },
});

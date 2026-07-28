import { Platform } from 'react-native';

export const Colors = {
  ink: '#161C2C',
  inkMuted: '#566079',
  blue: '#3C5BDB',
  blueDark: '#2F47B8',
  pink: '#E91E8C',
  paleBlue: '#EEF3FF',
  palePink: '#FFF0F8',
  white: '#FFFFFF',
  canvas: '#F7F9FE',
  border: '#DEE4F2',
  green: '#18785D',
  greenPale: '#E7F7F1',
  amber: '#96620A',
  amberPale: '#FFF5DB',
  red: '#B33A56',
  redPale: '#FFF0F3',
};

export const Fonts = {
  heading: 'Poppins_700Bold',
  headingSemi: 'Poppins_600SemiBold',
  body: 'Poppins_400Regular',
  bodyMedium: 'Poppins_500Medium',
  japanese: Platform.select({
    ios: 'Hiragino Sans',
    android: 'sans-serif',
    web: '"Hiragino Sans", "Yu Gothic", sans-serif',
    default: 'System',
  }),
};

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};

export const Shadow = Platform.select({
  web: {
    boxShadow: '0 14px 40px rgba(33, 44, 86, 0.10)',
  },
  default: {
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
});

export const MaxContentWidth = 620;

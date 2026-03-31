import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../constants/theme';

interface LanguageSelectorProps {
  style?: any;
}

export function LanguageSelector({ style }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = () => {
    Alert.alert(
      t('profile.selectLanguage'),
      '',
      [
        {
          text: t('languages.zh'),
          onPress: () => i18n.changeLanguage('zh'),
        },
        {
          text: t('languages.en'),
          onPress: () => i18n.changeLanguage('en'),
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ]
    );
  };

  const currentLanguage = i18n.language === 'zh' ? t('languages.zh') : t('languages.en');

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.selector}
        onPress={handleLanguageChange}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          <View>
            <Text style={styles.label}>{t('common.language')}</Text>
            <Text style={styles.value}>{currentLanguage}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
  },
  selector: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    marginBottom: 2,
  },
  value: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  arrow: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
});
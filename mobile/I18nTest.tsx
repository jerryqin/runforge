import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import '../src/i18n';

export default function I18nTest() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLanguage = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLanguage);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('app.name')}</Text>
      <Text style={styles.text}>{t('home.title')}</Text>
      <Text style={styles.text}>{t('home.newUserTitle')}</Text>
      <Text style={styles.text}>{t('home.todayAction')}</Text>
      <Text style={styles.text}>{t('profile.title')}</Text>
      <Text style={styles.text}>{t('profile.maxHeartRate')}</Text>
      <Text style={styles.current}>当前语言: {t('languages.' + i18n.language)}</Text>
      
      <TouchableOpacity style={styles.button} onPress={toggleLanguage}>
        <Text style={styles.buttonText}>
          切换到 {i18n.language === 'zh' ? 'English' : '中文'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    marginVertical: 5,
  },
  current: {
    fontSize: 14,
    marginVertical: 10,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
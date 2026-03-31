import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import zh from './locales/zh.json';
import en from './locales/en.json';

const LANGUAGE_DETECTOR = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      // 优先检查用户保存的语言设置
      const savedLanguage = await AsyncStorage.getItem('user_language');
      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }
      
      // 如果没有保存的设置，使用系统语言
      const systemLanguage = Localization.locale;
      const language = systemLanguage.split('-')[0]; // 只取语言代码，忽略地区
      
      // 如果系统语言是中文，使用中文，否则默认英文
      callback(['zh', 'zh-CN', 'zh-TW', 'zh-HK'].includes(systemLanguage) || language === 'zh' ? 'zh' : 'en');
    } catch (error) {
      console.log('Error detecting language:', error);
      callback('zh'); // 默认中文
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem('user_language', language);
    } catch (error) {
      console.log('Failed to save language setting:', error);
    }
  },
};

const resources = {
  zh: {
    translation: zh,
  },
  en: {
    translation: en,
  },
};

i18n
  .use(LANGUAGE_DETECTOR)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
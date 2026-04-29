import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import zh from './locales/zh.json';
import en from './locales/en.json';

const LANGUAGE_DETECTOR = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      // 每次启动直接读系统语言，不使用缓存，确保跟随手机语言设置
      const locales = Localization.getLocales();
      const systemLocale = locales?.[0]?.languageCode ?? Localization.locale.split('-')[0];
      callback(systemLocale === 'zh' ? 'zh' : 'en');
    } catch (error) {
      console.log('Error detecting language:', error);
      callback('en');
    }
  },
  init: () => {},
  // 不缓存语言，保持跟随系统
  cacheUserLanguage: () => {},
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
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
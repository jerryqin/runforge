/**
 * Logger utility - 生产环境下禁用日志输出
 * 替换所有 console.log/warn/error 为 Logger.log/warn/error
 */

const IS_DEV = __DEV__;

export const Logger = {
  log: (...args: any[]) => {
    if (IS_DEV) {
      console.log(...args);
    }
  },

  warn: (...args: any[]) => {
    if (IS_DEV) {
      console.warn(...args);
    }
  },

  error: (...args: any[]) => {
    if (IS_DEV) {
      console.error(...args);
    }
  },

  debug: (...args: any[]) => {
    if (IS_DEV) {
      console.debug(...args);
    }
  },
};

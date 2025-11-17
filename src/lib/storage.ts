// localStorage utilities with consistent key prefixes
const STORAGE_PREFIX = 'brandnut_ceo_coach_';

export const storage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.error('localStorage getItem error:', error);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch (error) {
      console.error('localStorage setItem error:', error);
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.error('localStorage removeItem error:', error);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('localStorage clear error:', error);
    }
  }
};

export const storageKeys = {
  AUTH_TOKENS: 'auth_tokens',
  TUTORIAL_SHOWN: 'tutorial-shown',
} as const;
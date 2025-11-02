/**
 * Settings Context
 * 
 * Manages user preferences and settings across the application
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";
import { secureStorage } from '../utils/secure-storage';

// Types for settings
export interface UserSettings {
  distance: number;
  minAge: number;
  maxAge: number;
  showHeight: boolean;
  searchFilter: number;
  // Whether the user wants to temporarily pause account visibility
  pauseAccount: boolean;
  notifications: {
    matches: boolean;
    messages: boolean;
    marketing: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    allowPhotoAccess: boolean;
    showReadReceipts: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
}

export interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean;
}

// Default settings
const defaultSettings: UserSettings = {
  distance: 50, // miles
  minAge: 18,
  maxAge: 35,
  showHeight: true,
  searchFilter: 1, // 0: strict, 1: moderate, 2: open
  pauseAccount: false,
  notifications: {
    matches: true,
    messages: true,
    marketing: false,
  },
  privacy: {
    showOnlineStatus: true,
    allowPhotoAccess: true,
    showReadReceipts: true,
  },
  preferences: {
    theme: 'light',
    language: 'en',
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = '@stellr_user_settings';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from AsyncStorage on initialization
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const storedSettings = await secureStorage.getSecureItem(SETTINGS_STORAGE_KEY);
      
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        // Merge with defaults to ensure all properties exist
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      logError('Error loading settings:', "Error", error);
      // Keep default settings if loading fails
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      
      // Save to AsyncStorage
      await secureStorage.storeSecureItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      logError('Error saving settings:', "Error", error);
      throw error;
    }
  };

  const resetSettings = async () => {
    try {
      setSettings(defaultSettings);
      await secureStorage.storeSecureItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
    } catch (error) {
      logError('Error resetting settings:', "Error", error);
      throw error;
    }
  };

  const value: SettingsContextType = {
    settings,
    updateSettings,
    resetSettings,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;

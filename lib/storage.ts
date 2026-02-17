import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  REMEMBER_ME: '@agrihydra:rememberMe',
  SAVED_EMAIL: '@agrihydra:savedEmail',
  SAVED_PASSWORD: '@agrihydra:savedPassword',
  FIRST_LAUNCH: '@agrihydra:firstLaunch',
  LOGGED_IN_EMAIL: '@agrihydra:loggedInEmail',
} as const;

export interface SavedCredentials {
  email: string;
  password: string;
}

/**
 * Check if this is the first app launch
 */
export async function isFirstLaunch(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
    return value === null;
  } catch (error) {
    console.error('Error checking first launch:', error);
    return true; // Default to true if error occurs
  }
}

/**
 * Mark that the app has been launched (not first time anymore)
 */
export async function setFirstLaunchComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'false');
  } catch (error) {
    console.error('Error setting first launch:', error);
    throw error;
  }
}

/**
 * Check if Remember Me is enabled
 */
export async function isRememberMeEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
    return value === 'true';
  } catch (error) {
    console.error('Error checking remember me:', error);
    return false;
  }
}

/**
 * Get saved credentials if Remember Me is enabled
 */
export async function getSavedCredentials(): Promise<SavedCredentials | null> {
  try {
    const rememberMe = await isRememberMeEnabled();
    if (!rememberMe) {
      return null;
    }

    const email = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_EMAIL);
    const password = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PASSWORD);

    if (email && password) {
      return { email, password };
    }
    return null;
  } catch (error) {
    console.error('Error getting saved credentials:', error);
    return null;
  }
}

/**
 * Save credentials when Remember Me is checked
 */
export async function saveCredentials(email: string, password: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_EMAIL, email);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PASSWORD, password);
  } catch (error) {
    console.error('Error saving credentials:', error);
    throw error;
  }
}

/**
 * Clear saved credentials when Remember Me is unchecked or on logout
 */
export async function clearSavedCredentials(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'false');
    await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_EMAIL);
    await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_PASSWORD);
  } catch (error) {
    console.error('Error clearing saved credentials:', error);
    throw error;
  }
}

/**
 * Save the currently logged in user's email
 */
export async function saveLoggedInEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LOGGED_IN_EMAIL, email);
  } catch (error) {
    console.error('Error saving logged in email:', error);
    throw error;
  }
}

/**
 * Get the last logged in user's email
 */
export async function getLoggedInEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.LOGGED_IN_EMAIL);
  } catch (error) {
    console.error('Error getting logged in email:', error);
    return null;
  }
}

/**
 * Clear all storage (for logout)
 */
export async function clearAllStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.REMEMBER_ME,
      STORAGE_KEYS.SAVED_EMAIL,
      STORAGE_KEYS.SAVED_PASSWORD,
      STORAGE_KEYS.LOGGED_IN_EMAIL,
    ]);
  } catch (error) {
    console.error('Error clearing all storage:', error);
    throw error;
  }
}


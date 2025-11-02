/**
 * CRITICAL SECURITY MIGRATION UTILITY
 * 
 * Purpose: Migrate sensitive data from AsyncStorage to SecureStore
 * Security Level: PRODUCTION-CRITICAL
 * 
 * This utility safely migrates sensitive data that was previously stored
 * in AsyncStorage to the secure, encrypted SecureStore implementation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secure-storage';
import { logger } from './logger';

interface MigrationResult {
  migrated: number;
  failed: number;
  errors: string[];
  skipped: string[];
}

class AsyncStorageMigrationService {
  // Sensitive data patterns that need migration
  private readonly SENSITIVE_KEY_PATTERNS = [
    /^sec_/, // Secure data prefix
    /auth/, // Authentication data
    /token/, // Tokens
    /session/, // Session data
    /encryption/, // Encryption keys
    /key/, // Any keys
    /stellr_/, // App-specific data
    /user_/, // User data
    /settings/, // User settings
    /privacy/, // Privacy data
    /conv_key/, // Conversation keys
    /biometric/, // Biometric data
    /backup/, // Backup data
  ];

  // Non-sensitive data that can stay in AsyncStorage
  private readonly NON_SENSITIVE_PATTERNS = [
    /^logs_/, // Log data (non-sensitive)
    /^analytics_/, // Anonymous analytics
    /^cache_/, // Cache data
    /^temp_/, // Temporary data
    /^debug_/, // Debug information
  ];

  /**
   * Execute comprehensive migration of sensitive data
   */
  async executeMigration(): Promise<MigrationResult> {
    const result: MigrationResult = {
      migrated: 0,
      failed: 0,
      errors: [],
      skipped: []
    };

    try {
      logger.info('Starting AsyncStorage to SecureStore migration', undefined, {}, 'MIGRATION');

      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      for (const key of allKeys) {
        try {
          if (this.isSensitiveData(key)) {
            await this.migrateSensitiveItem(key);
            result.migrated++;
            logger.info('Migrated sensitive item', undefined, { key }, 'MIGRATION');
          } else if (this.isNonSensitiveData(key)) {
            result.skipped.push(key);
            logger.debug('Skipped non-sensitive item', undefined, { key }, 'MIGRATION');
          } else {
            // Unknown pattern - migrate to be safe
            await this.migrateSensitiveItem(key);
            result.migrated++;
            logger.warn('Migrated unknown pattern as sensitive', undefined, { key }, 'MIGRATION');
          }
        } catch (error) {
          result.failed++;
          const errorMsg = `Failed to migrate ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          logger.error('Migration failed for item', error instanceof Error ? error : undefined, { key }, 'MIGRATION');
        }
      }

      // Verify migration success
      await this.verifyMigration();

      logger.info('Migration completed', undefined, {
        migrated: result.migrated,
        failed: result.failed,
        skipped: result.skipped.length
      }, 'MIGRATION');

    } catch (error) {
      logger.error('Migration process failed', error instanceof Error ? error : undefined, {}, 'MIGRATION');
      result.errors.push('Migration process failed');
    }

    return result;
  }

  /**
   * Migrate a single sensitive item from AsyncStorage to SecureStore
   */
  private async migrateSensitiveItem(key: string): Promise<void> {
    // Get data from AsyncStorage
    const data = await AsyncStorage.getItem(key);
    
    if (data === null) {
      logger.debug('No data found for key', undefined, { key }, 'MIGRATION');
      return;
    }

    // Store in SecureStore
    await secureStorage.storeSecureItem(key, data);

    // Verify successful storage
    const verification = await secureStorage.getSecureItem(key);
    if (verification !== data) {
      throw new Error('Migration verification failed - data mismatch');
    }

    // Remove from AsyncStorage after successful migration
    await AsyncStorage.removeItem(key);

    logger.debug('Successfully migrated item', undefined, { 
      key, 
      dataLength: data.length 
    }, 'MIGRATION');
  }

  /**
   * Check if a key represents sensitive data
   */
  private isSensitiveData(key: string): boolean {
    return this.SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
  }

  /**
   * Check if a key represents non-sensitive data
   */
  private isNonSensitiveData(key: string): boolean {
    return this.NON_SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
  }

  /**
   * Verify migration was successful
   */
  private async verifyMigration(): Promise<void> {
    const remainingKeys = await AsyncStorage.getAllKeys();
    const sensitivekeysRemaining = remainingKeys.filter(key => this.isSensitiveData(key));

    if (sensitivekeysRemaining.length > 0) {
      logger.warn('Sensitive keys still in AsyncStorage after migration', undefined, {
        keys: sensitivekeysRemaining
      }, 'MIGRATION');
    } else {
      logger.info('Migration verification successful - no sensitive data in AsyncStorage', undefined, {}, 'MIGRATION');
    }
  }

  /**
   * Generate migration report for security audit
   */
  async generateMigrationReport(): Promise<{
    asyncStorageKeys: string[];
    sensitiveKeys: string[];
    nonSensitiveKeys: string[];
    unknownKeys: string[];
  }> {
    const allKeys = await AsyncStorage.getAllKeys();
    
    const report = {
      asyncStorageKeys: allKeys,
      sensitiveKeys: allKeys.filter(key => this.isSensitiveData(key)),
      nonSensitiveKeys: allKeys.filter(key => this.isNonSensitiveData(key)),
      unknownKeys: allKeys.filter(key => !this.isSensitiveData(key) && !this.isNonSensitiveData(key))
    };

    logger.info('Migration report generated', undefined, {
      totalKeys: report.asyncStorageKeys.length,
      sensitiveKeys: report.sensitiveKeys.length,
      nonSensitiveKeys: report.nonSensitiveKeys.length,
      unknownKeys: report.unknownKeys.length
    }, 'MIGRATION');

    return report;
  }

  /**
   * Emergency rollback function (use only if migration fails)
   */
  async emergencyRollback(keys: string[]): Promise<void> {
    logger.warn('Executing emergency migration rollback', undefined, { keys }, 'MIGRATION');

    for (const key of keys) {
      try {
        const data = await secureStorage.getSecureItem(key);
        if (data) {
          await AsyncStorage.setItem(key, data);
          await secureStorage.deleteSecureItem(key);
        }
      } catch (error) {
        logger.error('Rollback failed for key', error instanceof Error ? error : undefined, { key }, 'MIGRATION');
      }
    }
  }

  /**
   * Clean up any remaining sensitive data in AsyncStorage (emergency use)
   */
  async emergencyCleanup(): Promise<void> {
    logger.warn('Executing emergency AsyncStorage cleanup', undefined, {}, 'MIGRATION');

    const allKeys = await AsyncStorage.getAllKeys();
    const sensitiveKeys = allKeys.filter(key => this.isSensitiveData(key));

    for (const key of sensitiveKeys) {
      try {
        await AsyncStorage.removeItem(key);
        logger.info('Removed sensitive key from AsyncStorage', undefined, { key }, 'MIGRATION');
      } catch (error) {
        logger.error('Failed to remove sensitive key', error instanceof Error ? error : undefined, { key }, 'MIGRATION');
      }
    }
  }
}

export const asyncStorageMigration = new AsyncStorageMigrationService();
export type { MigrationResult };
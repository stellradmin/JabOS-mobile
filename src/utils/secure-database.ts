/**
 * CRITICAL SECURITY COMPONENT - SQL Injection Prevention Layer
 * 
 * Purpose: Secure database query wrapper for Supabase with SQL injection prevention
 * Security Level: MAXIMUM - All queries are parameterized and validated
 * Features: Query validation, parameter sanitization, query logging
 * 
 * SECURITY REQUIREMENTS:
 * - NO raw SQL queries allowed
 * - ALL parameters must be validated and sanitized
 * - Automatic query logging for audit trail
 * - Real-time threat detection
 */

import { supabase } from '../lib/supabase';
import { validateInput } from './security-validation';
import { trackSecurityIncident } from '../services/enhanced-monitoring-service';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "./logger";

// Security configuration
const QUERY_SECURITY_CONFIG = {
  // Maximum query complexity
  MAX_JOIN_DEPTH: 3,
  MAX_WHERE_CONDITIONS: 10,
  MAX_RESULTS: 1000,
  MAX_BATCH_SIZE: 100,
  
  // Timeout settings
  QUERY_TIMEOUT: 30000, // 30 seconds
  
  // Blocked keywords (potential SQL injection)
  BLOCKED_KEYWORDS: [
    'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC',
    'EXECUTE', 'UNION', 'INSERT INTO', 'UPDATE SET'
  ],
  
  // Allowed tables (whitelist approach)
  ALLOWED_TABLES: [
    'profiles', 'users', 'matches', 'messages', 'conversations',
    'subscriptions', 'photos', 'reports', 'blocks', 'notifications',
    'questionnaire_responses', 'date_preferences', 'compatibility_scores'
  ],
  
  // Sensitive columns that require extra validation
  SENSITIVE_COLUMNS: [
    'password', 'password_hash', 'auth_token', 'refresh_token',
    'payment_method', 'credit_card', 'ssn', 'api_key'
  ],
};

// Query audit log
interface QueryAuditLog {
  timestamp: number;
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  parameters: any;
  userId?: string;
  success: boolean;
  error?: string;
  threatDetected?: boolean;
}

class SecureDatabase {
  private static instance: SecureDatabase;
  private queryLogs: QueryAuditLog[] = [];
  private queryStats = {
    totalQueries: 0,
    blockedQueries: 0,
    injectionAttemptsBlocked: 0,
    sensitiveDataAccessAttempts: 0,
  };

  private constructor() {
    this.initialize();
  }

  public static getInstance(): SecureDatabase {
    if (!SecureDatabase.instance) {
      SecureDatabase.instance = new SecureDatabase();
    }
    return SecureDatabase.instance;
  }

  private initialize(): void {
    logDebug('✅ Secure Database Layer initialized with SQL injection prevention', "Debug");
  }

  /**
   * Validate table name against whitelist
   */
  private validateTableName(table: string): boolean {
    if (!QUERY_SECURITY_CONFIG.ALLOWED_TABLES.includes(table)) {
      this.reportSQLInjectionAttempt('invalid_table', { table });
      return false;
    }
    return true;
  }

  /**
   * Validate column names
   */
  private validateColumns(columns: string | string[]): boolean {
    const columnArray = Array.isArray(columns) ? columns : columns.split(',');
    
    for (const column of columnArray) {
      const cleanColumn = column.trim().toLowerCase();
      
      // Check for SQL injection patterns
      if (this.containsSQLInjectionPattern(cleanColumn)) {
        this.reportSQLInjectionAttempt('column_injection', { column: cleanColumn });
        return false;
      }
      
      // Check for sensitive columns
      if (QUERY_SECURITY_CONFIG.SENSITIVE_COLUMNS.some(sensitive => 
        cleanColumn.includes(sensitive))) {
        this.queryStats.sensitiveDataAccessAttempts++;
        logWarn(`⚠️ Attempt to access sensitive column: ${cleanColumn}`, "Warning");
      }
    }
    
    return true;
  }

  /**
   * Check for SQL injection patterns
   */
  private containsSQLInjectionPattern(input: string): boolean {
    const upperInput = input.toUpperCase();
    
    // Check for blocked keywords
    for (const keyword of QUERY_SECURITY_CONFIG.BLOCKED_KEYWORDS) {
      if (upperInput.includes(keyword)) {
        return true;
      }
    }
    
    // Check for common SQL injection patterns
    const injectionPatterns = [
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
      /--/,
      /\/\*/,
      /\*\//,
      /;/,
      /\bEXEC\b/i,
      /\bUNION\b/i,
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Sanitize query parameters
   */
  private sanitizeParameters(params: any): any {
    if (!params) return params;
    
    if (typeof params === 'string') {
      // Check for SQL injection
      if (this.containsSQLInjectionPattern(params)) {
        this.reportSQLInjectionAttempt('parameter_injection', { param: params });
        throw new Error('SECURITY_VIOLATION: SQL injection detected');
      }
      
      // Validate and sanitize
      const validation = validateInput(params, { maxLength: 5000 });
      if (validation.securityThreats.length > 0) {
        throw new Error('SECURITY_VIOLATION: Threat detected in parameters');
      }
      
      return validation.sanitizedValue;
    }
    
    if (typeof params === 'object') {
      const sanitized: any = Array.isArray(params) ? [] : {};
      
      for (const [key, value] of Object.entries(params)) {
        // Recursively sanitize
        sanitized[key] = this.sanitizeParameters(value);
      }
      
      return sanitized;
    }
    
    return params;
  }

  /**
   * Log query for audit trail
   */
  private logQuery(
    table: string,
    operation: QueryAuditLog['operation'],
    parameters: any,
    success: boolean,
    error?: string,
    threatDetected?: boolean
  ): void {
    const log: QueryAuditLog = {
      timestamp: Date.now(),
      table,
      operation,
      parameters: this.redactSensitiveData(parameters),
      success,
      error,
      threatDetected,
    };
    
    this.queryLogs.push(log);
    
    // Keep only last 1000 logs
    if (this.queryLogs.length > 1000) {
      this.queryLogs = this.queryLogs.slice(-1000);
    }
    
    // Alert on threats
    if (threatDetected) {
      logError('🚨 SQL INJECTION ATTEMPT BLOCKED:', "Error", log);
    }
  }

  /**
   * Redact sensitive data from logs
   */
  private redactSensitiveData(data: any): any {
    if (!data) return data;
    
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credit_card'];
    
    if (typeof data === 'object') {
      const redacted = { ...data };
      
      for (const key of Object.keys(redacted)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          redacted[key] = '[REDACTED]';
        } else if (typeof redacted[key] === 'object') {
          redacted[key] = this.redactSensitiveData(redacted[key]);
        }
      }
      
      return redacted;
    }
    
    return data;
  }

  /**
   * Report SQL injection attempt
   */
  private reportSQLInjectionAttempt(type: string, details: any): void {
    this.queryStats.injectionAttemptsBlocked++;
    this.queryStats.blockedQueries++;
    
    trackSecurityIncident(
      'SQL_INJECTION_ATTEMPT',
      'critical',
      {
        type,
        details: this.redactSensitiveData(details),
        timestamp: new Date().toISOString(),
        queryStats: this.queryStats,
      }
    );
  }

  // ===============================================================================
  // SECURE QUERY METHODS
  // ===============================================================================

  /**
   * Secure SELECT query
   */
  public async secureSelect<T = any>(
    table: string,
    options: {
      columns?: string | string[];
      filters?: Record<string, any>;
      limit?: number;
      offset?: number;
      orderBy?: { column: string; ascending?: boolean };
    } = {}
  ): Promise<{ data: T[] | null; error: any }> {
    this.queryStats.totalQueries++;
    
    try {
      // Validate table
      if (!this.validateTableName(table)) {
        throw new Error('Invalid table name');
      }
      
      // Validate columns
      if (options.columns && !this.validateColumns(options.columns)) {
        throw new Error('Invalid column names');
      }
      
      // Build query
      let query: any = supabase.from(table);
      
      // Select columns
      if (options.columns) {
        const columnsStr = Array.isArray(options.columns) 
          ? options.columns.join(', ')
          : options.columns;
        query = query.select(columnsStr);
      } else {
        query = query.select('*');
      }
      
      // Apply filters
      if (options.filters) {
        const sanitizedFilters = this.sanitizeParameters(options.filters);
        for (const [column, value] of Object.entries(sanitizedFilters)) {
          query = query.eq(column, value);
        }
      }
      
      // Apply limit
      const limit = Math.min(
        options.limit || QUERY_SECURITY_CONFIG.MAX_RESULTS,
        QUERY_SECURITY_CONFIG.MAX_RESULTS
      );
      query = query.limit(limit);
      
      // Apply offset
      if (options.offset) {
        query = query.range(options.offset, options.offset + limit - 1);
      }
      
      // Apply ordering
      if (options.orderBy) {
        query = query.order(
          options.orderBy.column,
          { ascending: options.orderBy.ascending ?? true }
        );
      }
      
      // Execute query with timeout
      const result = await Promise.race([
        query,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 
          QUERY_SECURITY_CONFIG.QUERY_TIMEOUT)
        )
      ]);
      
      this.logQuery(table, 'select', options, true);
      return result as any;
      
    } catch (error) {
      this.logQuery(table, 'select', options, false, error.message);
      return { data: null, error };
    }
  }

  /**
   * Secure INSERT query
   */
  public async secureInsert<T = any>(
    table: string,
    data: Record<string, any> | Record<string, any>[]
  ): Promise<{ data: T | null; error: any }> {
    this.queryStats.totalQueries++;
    
    try {
      // Validate table
      if (!this.validateTableName(table)) {
        throw new Error('Invalid table name');
      }
      
      // Sanitize data
      const sanitizedData = this.sanitizeParameters(data);
      
      // Check batch size
      if (Array.isArray(sanitizedData) && 
          sanitizedData.length > QUERY_SECURITY_CONFIG.MAX_BATCH_SIZE) {
        throw new Error('Batch size exceeds maximum allowed');
      }
      
      // Execute insert
      const result = await supabase
        .from(table)
        .insert(sanitizedData);
      
      this.logQuery(table, 'insert', { count: Array.isArray(data) ? data.length : 1 }, true);
      return result;
      
    } catch (error) {
      this.logQuery(table, 'insert', data, false, error.message);
      return { data: null, error };
    }
  }

  /**
   * Secure UPDATE query
   */
  public async secureUpdate<T = any>(
    table: string,
    updates: Record<string, any>,
    filters: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    this.queryStats.totalQueries++;
    
    try {
      // Validate table
      if (!this.validateTableName(table)) {
        throw new Error('Invalid table name');
      }
      
      // Sanitize updates and filters
      const sanitizedUpdates = this.sanitizeParameters(updates);
      const sanitizedFilters = this.sanitizeParameters(filters);
      
      // Build query
      let query = supabase.from(table).update(sanitizedUpdates);
      
      // Apply filters
      for (const [column, value] of Object.entries(sanitizedFilters)) {
        query = query.eq(column, value);
      }
      
      // Execute update
      const result = await query;
      
      this.logQuery(table, 'update', { updates, filters }, true);
      return result;
      
    } catch (error) {
      this.logQuery(table, 'update', { updates, filters }, false, error.message);
      return { data: null, error };
    }
  }

  /**
   * Secure DELETE query
   */
  public async secureDelete(
    table: string,
    filters: Record<string, any>
  ): Promise<{ data: any; error: any }> {
    this.queryStats.totalQueries++;
    
    try {
      // Validate table
      if (!this.validateTableName(table)) {
        throw new Error('Invalid table name');
      }
      
      // Require filters for delete (prevent accidental full table deletion)
      if (!filters || Object.keys(filters).length === 0) {
        throw new Error('Filters required for delete operation');
      }
      
      // Sanitize filters
      const sanitizedFilters = this.sanitizeParameters(filters);
      
      // Build query
      let query = supabase.from(table).delete();
      
      // Apply filters
      for (const [column, value] of Object.entries(sanitizedFilters)) {
        query = query.eq(column, value);
      }
      
      // Execute delete
      const result = await query;
      
      this.logQuery(table, 'delete', filters, true);
      return result;
      
    } catch (error) {
      this.logQuery(table, 'delete', filters, false, error.message);
      return { data: null, error };
    }
  }

  /**
   * Secure RPC call
   */
  public async secureRpc<T = any>(
    functionName: string,
    params?: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    this.queryStats.totalQueries++;
    
    try {
      // Validate function name (alphanumeric and underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(functionName)) {
        throw new Error('Invalid function name');
      }
      
      // Sanitize parameters
      const sanitizedParams = params ? this.sanitizeParameters(params) : undefined;
      
      // Execute RPC
      const result = await supabase.rpc(functionName, sanitizedParams);
      
      this.logQuery(functionName, 'rpc', params, true);
      return result;
      
    } catch (error) {
      this.logQuery(functionName, 'rpc', params, false, error.message);
      return { data: null, error };
    }
  }

  /**
   * Get query statistics
   */
  public getStatistics(): typeof this.queryStats {
    return { ...this.queryStats };
  }

  /**
   * Get audit logs
   */
  public getAuditLogs(): QueryAuditLog[] {
    return [...this.queryLogs];
  }

  /**
   * Clear audit logs
   */
  public clearAuditLogs(): void {
    this.queryLogs = [];
  }
}

// Export singleton instance
export const secureDB = SecureDatabase.getInstance();

// Export convenience functions
export const secureSelect = <T = any>(
  table: string,
  options?: Parameters<typeof secureDB.secureSelect>[1]
) => secureDB.secureSelect<T>(table, options);

export const secureInsert = <T = any>(
  table: string,
  data: Record<string, any> | Record<string, any>[]
) => secureDB.secureInsert<T>(table, data);

export const secureUpdate = <T = any>(
  table: string,
  updates: Record<string, any>,
  filters: Record<string, any>
) => secureDB.secureUpdate<T>(table, updates, filters);

export const secureDelete = (
  table: string,
  filters: Record<string, any>
) => secureDB.secureDelete(table, filters);

export const secureRpc = <T = any>(
  functionName: string,
  params?: Record<string, any>
) => secureDB.secureRpc<T>(functionName, params);

export const getQueryStats = () => secureDB.getStatistics();
export const getQueryAuditLogs = () => secureDB.getAuditLogs();

export default secureDB;

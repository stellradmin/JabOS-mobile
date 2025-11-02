import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { secureStorage } from '../utils/secure-storage';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';


// Types for legal compliance
export interface ConsentSettings {
  analytics: boolean;
  marketing: boolean;
  essential: boolean;
  location: boolean;
  advertising: boolean;
  updatedAt: string;
}

export interface GDPRRequest {
  id: string;
  userId: string;
  requestType: 'data_export' | 'data_deletion' | 'data_portability' | 'data_correction';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: string;
  completedAt?: string;
  data?: any;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface LegalComplianceContextType {
  // Consent Management
  consentSettings: ConsentSettings | null;
  updateConsent: (settings: Partial<ConsentSettings>) => Promise<void>;
  hasValidConsent: () => boolean;
  
  // GDPR Requests
  submitGDPRRequest: (type: GDPRRequest['requestType']) => Promise<string>;
  getGDPRRequests: () => Promise<GDPRRequest[]>;
  
  // Age Verification
  verifyAge: (birthDate: string) => Promise<{ isValid: boolean; age: number }>;
  
  // Data Export
  exportUserData: () => Promise<any>;
  
  // Right to Deletion
  requestDataDeletion: () => Promise<string>;
  
  // Audit Trail
  logUserAction: (action: string, details?: Record<string, any>) => Promise<void>;
  
  // Cookie Management
  cookieSettings: Record<string, boolean>;
  updateCookieSettings: (settings: Record<string, boolean>) => Promise<void>;
  
  // Loading states
  loading: boolean;
  error: string | null;
}

const LegalComplianceContext = createContext<LegalComplianceContextType | null>(null);

const STORAGE_KEYS = {
  CONSENT: '@stellr_user_consent',
  COOKIES: '@stellr_cookie_settings',
  AGE_VERIFIED: '@stellr_age_verified',
} as const;

export const LegalComplianceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [consentSettings, setConsentSettings] = useState<ConsentSettings | null>(null);
  const [cookieSettings, setCookieSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize consent settings from storage and database
  useEffect(() => {
    initializeConsent();
  }, []);

  const initializeConsent = async () => {
    try {
      setLoading(true);
      
      // Load from local storage first for immediate UI response
      const localConsent = await secureStorage.getSecureItem(STORAGE_KEYS.CONSENT);
      const localCookies = await secureStorage.getSecureItem(STORAGE_KEYS.COOKIES);
      
      if (localConsent) {
        setConsentSettings(JSON.parse(localConsent));
      }
      
      if (localCookies) {
        setCookieSettings(JSON.parse(localCookies));
      }

      // Sync with database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncConsentWithDatabase(user.id);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize consent';
      logger.error('Failed to initialize legal compliance', err instanceof Error ? err : undefined, {}, 'LEGAL_COMPLIANCE');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const syncConsentWithDatabase = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_consent')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error is ok
        throw error;
      }

      if (data) {
        const dbConsent: ConsentSettings = {
          analytics: data.analytics_consent,
          marketing: data.marketing_consent,
          essential: data.essential_consent,
          location: data.location_consent,
          advertising: data.advertising_consent,
          updatedAt: data.updated_at,
        };
        
        setConsentSettings(dbConsent);
        await secureStorage.storeSecureItem(STORAGE_KEYS.CONSENT, JSON.stringify(dbConsent));
      }
    } catch (err) {
      logger.error('Failed to sync consent with database', err instanceof Error ? err : undefined, { userId }, 'LEGAL_COMPLIANCE');
    }
  };

  const updateConsent = async (newSettings: Partial<ConsentSettings>) => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const updatedConsent: ConsentSettings = {
        ...consentSettings!,
        ...newSettings,
        updatedAt: new Date().toISOString(),
      };

      // Update database
      const { error } = await supabase
        .from('user_consent')
        .upsert({
          user_id: user.id,
          analytics_consent: updatedConsent.analytics,
          marketing_consent: updatedConsent.marketing,
          essential_consent: updatedConsent.essential,
          location_consent: updatedConsent.location,
          advertising_consent: updatedConsent.advertising,
          updated_at: updatedConsent.updatedAt,
        });

      if (error) throw error;

      // Update local state and storage
      setConsentSettings(updatedConsent);
      await secureStorage.storeSecureItem(STORAGE_KEYS.CONSENT, JSON.stringify(updatedConsent));

      // Log the consent update
      await logUserAction('consent_updated', { consentSettings: updatedConsent });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update consent';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const hasValidConsent = (): boolean => {
    if (!consentSettings) return false;
    
    // Check if consent is recent (within 13 months for GDPR compliance)
    const consentDate = new Date(consentSettings.updatedAt);
    const monthsOld = (Date.now() - consentDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    return monthsOld <= 13;
  };

  const submitGDPRRequest = async (type: GDPRRequest['requestType']): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('gdpr_requests')
        .insert({
          user_id: user.id,
          request_type: type,
          status: 'pending',
          requested_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      await logUserAction('gdpr_request_submitted', { requestType: type, requestId: data.id });
      
      return data.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit GDPR request';
      setError(errorMessage);
      throw err;
    }
  };

  const getGDPRRequests = async (): Promise<GDPRRequest[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('gdpr_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      return data.map(request => ({
        id: request.id,
        userId: request.user_id,
        requestType: request.request_type,
        status: request.status,
        requestedAt: request.requested_at,
        completedAt: request.completed_at,
        data: request.response_data,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch GDPR requests';
      setError(errorMessage);
      throw err;
    }
  };

  const verifyAge = async (birthDate: string): Promise<{ isValid: boolean; age: number }> => {
    try {
      const birthDateObj = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const monthDiff = today.getMonth() - birthDateObj.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }

      const isValid = age >= 18; // COPPA compliance requires 18+ for dating apps
      
      if (isValid) {
        await secureStorage.storeSecureItem(STORAGE_KEYS.AGE_VERIFIED, 'true');
        await logUserAction('age_verification_passed', { age });
      } else {
        await logUserAction('age_verification_failed', { age, birthDate });
      }

      return { isValid, age };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify age';
      setError(errorMessage);
      throw err;
    }
  };

  const exportUserData = async (): Promise<any> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Collect all user data from various tables
      const [profileData, matchesData, messagesData, preferencesData] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('matches').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
        supabase.from('messages').select('*').eq('sender_id', user.id),
        supabase.from('user_preferences').select('*').eq('user_id', user.id),
      ]);

      const exportData = {
        userId: user.id,
        email: user.email,
        profile: profileData.data,
        matches: matchesData.data,
        messages: messagesData.data,
        preferences: preferencesData.data,
        consent: consentSettings,
        exportedAt: new Date().toISOString(),
      };

      await logUserAction('data_export_completed', { dataSize: JSON.stringify(exportData).length });
      
      return exportData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export user data';
      setError(errorMessage);
      throw err;
    }
  };

  const requestDataDeletion = async (): Promise<string> => {
    const requestId = await submitGDPRRequest('data_deletion');
    await logUserAction('data_deletion_requested', { requestId });
    return requestId;
  };

  const logUserAction = async (action: string, details?: Record<string, any>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action,
          details: details || {},
          timestamp: new Date().toISOString(),
        });
    } catch (err) {
      // Don't throw for audit log failures, just log them
      logger.error('Failed to log user action', err instanceof Error ? err : undefined, { action, details }, 'LEGAL_COMPLIANCE');
    }
  };

  const updateCookieSettings = async (settings: Record<string, boolean>) => {
    try {
      setCookieSettings(settings);
      await secureStorage.storeSecureItem(STORAGE_KEYS.COOKIES, JSON.stringify(settings));
      await logUserAction('cookie_settings_updated', { settings });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update cookie settings';
      setError(errorMessage);
      throw err;
    }
  };

  const value: LegalComplianceContextType = {
    consentSettings,
    updateConsent,
    hasValidConsent,
    submitGDPRRequest,
    getGDPRRequests,
    verifyAge,
    exportUserData,
    requestDataDeletion,
    logUserAction,
    cookieSettings,
    updateCookieSettings,
    loading,
    error,
  };

  return (
    <LegalComplianceContext.Provider value={value}>
      {children}
    </LegalComplianceContext.Provider>
  );
};

export const useLegalCompliance = (): LegalComplianceContextType => {
  const context = useContext(LegalComplianceContext);
  if (!context) {
    throw new Error('useLegalCompliance must be used within a LegalComplianceProvider');
  }
  return context;
};

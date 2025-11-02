/**
 * Persona Identity Verification Service
 *
 * Full integration with Persona's React Native SDK for selfie + liveness detection.
 * This service handles the complete verification flow including:
 * - Inquiry initialization
 * - SDK flow management
 * - Result processing
 * - Database synchronization
 * - Error handling
 *
 * @see https://docs.withpersona.com/docs/react-native-sdk
 */

import { Inquiry, Environment } from 'react-native-persona';
import { supabase } from '../lib/supabase';
import { logError, logWarn, logInfo, logDebug } from '../utils/logger';

// Environment configuration
const PERSONA_TEMPLATE_ID = process.env.EXPO_PUBLIC_PERSONA_TEMPLATE_ID || '';
const PERSONA_ENVIRONMENT = (process.env.EXPO_PUBLIC_PERSONA_ENVIRONMENT || 'sandbox') as Environment;
const PERSONA_API_KEY = process.env.EXPO_PUBLIC_PERSONA_API_KEY || '';
const PERSONA_ENABLED = process.env.EXPO_PUBLIC_PERSONA_VERIFICATION_ENABLED === 'true';

// Verification status types
export type PersonaVerificationStatus =
  | 'not_started'
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'declined'
  | 'failed'
  | 'requires_retry';

// Verification result interface
export interface PersonaVerificationResult {
  success: boolean;
  inquiryId?: string;
  status: PersonaVerificationStatus;
  sessionToken?: string;
  error?: string;
  errorCode?: string;
  requiresRetry?: boolean;
  livenessScore?: number;
  verifiedAt?: string;
}

// Inquiry configuration
export interface PersonaInquiryConfig {
  userId: string;
  referenceId?: string;
  fields?: Record<string, any>;
}

/**
 * Validates Persona configuration
 */
export const validatePersonaConfig = (): { valid: boolean; error?: string } => {
  if (!PERSONA_ENABLED) {
    return { valid: false, error: 'Persona verification is disabled' };
  }

  if (!PERSONA_TEMPLATE_ID || PERSONA_TEMPLATE_ID === 'itmpl_YOUR_TEMPLATE_ID_HERE') {
    return { valid: false, error: 'Persona template ID not configured' };
  }

  if (!PERSONA_API_KEY || PERSONA_API_KEY.startsWith('persona_YOUR_')) {
    return { valid: false, error: 'Persona API key not configured' };
  }

  return { valid: true };
};

/**
 * Create a new Persona inquiry session token via backend
 */
export const createPersonaInquiry = async (
  config: PersonaInquiryConfig
): Promise<{ sessionToken: string; inquiryId: string } | null> => {
  try {
    logDebug('[Persona] Creating inquiry for user:', config.userId);

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('User not authenticated');
    }

    // Call backend Edge Function to create inquiry
    const { data, error } = await supabase.functions.invoke('create-persona-inquiry', {
      body: {
        userId: config.userId,
        templateId: PERSONA_TEMPLATE_ID,
        referenceId: config.referenceId || `user_${config.userId}`,
        fields: config.fields || {}
      },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`
      }
    });

    if (error) {
      logError('[Persona] Error creating inquiry:', error);
      return null;
    }

    if (!data?.sessionToken || !data?.inquiryId) {
      logError('[Persona] Invalid response from create-persona-inquiry:', data);
      return null;
    }

    logInfo('[Persona] Inquiry created successfully:', data.inquiryId);
    return {
      sessionToken: data.sessionToken,
      inquiryId: data.inquiryId
    };
  } catch (error) {
    logError('[Persona] Failed to create inquiry:', error);
    return null;
  }
};

/**
 * Start Persona verification flow
 */
export const startPersonaVerification = async (
  config: PersonaInquiryConfig
): Promise<PersonaVerificationResult> => {
  try {
    // Validate configuration
    const validation = validatePersonaConfig();
    if (!validation.valid) {
      return {
        success: false,
        status: 'failed',
        error: validation.error,
        errorCode: 'CONFIG_INVALID'
      };
    }

    logInfo('[Persona] Starting verification flow for user:', config.userId);

    // Create inquiry session
    const inquiry = await createPersonaInquiry(config);
    if (!inquiry) {
      return {
        success: false,
        status: 'failed',
        error: 'Failed to create verification session',
        errorCode: 'INQUIRY_CREATE_FAILED'
      };
    }

    // Store inquiry ID in database immediately
    await supabase
      .from('profiles')
      .update({
        persona_inquiry_id: inquiry.inquiryId,
        persona_verification_status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', config.userId);

    logDebug('[Persona] Inquiry session created:', inquiry.inquiryId);

    // Return session info - the actual flow will be triggered via UI component
    return {
      success: true,
      inquiryId: inquiry.inquiryId,
      sessionToken: inquiry.sessionToken,
      status: 'in_progress'
    };
  } catch (error) {
    logError('[Persona] Verification start failed:', error);
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'VERIFICATION_START_FAILED'
    };
  }
};

/**
 * Handle inquiry completion callback
 */
export const handleInquiryComplete = async (
  userId: string,
  inquiryId: string,
  status: string
): Promise<void> => {
  try {
    logInfo('[Persona] Handling inquiry completion:', { userId, inquiryId, status });

    // Map Persona status to our verification status
    let verificationStatus: PersonaVerificationStatus = 'pending';

    switch (status.toLowerCase()) {
      case 'completed':
        verificationStatus = 'pending'; // Waiting for Persona review
        break;
      case 'approved':
        verificationStatus = 'approved';
        break;
      case 'declined':
        verificationStatus = 'declined';
        break;
      case 'failed':
      case 'expired':
        verificationStatus = 'failed';
        break;
      default:
        verificationStatus = 'in_progress';
    }

    // Update profile with inquiry result
    const { error } = await supabase
      .from('profiles')
      .update({
        persona_verification_status: verificationStatus,
        persona_verified_at: verificationStatus === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      logError('[Persona] Failed to update verification status:', error);
    } else {
      logInfo('[Persona] Verification status updated:', verificationStatus);
    }

    // Log verification attempt
    await supabase.from('persona_verification_logs').insert({
      user_id: userId,
      inquiry_id: inquiryId,
      status: verificationStatus,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logError('[Persona] Error handling inquiry complete:', error);
  }
};

/**
 * Handle inquiry error callback
 */
export const handleInquiryError = async (
  userId: string,
  inquiryId: string,
  error: any
): Promise<void> => {
  try {
    logError('[Persona] Inquiry error:', error);

    await supabase
      .from('profiles')
      .update({
        persona_verification_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    // Log error
    await supabase.from('persona_verification_logs').insert({
      user_id: userId,
      inquiry_id: inquiryId,
      status: 'failed',
      error_message: error?.message || 'Unknown error',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    logError('[Persona] Error handling inquiry error:', err);
  }
};

/**
 * Handle inquiry cancelled callback
 */
export const handleInquiryCancelled = async (
  userId: string,
  inquiryId: string
): Promise<void> => {
  try {
    logWarn('[Persona] Inquiry cancelled by user:', inquiryId);

    await supabase
      .from('profiles')
      .update({
        persona_verification_status: 'requires_retry',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    // Log cancellation
    await supabase.from('persona_verification_logs').insert({
      user_id: userId,
      inquiry_id: inquiryId,
      status: 'requires_retry',
      error_message: 'User cancelled verification',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logError('[Persona] Error handling inquiry cancellation:', error);
  }
};

/**
 * Get verification status for a user
 */
export const getVerificationStatus = async (
  userId: string
): Promise<{
  status: PersonaVerificationStatus;
  inquiryId?: string;
  verifiedAt?: string;
  canRetry: boolean;
}> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('persona_inquiry_id, persona_verification_status, persona_verified_at')
      .eq('id', userId)
      .single();

    if (error) {
      logError('[Persona] Error fetching verification status:', error);
      return { status: 'not_started', canRetry: true };
    }

    // Check retry eligibility
    const canRetry = !['approved', 'in_progress'].includes(data?.persona_verification_status || '');

    return {
      status: (data?.persona_verification_status as PersonaVerificationStatus) || 'not_started',
      inquiryId: data?.persona_inquiry_id || undefined,
      verifiedAt: data?.persona_verified_at || undefined,
      canRetry
    };
  } catch (error) {
    logError('[Persona] Error getting verification status:', error);
    return { status: 'not_started', canRetry: true };
  }
};

/**
 * Check if user is verified
 */
export const isUserVerified = async (userId: string): Promise<boolean> => {
  const status = await getVerificationStatus(userId);
  return status.status === 'approved';
};

/**
 * Get user-friendly status message
 */
export const getStatusMessage = (status: PersonaVerificationStatus): string => {
  switch (status) {
    case 'not_started':
      return 'Identity verification required to complete your profile';
    case 'in_progress':
      return 'Verification in progress...';
    case 'pending':
      return 'Verification under review - we\'ll notify you when complete';
    case 'approved':
      return 'Identity verified ✓';
    case 'declined':
      return 'Verification declined - please contact support';
    case 'failed':
      return 'Verification failed - please try again';
    case 'requires_retry':
      return 'Verification incomplete - tap to retry';
    default:
      return 'Verification status unknown';
  }
};

/**
 * Reset verification status (for retry)
 */
export const resetVerification = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        persona_inquiry_id: null,
        persona_verification_status: 'not_started',
        persona_verified_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      logError('[Persona] Error resetting verification:', error);
      return false;
    }

    logInfo('[Persona] Verification reset successfully for user:', userId);
    return true;
  } catch (error) {
    logError('[Persona] Error resetting verification:', error);
    return false;
  }
};

/**
 * Export Persona environment constant for SDK initialization
 */
export const getPersonaEnvironment = (): Environment => PERSONA_ENVIRONMENT;

/**
 * Check if Persona is properly configured
 */
export const isPersonaConfigured = (): boolean => {
  const validation = validatePersonaConfig();
  return validation.valid;
};

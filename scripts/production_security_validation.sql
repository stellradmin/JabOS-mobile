-- =====================================================================
-- PRODUCTION SECURITY VALIDATION: Comprehensive Deployment Readiness
-- =====================================================================
-- Purpose: Final security validation before production deployment
-- Priority: PRODUCTION CRITICAL - Gate for deployment approval
-- Scope: Complete security infrastructure validation
-- =====================================================================

-- 1. COMPREHENSIVE SECURITY VALIDATION FRAMEWORK
-- =====================================================================

-- Create deployment validation results table
CREATE TABLE IF NOT EXISTS deployment_validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_run_id UUID NOT NULL,
    validation_category VARCHAR(100) NOT NULL,
    validation_name VARCHAR(200) NOT NULL,
    validation_description TEXT NOT NULL,
    expected_status VARCHAR(50) NOT NULL,
    actual_status VARCHAR(50) NOT NULL,
    validation_result VARCHAR(20) CHECK (validation_result IN ('PASS', 'FAIL', 'WARNING', 'CRITICAL')),
    blocker_level VARCHAR(20) CHECK (blocker_level IN ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    validation_details JSONB,
    remediation_steps TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Master validation orchestrator function
CREATE OR REPLACE FUNCTION execute_production_security_validation()
RETURNS TABLE(
    validation_run_id UUID,
    total_validations INTEGER,
    passed_validations INTEGER,
    failed_validations INTEGER,
    critical_blockers INTEGER,
    deployment_approved BOOLEAN,
    overall_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    run_id UUID := gen_random_uuid();
    start_time TIMESTAMP := clock_timestamp();
    validation_count INTEGER := 0;
    pass_count INTEGER := 0;
    fail_count INTEGER := 0;
    critical_count INTEGER := 0;
    deployment_ready BOOLEAN := false;
BEGIN
    -- Log validation start
    INSERT INTO security_audit_log (
        action, resource_type, resource_id, details, severity, created_at
    ) VALUES (
        'PRODUCTION_VALIDATION_STARTED',
        'deployment_validation',
        run_id::text,
        jsonb_build_object('validation_type', 'comprehensive_security_validation'),
        'INFO',
        NOW()
    );
    
    -- Execute all validation categories
    PERFORM validate_rls_policy_security(run_id);
    PERFORM validate_service_role_restrictions(run_id);
    PERFORM validate_encryption_implementation(run_id);
    PERFORM validate_threat_detection_system(run_id);
    PERFORM validate_access_control_functions(run_id);
    PERFORM validate_audit_logging_system(run_id);
    PERFORM validate_rate_limiting_system(run_id);
    PERFORM validate_blocking_system_integrity(run_id);
    PERFORM validate_data_isolation_compliance(run_id);
    PERFORM validate_monitoring_infrastructure(run_id);
    
    -- Calculate validation results
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE validation_result = 'PASS'),
        COUNT(*) FILTER (WHERE validation_result IN ('FAIL', 'CRITICAL')),
        COUNT(*) FILTER (WHERE blocker_level = 'CRITICAL')
    INTO validation_count, pass_count, fail_count, critical_count
    FROM deployment_validation_results
    WHERE validation_run_id = run_id;
    
    -- Determine deployment approval
    deployment_ready := (critical_count = 0 AND fail_count <= 2);
    
    -- Log validation completion
    INSERT INTO security_audit_log (
        action, resource_type, resource_id, details, severity, created_at
    ) VALUES (
        'PRODUCTION_VALIDATION_COMPLETED',
        'deployment_validation',
        run_id::text,
        jsonb_build_object(
            'total_validations', validation_count,
            'passed', pass_count,
            'failed', fail_count,
            'critical_blockers', critical_count,
            'deployment_approved', deployment_ready,
            'execution_time_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - start_time))
        ),
        CASE WHEN deployment_ready THEN 'INFO' ELSE 'CRITICAL' END,
        NOW()
    );
    
    -- Return results
    RETURN QUERY SELECT 
        run_id,
        validation_count,
        pass_count,
        fail_count,
        critical_count,
        deployment_ready,
        CASE 
            WHEN deployment_ready THEN 'DEPLOYMENT_APPROVED'
            WHEN critical_count > 0 THEN 'CRITICAL_BLOCKERS_FOUND'
            ELSE 'DEPLOYMENT_BLOCKED'
        END;
END;
$$;

-- 2. RLS POLICY SECURITY VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_rls_policy_security(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    critical_tables TEXT[] := ARRAY[
        'users', 'profiles', 'conversations', 'messages', 'matches', 'swipes', 'blocks'
    ];
    table_name TEXT;
    rls_enabled BOOLEAN;
    policy_count INTEGER;
    dangerous_policies INTEGER;
    validation_result VARCHAR(20);
    blocker_level VARCHAR(20);
BEGIN
    -- Validate RLS is enabled on all critical tables
    FOREACH table_name IN ARRAY critical_tables LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) THEN
            -- Check RLS status
            SELECT rowsecurity INTO rls_enabled
            FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = table_name;
            
            -- Count policies
            SELECT COUNT(*) INTO policy_count
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = table_name;
            
            -- Count dangerous policies
            SELECT COUNT(*) INTO dangerous_policies
            FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = table_name 
            AND (qual = 'true' OR qual IS NULL);
            
            -- Determine validation result
            IF NOT COALESCE(rls_enabled, false) THEN
                validation_result := 'CRITICAL';
                blocker_level := 'CRITICAL';
            ELSIF dangerous_policies > 0 THEN
                validation_result := 'CRITICAL';
                blocker_level := 'CRITICAL';
            ELSIF policy_count < 2 THEN
                validation_result := 'FAIL';
                blocker_level := 'HIGH';
            ELSE
                validation_result := 'PASS';
                blocker_level := 'NONE';
            END IF;
            
            -- Record validation result
            INSERT INTO deployment_validation_results (
                validation_run_id, validation_category, validation_name,
                validation_description, expected_status, actual_status,
                validation_result, blocker_level, validation_details
            ) VALUES (
                validation_run_id, 'RLS_Policy_Security', 
                'RLS_Protection_' || table_name,
                'Verify ' || table_name || ' table has proper RLS protection',
                'RLS_ENABLED_WITH_SECURE_POLICIES',
                CASE 
                    WHEN NOT COALESCE(rls_enabled, false) THEN 'RLS_DISABLED'
                    WHEN dangerous_policies > 0 THEN 'DANGEROUS_POLICIES_FOUND'
                    WHEN policy_count < 2 THEN 'INSUFFICIENT_POLICIES'
                    ELSE 'PROPERLY_SECURED'
                END,
                validation_result, blocker_level,
                jsonb_build_object(
                    'table_name', table_name,
                    'rls_enabled', rls_enabled,
                    'policy_count', policy_count,
                    'dangerous_policies', dangerous_policies
                )
            );
        END IF;
    END LOOP;
    
    -- Global dangerous policy check
    SELECT COUNT(*) INTO dangerous_policies
    FROM pg_policies 
    WHERE schemaname = 'public' AND qual = 'true';
    
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'RLS_Policy_Security', 
        'Global_Dangerous_Policy_Check',
        'Verify no USING(true) policies exist in production',
        'ZERO_DANGEROUS_POLICIES',
        CASE WHEN dangerous_policies = 0 THEN 'NO_DANGEROUS_POLICIES' ELSE dangerous_policies || '_DANGEROUS_POLICIES_FOUND' END,
        CASE WHEN dangerous_policies = 0 THEN 'PASS' ELSE 'CRITICAL' END,
        CASE WHEN dangerous_policies = 0 THEN 'NONE' ELSE 'CRITICAL' END,
        jsonb_build_object('dangerous_policy_count', dangerous_policies)
    );
END;
$$;

-- 3. SERVICE ROLE RESTRICTIONS VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_service_role_restrictions(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    audit_system_exists BOOLEAN;
    monitoring_functions_exist BOOLEAN;
    restriction_policies_count INTEGER;
BEGIN
    -- Check if service role audit system exists
    audit_system_exists := EXISTS(
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'service_role_usage_audit'
    );
    
    -- Check if monitoring functions exist
    monitoring_functions_exist := EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'log_service_role_usage'
    );
    
    -- Count service role restriction policies
    SELECT COUNT(*) INTO restriction_policies_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND roles @> ARRAY['service_role']
    AND qual NOT LIKE '%log_service_role_usage%';
    
    -- Validate audit system
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Service_Role_Security', 
        'Service_Role_Audit_System',
        'Verify service role usage audit system is deployed',
        'AUDIT_SYSTEM_OPERATIONAL',
        CASE WHEN audit_system_exists THEN 'AUDIT_SYSTEM_ACTIVE' ELSE 'AUDIT_SYSTEM_MISSING' END,
        CASE WHEN audit_system_exists THEN 'PASS' ELSE 'CRITICAL' END,
        CASE WHEN audit_system_exists THEN 'NONE' ELSE 'CRITICAL' END,
        jsonb_build_object('audit_table_exists', audit_system_exists)
    );
    
    -- Validate monitoring functions
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Service_Role_Security', 
        'Service_Role_Monitoring',
        'Verify service role monitoring functions are deployed',
        'MONITORING_FUNCTIONS_AVAILABLE',
        CASE WHEN monitoring_functions_exist THEN 'MONITORING_ACTIVE' ELSE 'MONITORING_MISSING' END,
        CASE WHEN monitoring_functions_exist THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN monitoring_functions_exist THEN 'NONE' ELSE 'HIGH' END,
        jsonb_build_object('monitoring_functions_exist', monitoring_functions_exist)
    );
END;
$$;

-- 4. ENCRYPTION IMPLEMENTATION VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_encryption_implementation(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pgcrypto_available BOOLEAN;
    encryption_functions_exist BOOLEAN;
    key_management_system BOOLEAN;
    encrypted_columns_exist BOOLEAN;
BEGIN
    -- Check pgcrypto extension
    pgcrypto_available := EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
    );
    
    -- Check encryption functions
    encryption_functions_exist := (
        SELECT COUNT(*) FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname IN ('encrypt_sensitive_data', 'decrypt_sensitive_data')
    ) >= 2;
    
    -- Check key management system
    key_management_system := EXISTS(
        SELECT 1 FROM pg_tables WHERE tablename = 'encryption_keys'
    );
    
    -- Check encrypted columns exist
    encrypted_columns_exist := EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name LIKE '%_encrypted'
    );
    
    -- Validate pgcrypto
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Encryption_System', 
        'PgCrypto_Extension',
        'Verify pgcrypto extension is available for encryption',
        'PGCRYPTO_INSTALLED',
        CASE WHEN pgcrypto_available THEN 'EXTENSION_AVAILABLE' ELSE 'EXTENSION_MISSING' END,
        CASE WHEN pgcrypto_available THEN 'PASS' ELSE 'CRITICAL' END,
        CASE WHEN pgcrypto_available THEN 'NONE' ELSE 'CRITICAL' END,
        jsonb_build_object('pgcrypto_available', pgcrypto_available)
    );
    
    -- Validate encryption functions
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Encryption_System', 
        'Encryption_Functions',
        'Verify encryption/decryption functions are deployed',
        'ENCRYPTION_FUNCTIONS_AVAILABLE',
        CASE WHEN encryption_functions_exist THEN 'FUNCTIONS_DEPLOYED' ELSE 'FUNCTIONS_MISSING' END,
        CASE WHEN encryption_functions_exist THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN encryption_functions_exist THEN 'NONE' ELSE 'MEDIUM' END,
        jsonb_build_object('encryption_functions_exist', encryption_functions_exist)
    );
    
    -- Validate key management
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Encryption_System', 
        'Key_Management_System',
        'Verify encryption key management system is operational',
        'KEY_MANAGEMENT_OPERATIONAL',
        CASE WHEN key_management_system THEN 'KEY_SYSTEM_ACTIVE' ELSE 'KEY_SYSTEM_MISSING' END,
        CASE WHEN key_management_system THEN 'PASS' ELSE 'WARNING' END,
        CASE WHEN key_management_system THEN 'NONE' ELSE 'LOW' END,
        jsonb_build_object('key_management_system', key_management_system)
    );
END;
$$;

-- 5. THREAT DETECTION SYSTEM VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_threat_detection_system(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    threat_log_exists BOOLEAN;
    detection_functions_count INTEGER;
    monitoring_triggers_count INTEGER;
    incident_response_ready BOOLEAN;
BEGIN
    -- Check threat detection log table
    threat_log_exists := EXISTS(
        SELECT 1 FROM pg_tables WHERE tablename = 'threat_detection_log'
    );
    
    -- Count detection functions
    SELECT COUNT(*) INTO detection_functions_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname LIKE 'detect_%';
    
    -- Count monitoring triggers
    SELECT COUNT(*) INTO monitoring_triggers_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' 
    AND t.tgname LIKE 'security_monitor_%';
    
    -- Check incident response system
    incident_response_ready := EXISTS(
        SELECT 1 FROM pg_tables WHERE tablename = 'security_incidents'
    );
    
    -- Validate threat detection log
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Threat_Detection', 
        'Threat_Detection_Log',
        'Verify threat detection logging system is operational',
        'THREAT_LOGGING_ACTIVE',
        CASE WHEN threat_log_exists THEN 'LOGGING_OPERATIONAL' ELSE 'LOGGING_MISSING' END,
        CASE WHEN threat_log_exists THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN threat_log_exists THEN 'NONE' ELSE 'HIGH' END,
        jsonb_build_object('threat_log_exists', threat_log_exists)
    );
    
    -- Validate detection functions
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Threat_Detection', 
        'Detection_Functions',
        'Verify threat detection functions are deployed',
        'ADEQUATE_DETECTION_COVERAGE',
        CASE 
            WHEN detection_functions_count >= 3 THEN 'ADEQUATE_COVERAGE'
            WHEN detection_functions_count >= 1 THEN 'LIMITED_COVERAGE'
            ELSE 'NO_DETECTION'
        END,
        CASE 
            WHEN detection_functions_count >= 3 THEN 'PASS'
            WHEN detection_functions_count >= 1 THEN 'WARNING'
            ELSE 'FAIL'
        END,
        CASE 
            WHEN detection_functions_count >= 3 THEN 'NONE'
            WHEN detection_functions_count >= 1 THEN 'LOW'
            ELSE 'MEDIUM'
        END,
        jsonb_build_object('detection_functions_count', detection_functions_count)
    );
    
    -- Validate monitoring triggers
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Threat_Detection', 
        'Monitoring_Triggers',
        'Verify real-time monitoring triggers are active',
        'MONITORING_TRIGGERS_ACTIVE',
        CASE 
            WHEN monitoring_triggers_count >= 5 THEN 'FULL_MONITORING'
            WHEN monitoring_triggers_count >= 3 THEN 'PARTIAL_MONITORING'
            ELSE 'LIMITED_MONITORING'
        END,
        CASE 
            WHEN monitoring_triggers_count >= 5 THEN 'PASS'
            WHEN monitoring_triggers_count >= 3 THEN 'WARNING'
            ELSE 'FAIL'
        END,
        CASE 
            WHEN monitoring_triggers_count >= 5 THEN 'NONE'
            WHEN monitoring_triggers_count >= 3 THEN 'LOW'
            ELSE 'MEDIUM'
        END,
        jsonb_build_object('monitoring_triggers_count', monitoring_triggers_count)
    );
END;
$$;

-- 6. ACCESS CONTROL FUNCTIONS VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_access_control_functions(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    security_functions_count INTEGER;
    required_functions TEXT[] := ARRAY[
        'can_view_profile_secure_v2',
        'can_access_conversation_secure_v2',
        'can_access_match_secure_v2',
        'verify_user_access_secure',
        'secure_conversation_access'
    ];
    function_name TEXT;
    function_exists BOOLEAN;
BEGIN
    -- Check each required security function
    FOREACH function_name IN ARRAY required_functions LOOP
        function_exists := EXISTS(
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = function_name
        );
        
        INSERT INTO deployment_validation_results (
            validation_run_id, validation_category, validation_name,
            validation_description, expected_status, actual_status,
            validation_result, blocker_level, validation_details
        ) VALUES (
            validation_run_id, 'Access_Control_Functions', 
            'Function_' || function_name,
            'Verify ' || function_name || ' function is deployed and accessible',
            'FUNCTION_AVAILABLE',
            CASE WHEN function_exists THEN 'FUNCTION_EXISTS' ELSE 'FUNCTION_MISSING' END,
            CASE WHEN function_exists THEN 'PASS' ELSE 'CRITICAL' END,
            CASE WHEN function_exists THEN 'NONE' ELSE 'CRITICAL' END,
            jsonb_build_object(
                'function_name', function_name,
                'function_exists', function_exists
            )
        );
    END LOOP;
    
    -- Overall access control function coverage
    SELECT COUNT(*) INTO security_functions_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = ANY(required_functions);
    
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Access_Control_Functions', 
        'Overall_Function_Coverage',
        'Verify all required access control functions are deployed',
        'ALL_FUNCTIONS_AVAILABLE',
        CASE 
            WHEN security_functions_count = array_length(required_functions, 1) THEN 'COMPLETE_COVERAGE'
            WHEN security_functions_count >= 3 THEN 'PARTIAL_COVERAGE'
            ELSE 'INSUFFICIENT_COVERAGE'
        END,
        CASE 
            WHEN security_functions_count = array_length(required_functions, 1) THEN 'PASS'
            WHEN security_functions_count >= 3 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        CASE 
            WHEN security_functions_count = array_length(required_functions, 1) THEN 'NONE'
            WHEN security_functions_count >= 3 THEN 'MEDIUM'
            ELSE 'CRITICAL'
        END,
        jsonb_build_object(
            'available_functions', security_functions_count,
            'required_functions', array_length(required_functions, 1)
        )
    );
END;
$$;

-- 7. AUDIT LOGGING SYSTEM VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_audit_logging_system(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    audit_log_exists BOOLEAN;
    recent_audit_entries INTEGER;
    audit_triggers_count INTEGER;
BEGIN
    -- Check security audit log table
    audit_log_exists := EXISTS(
        SELECT 1 FROM pg_tables WHERE tablename = 'security_audit_log'
    );
    
    -- Count recent audit entries (indicates system is active)
    IF audit_log_exists THEN
        SELECT COUNT(*) INTO recent_audit_entries
        FROM security_audit_log 
        WHERE created_at > NOW() - INTERVAL '24 hours';
    ELSE
        recent_audit_entries := 0;
    END IF;
    
    -- Count audit-related triggers
    SELECT COUNT(*) INTO audit_triggers_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' 
    AND (t.tgname LIKE '%audit%' OR t.tgname LIKE '%log%');
    
    -- Validate audit log table
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Audit_Logging', 
        'Audit_Log_Table',
        'Verify security audit log table exists and is accessible',
        'AUDIT_LOG_OPERATIONAL',
        CASE WHEN audit_log_exists THEN 'AUDIT_LOG_AVAILABLE' ELSE 'AUDIT_LOG_MISSING' END,
        CASE WHEN audit_log_exists THEN 'PASS' ELSE 'CRITICAL' END,
        CASE WHEN audit_log_exists THEN 'NONE' ELSE 'CRITICAL' END,
        jsonb_build_object('audit_log_exists', audit_log_exists)
    );
    
    -- Validate audit system activity
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Audit_Logging', 
        'Audit_System_Activity',
        'Verify audit logging system is actively recording events',
        'AUDIT_ENTRIES_BEING_CREATED',
        CASE 
            WHEN recent_audit_entries > 0 THEN 'AUDIT_ACTIVE'
            WHEN audit_log_exists THEN 'AUDIT_IDLE'
            ELSE 'AUDIT_INACTIVE'
        END,
        CASE 
            WHEN recent_audit_entries > 0 THEN 'PASS'
            WHEN audit_log_exists THEN 'WARNING'
            ELSE 'FAIL'
        END,
        CASE 
            WHEN recent_audit_entries > 0 THEN 'NONE'
            WHEN audit_log_exists THEN 'LOW'
            ELSE 'HIGH'
        END,
        jsonb_build_object('recent_audit_entries', recent_audit_entries)
    );
END;
$$;

-- 8. RATE LIMITING SYSTEM VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_rate_limiting_system(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rate_limit_table_exists BOOLEAN;
    rate_limit_functions_exist BOOLEAN;
BEGIN
    -- Check rate limit entries table
    rate_limit_table_exists := EXISTS(
        SELECT 1 FROM pg_tables WHERE tablename = 'rate_limit_entries'
    );
    
    -- Check rate limiting functions
    rate_limit_functions_exist := EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname LIKE '%rate_limit%'
    );
    
    -- Validate rate limiting table
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Rate_Limiting', 
        'Rate_Limit_Table',
        'Verify rate limiting infrastructure is deployed',
        'RATE_LIMITING_OPERATIONAL',
        CASE WHEN rate_limit_table_exists THEN 'RATE_LIMITING_AVAILABLE' ELSE 'RATE_LIMITING_MISSING' END,
        CASE WHEN rate_limit_table_exists THEN 'PASS' ELSE 'WARNING' END,
        CASE WHEN rate_limit_table_exists THEN 'NONE' ELSE 'MEDIUM' END,
        jsonb_build_object('rate_limit_table_exists', rate_limit_table_exists)
    );
END;
$$;

-- 9. BLOCKING SYSTEM INTEGRITY VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_blocking_system_integrity(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    blocks_table_exists BOOLEAN;
    blocking_policies_count INTEGER;
BEGIN
    -- Check blocks table
    blocks_table_exists := EXISTS(
        SELECT 1 FROM pg_tables WHERE tablename = 'blocks'
    );
    
    -- Count policies that reference blocking
    SELECT COUNT(*) INTO blocking_policies_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (qual LIKE '%blocks%' OR with_check LIKE '%blocks%');
    
    -- Validate blocks table
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Blocking_System', 
        'Blocks_Table',
        'Verify user blocking system table exists',
        'BLOCKING_TABLE_AVAILABLE',
        CASE WHEN blocks_table_exists THEN 'BLOCKING_SYSTEM_AVAILABLE' ELSE 'BLOCKING_SYSTEM_MISSING' END,
        CASE WHEN blocks_table_exists THEN 'PASS' ELSE 'FAIL' END,
        CASE WHEN blocks_table_exists THEN 'NONE' ELSE 'MEDIUM' END,
        jsonb_build_object('blocks_table_exists', blocks_table_exists)
    );
    
    -- Validate blocking integration
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Blocking_System', 
        'Blocking_Policy_Integration',
        'Verify blocking system is integrated with access control policies',
        'BLOCKING_INTEGRATED',
        CASE 
            WHEN blocking_policies_count >= 3 THEN 'WELL_INTEGRATED'
            WHEN blocking_policies_count >= 1 THEN 'PARTIALLY_INTEGRATED'
            ELSE 'NOT_INTEGRATED'
        END,
        CASE 
            WHEN blocking_policies_count >= 3 THEN 'PASS'
            WHEN blocking_policies_count >= 1 THEN 'WARNING'
            ELSE 'FAIL'
        END,
        CASE 
            WHEN blocking_policies_count >= 3 THEN 'NONE'
            WHEN blocking_policies_count >= 1 THEN 'LOW'
            ELSE 'MEDIUM'
        END,
        jsonb_build_object('blocking_policies_count', blocking_policies_count)
    );
END;
$$;

-- 10. DATA ISOLATION COMPLIANCE VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_data_isolation_compliance(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_tables INTEGER;
    secured_tables INTEGER;
    compliance_percentage DECIMAL;
BEGIN
    -- Count total critical tables
    SELECT COUNT(*) INTO total_tables
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
        'users', 'profiles', 'conversations', 'messages', 
        'matches', 'swipes', 'blocks', 'audit_logs', 'security_audit_log'
    );
    
    -- Count properly secured tables
    SELECT COUNT(*) INTO secured_tables
    FROM pg_tables t
    WHERE t.schemaname = 'public' 
    AND t.tablename IN (
        'users', 'profiles', 'conversations', 'messages', 
        'matches', 'swipes', 'blocks', 'audit_logs', 'security_audit_log'
    )
    AND t.rowsecurity = true
    AND EXISTS (
        SELECT 1 FROM pg_policies p 
        WHERE p.schemaname = 'public' 
        AND p.tablename = t.tablename
        AND p.qual != 'true'
        AND p.qual IS NOT NULL
    );
    
    -- Calculate compliance percentage
    compliance_percentage := CASE 
        WHEN total_tables > 0 THEN (secured_tables::DECIMAL / total_tables) * 100 
        ELSE 0 
    END;
    
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Data_Isolation_Compliance', 
        'Overall_Data_Isolation',
        'Verify comprehensive data isolation compliance across all tables',
        'FULL_COMPLIANCE_100_PERCENT',
        CASE 
            WHEN compliance_percentage = 100 THEN 'FULL_COMPLIANCE'
            WHEN compliance_percentage >= 90 THEN 'HIGH_COMPLIANCE'
            WHEN compliance_percentage >= 75 THEN 'MODERATE_COMPLIANCE'
            ELSE 'LOW_COMPLIANCE'
        END,
        CASE 
            WHEN compliance_percentage = 100 THEN 'PASS'
            WHEN compliance_percentage >= 90 THEN 'WARNING'
            ELSE 'CRITICAL'
        END,
        CASE 
            WHEN compliance_percentage = 100 THEN 'NONE'
            WHEN compliance_percentage >= 90 THEN 'LOW'
            ELSE 'CRITICAL'
        END,
        jsonb_build_object(
            'total_tables', total_tables,
            'secured_tables', secured_tables,
            'compliance_percentage', compliance_percentage
        )
    );
END;
$$;

-- 11. MONITORING INFRASTRUCTURE VALIDATION
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_monitoring_infrastructure(validation_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    monitoring_views_count INTEGER;
    security_functions_count INTEGER;
    dashboard_ready BOOLEAN;
BEGIN
    -- Count monitoring views
    SELECT COUNT(*) INTO monitoring_views_count
    FROM pg_views 
    WHERE schemaname = 'public' 
    AND (viewname LIKE '%security%' OR viewname LIKE '%metrics%');
    
    -- Count security analysis functions
    SELECT COUNT(*) INTO security_functions_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND (p.proname LIKE '%validate%' OR p.proname LIKE '%security%');
    
    -- Check if security dashboard views are ready
    dashboard_ready := EXISTS(
        SELECT 1 FROM pg_views 
        WHERE viewname IN ('security_metrics_dashboard', 'security_trends_weekly')
    );
    
    INSERT INTO deployment_validation_results (
        validation_run_id, validation_category, validation_name,
        validation_description, expected_status, actual_status,
        validation_result, blocker_level, validation_details
    ) VALUES (
        validation_run_id, 'Monitoring_Infrastructure', 
        'Security_Monitoring_Views',
        'Verify security monitoring and dashboard views are available',
        'MONITORING_VIEWS_AVAILABLE',
        CASE 
            WHEN monitoring_views_count >= 2 THEN 'ADEQUATE_MONITORING'
            WHEN monitoring_views_count >= 1 THEN 'LIMITED_MONITORING'
            ELSE 'NO_MONITORING'
        END,
        CASE 
            WHEN monitoring_views_count >= 2 THEN 'PASS'
            WHEN monitoring_views_count >= 1 THEN 'WARNING'
            ELSE 'FAIL'
        END,
        CASE 
            WHEN monitoring_views_count >= 2 THEN 'NONE'
            WHEN monitoring_views_count >= 1 THEN 'LOW'
            ELSE 'MEDIUM'
        END,
        jsonb_build_object(
            'monitoring_views_count', monitoring_views_count,
            'dashboard_ready', dashboard_ready
        )
    );
END;
$$;

-- 12. DEPLOYMENT READINESS REPORT FUNCTIONS
-- =====================================================================

-- Generate comprehensive deployment report
CREATE OR REPLACE FUNCTION generate_deployment_readiness_report(validation_run_id UUID)
RETURNS TABLE(
    category TEXT,
    validations_total INTEGER,
    validations_passed INTEGER,
    validations_failed INTEGER,
    critical_blockers INTEGER,
    category_status TEXT,
    deployment_ready BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dvr.validation_category::TEXT,
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE dvr.validation_result = 'PASS')::INTEGER as passed,
        COUNT(*) FILTER (WHERE dvr.validation_result IN ('FAIL', 'CRITICAL'))::INTEGER as failed,
        COUNT(*) FILTER (WHERE dvr.blocker_level = 'CRITICAL')::INTEGER as critical,
        CASE 
            WHEN COUNT(*) FILTER (WHERE dvr.blocker_level = 'CRITICAL') > 0 THEN 'CRITICAL_BLOCKERS'
            WHEN COUNT(*) FILTER (WHERE dvr.validation_result IN ('FAIL', 'CRITICAL')) > 0 THEN 'HAS_FAILURES'
            WHEN COUNT(*) FILTER (WHERE dvr.validation_result = 'WARNING') > 0 THEN 'HAS_WARNINGS'
            ELSE 'ALL_PASSED'
        END::TEXT,
        (COUNT(*) FILTER (WHERE dvr.blocker_level = 'CRITICAL') = 0)::BOOLEAN
    FROM deployment_validation_results dvr
    WHERE dvr.validation_run_id = generate_deployment_readiness_report.validation_run_id
    GROUP BY dvr.validation_category
    ORDER BY 
        CASE 
            WHEN COUNT(*) FILTER (WHERE dvr.blocker_level = 'CRITICAL') > 0 THEN 1
            WHEN COUNT(*) FILTER (WHERE dvr.validation_result IN ('FAIL', 'CRITICAL')) > 0 THEN 2
            WHEN COUNT(*) FILTER (WHERE dvr.validation_result = 'WARNING') > 0 THEN 3
            ELSE 4
        END,
        dvr.validation_category;
END;
$$;

-- Get detailed failure information
CREATE OR REPLACE FUNCTION get_deployment_failures(validation_run_id UUID)
RETURNS TABLE(
    validation_name TEXT,
    category TEXT,
    description TEXT,
    expected_status TEXT,
    actual_status TEXT,
    blocker_level TEXT,
    remediation_steps TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dvr.validation_name::TEXT,
        dvr.validation_category::TEXT,
        dvr.validation_description::TEXT,
        dvr.expected_status::TEXT,
        dvr.actual_status::TEXT,
        dvr.blocker_level::TEXT,
        COALESCE(dvr.remediation_steps, 'Manual intervention required')::TEXT
    FROM deployment_validation_results dvr
    WHERE dvr.validation_run_id = get_deployment_failures.validation_run_id
    AND dvr.validation_result IN ('FAIL', 'CRITICAL')
    ORDER BY 
        CASE dvr.blocker_level 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            ELSE 4 
        END,
        dvr.validation_category,
        dvr.validation_name;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION execute_production_security_validation() TO service_role;
GRANT EXECUTE ON FUNCTION generate_deployment_readiness_report(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_deployment_failures(UUID) TO service_role;

-- Create final deployment approval function
CREATE OR REPLACE FUNCTION get_final_deployment_approval()
RETURNS TABLE(
    deployment_approved BOOLEAN,
    approval_status TEXT,
    total_validations INTEGER,
    critical_blockers INTEGER,
    high_risk_issues INTEGER,
    approval_timestamp TIMESTAMP WITH TIME ZONE,
    next_steps TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    latest_run_id UUID;
    total_count INTEGER;
    critical_count INTEGER;
    high_risk_count INTEGER;
    approved BOOLEAN;
    status_text TEXT;
    next_actions TEXT;
BEGIN
    -- Get latest validation run
    SELECT dvr.validation_run_id INTO latest_run_id
    FROM deployment_validation_results dvr
    ORDER BY dvr.created_at DESC
    LIMIT 1;
    
    IF latest_run_id IS NULL THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            'NO_VALIDATION_RUNS_FOUND'::TEXT,
            0::INTEGER,
            0::INTEGER,
            0::INTEGER,
            NOW(),
            'Execute production security validation first'::TEXT;
        RETURN;
    END IF;
    
    -- Calculate metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE blocker_level = 'CRITICAL'),
        COUNT(*) FILTER (WHERE blocker_level IN ('CRITICAL', 'HIGH'))
    INTO total_count, critical_count, high_risk_count
    FROM deployment_validation_results
    WHERE validation_run_id = latest_run_id;
    
    -- Determine approval
    approved := (critical_count = 0 AND high_risk_count <= 2);
    
    status_text := CASE 
        WHEN approved THEN 'DEPLOYMENT_APPROVED'
        WHEN critical_count > 0 THEN 'CRITICAL_BLOCKERS_MUST_BE_RESOLVED'
        WHEN high_risk_count > 2 THEN 'TOO_MANY_HIGH_RISK_ISSUES'
        ELSE 'DEPLOYMENT_BLOCKED'
    END;
    
    next_actions := CASE 
        WHEN approved THEN 'Proceed with production deployment'
        WHEN critical_count > 0 THEN 'Resolve all critical security issues before deployment'
        ELSE 'Address high-risk security issues and re-validate'
    END;
    
    RETURN QUERY SELECT 
        approved,
        status_text,
        total_count,
        critical_count,
        high_risk_count,
        NOW(),
        next_actions;
END;
$$;

GRANT EXECUTE ON FUNCTION get_final_deployment_approval() TO service_role;

-- Log validation script deployment
INSERT INTO security_audit_log (
    action, resource_type, resource_id, details, severity, created_at
) VALUES (
    'PRODUCTION_VALIDATION_SCRIPT_DEPLOYED',
    'deployment_validation',
    'production_security_validation',
    jsonb_build_object(
        'validation_categories', ARRAY[
            'RLS_Policy_Security',
            'Service_Role_Security',
            'Encryption_System',
            'Threat_Detection',
            'Access_Control_Functions',
            'Audit_Logging',
            'Rate_Limiting',
            'Blocking_System',
            'Data_Isolation_Compliance',
            'Monitoring_Infrastructure'
        ],
        'validation_framework', 'comprehensive_security_validation',
        'deployment_gate', true
    ),
    'INFO',
    NOW()
);

-- Final deployment notice
DO $$
BEGIN
    RAISE NOTICE '✅ PRODUCTION SECURITY VALIDATION FRAMEWORK DEPLOYED';
    RAISE NOTICE '✅ Comprehensive security validation system ready';
    RAISE NOTICE '✅ Execute execute_production_security_validation() to validate deployment readiness';
    RAISE NOTICE '✅ Use get_final_deployment_approval() for deployment gate decision';
    RAISE NOTICE '✅ All security infrastructure validation components operational';
END $$;
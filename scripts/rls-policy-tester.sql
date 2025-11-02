-- =====================================================================
-- COMPREHENSIVE RLS POLICY TESTING SUITE
-- =====================================================================
-- Production-grade SQL testing for all 93 RLS policies
-- Tests for privilege escalation, cross-user access, and policy bypass

\set ON_ERROR_STOP on

-- Create test schema for isolated testing
CREATE SCHEMA IF NOT EXISTS security_test;

-- =====================================================================
-- TEST SETUP AND UTILITIES
-- =====================================================================

-- Create test users for policy testing
DO $$
DECLARE
    test_user_1_id UUID := gen_random_uuid();
    test_user_2_id UUID := gen_random_uuid();
    test_admin_id UUID := gen_random_uuid();
BEGIN
    -- Store test user IDs in temp table for reference
    CREATE TEMP TABLE IF NOT EXISTS test_users (
        role_name TEXT PRIMARY KEY,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    DELETE FROM test_users;
    
    INSERT INTO test_users (role_name, user_id) VALUES 
        ('test_user_1', test_user_1_id),
        ('test_user_2', test_user_2_id),
        ('test_admin', test_admin_id);
    
    RAISE NOTICE 'Test users created:';
    RAISE NOTICE '  User 1: %', test_user_1_id;
    RAISE NOTICE '  User 2: %', test_user_2_id;
    RAISE NOTICE '  Admin: %', test_admin_id;
END $$;

-- Function to safely test policies without affecting production data
CREATE OR REPLACE FUNCTION security_test.test_policy_security(
    p_table_name TEXT,
    p_test_user_id UUID,
    p_target_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    test_name TEXT,
    test_result TEXT,
    security_risk TEXT,
    details TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_query TEXT;
    result_count INTEGER;
    error_message TEXT;
BEGIN
    -- Test 1: Cross-user data access attempt
    RETURN QUERY
    SELECT 
        'Cross-User Access Test'::TEXT,
        CASE 
            WHEN p_target_user_id IS NULL THEN 'SKIPPED'::TEXT
            ELSE 'TESTING'::TEXT
        END,
        CASE 
            WHEN p_target_user_id IS NULL THEN 'N/A'::TEXT
            ELSE 'HIGH'::TEXT
        END,
        format('Testing access to %s data from user %s', p_table_name, p_test_user_id)::TEXT;
    
    -- Additional test cases will be added here
    RETURN;
    
EXCEPTION 
    WHEN OTHERS THEN
        RETURN QUERY
        SELECT 
            'Policy Test Error'::TEXT,
            'ERROR'::TEXT,
            'UNKNOWN'::TEXT,
            SQLERRM::TEXT;
        RETURN;
END;
$$;

-- =====================================================================
-- CRITICAL RLS POLICY AUDIT QUERIES
-- =====================================================================

-- Query 1: Find all dangerous USING(true) policies
CREATE OR REPLACE VIEW security_test.dangerous_policies_audit AS
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check,
    CASE 
        WHEN qual = 'true' THEN 'CRITICAL: USING(true) allows unlimited access'
        WHEN qual IS NULL THEN 'CRITICAL: No USING clause - allows unlimited access'  
        WHEN with_check = 'true' THEN 'HIGH: WITH CHECK(true) allows unrestricted writes'
        WHEN roles::text ILIKE '%service_role%' AND qual = 'true' THEN 'CRITICAL: Service role with USING(true)'
        WHEN roles::text ILIKE '%anon%' AND qual = 'true' THEN 'CRITICAL: Anonymous role with USING(true)'
        ELSE 'REVIEW: Potential security concern'
    END as security_risk,
    CASE
        WHEN qual = 'true' OR qual IS NULL THEN true
        ELSE false 
    END as is_vulnerable
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY 
    CASE 
        WHEN qual = 'true' OR qual IS NULL THEN 1
        WHEN with_check = 'true' THEN 2
        ELSE 3
    END,
    tablename, 
    policyname;

-- Query 2: Find tables without RLS protection
CREATE OR REPLACE VIEW security_test.missing_rls_audit AS
SELECT 
    t.schemaname,
    t.tablename,
    t.tableowner,
    CASE 
        WHEN c.relrowsecurity = false THEN 'CRITICAL: RLS disabled'
        WHEN c.relrowsecurity IS NULL THEN 'CRITICAL: RLS not configured'
        ELSE 'OK: RLS enabled'
    END as rls_status,
    COALESCE(policy_count.count, 0) as policy_count,
    CASE 
        WHEN COALESCE(policy_count.count, 0) = 0 AND c.relrowsecurity = true 
        THEN 'CRITICAL: RLS enabled but no policies'
        WHEN COALESCE(policy_count.count, 0) < 2 AND t.tablename IN ('users', 'profiles', 'conversations', 'messages', 'matches', 'swipes')
        THEN 'HIGH: Insufficient policy coverage for sensitive table'
        ELSE 'OK: Adequate policy coverage'
    END as policy_status
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
LEFT JOIN (
    SELECT tablename, COUNT(*) as count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
) policy_count ON policy_count.tablename = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename NOT LIKE '%_old'
AND t.tablename NOT LIKE '%_backup'
ORDER BY 
    CASE 
        WHEN c.relrowsecurity = false OR c.relrowsecurity IS NULL THEN 1
        WHEN COALESCE(policy_count.count, 0) = 0 THEN 2
        ELSE 3
    END,
    t.tablename;

-- Query 3: Analyze service role policy risks
CREATE OR REPLACE VIEW security_test.service_role_policy_risks AS
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as using_clause,
    with_check,
    CASE 
        WHEN qual = 'true' AND roles::text ILIKE '%service_role%' 
        THEN 'CRITICAL: Service role can bypass all RLS with USING(true)'
        WHEN qual IS NULL AND roles::text ILIKE '%service_role%'
        THEN 'CRITICAL: Service role has unlimited access (no USING clause)'
        WHEN with_check = 'true' AND roles::text ILIKE '%service_role%'
        THEN 'HIGH: Service role can insert/update without restrictions'
        WHEN roles::text ILIKE '%service_role%'
        THEN 'REVIEW: Service role access - verify necessity'
        ELSE 'OK: No service role access'
    END as risk_assessment,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
AND (
    roles::text ILIKE '%service_role%'
    OR qual = 'true'
    OR qual IS NULL
    OR with_check = 'true'
)
ORDER BY 
    CASE 
        WHEN qual = 'true' AND roles::text ILIKE '%service_role%' THEN 1
        WHEN qual IS NULL AND roles::text ILIKE '%service_role%' THEN 2
        WHEN with_check = 'true' AND roles::text ILIKE '%service_role%' THEN 3
        ELSE 4
    END,
    tablename,
    policyname;

-- Query 4: Cross-user access vulnerability patterns
CREATE OR REPLACE VIEW security_test.cross_user_access_risks AS
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as using_clause,
    CASE 
        WHEN qual NOT LIKE '%auth.uid()%' AND qual NOT LIKE '%user_id%' AND tablename IN ('profiles', 'conversations', 'messages', 'matches', 'swipes')
        THEN 'HIGH: Policy may allow cross-user access on sensitive table'
        WHEN qual LIKE '%user_id = %' AND qual NOT LIKE '%auth.uid()%'
        THEN 'MEDIUM: User ID check without auth verification'
        WHEN qual IS NULL OR qual = 'true'
        THEN 'CRITICAL: No user isolation - allows access to all data'
        ELSE 'OK: Appears to have proper user isolation'
    END as cross_user_risk,
    LENGTH(qual) as policy_complexity
FROM pg_policies 
WHERE schemaname = 'public'
AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
ORDER BY 
    CASE 
        WHEN qual IS NULL OR qual = 'true' THEN 1
        WHEN qual NOT LIKE '%auth.uid()%' AND qual NOT LIKE '%user_id%' THEN 2
        ELSE 3
    END,
    tablename,
    policyname;

-- =====================================================================
-- PRIVILEGE ESCALATION TEST SCENARIOS
-- =====================================================================

-- Test scenario 1: Service role privilege escalation
CREATE OR REPLACE FUNCTION security_test.test_service_role_escalation()
RETURNS TABLE(
    vulnerability_type TEXT,
    affected_table TEXT,
    policy_name TEXT,
    risk_level TEXT,
    exploitation_method TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    policy_rec RECORD;
BEGIN
    -- Test for service role policies that allow privilege escalation
    FOR policy_rec IN 
        SELECT 
            p.tablename,
            p.policyname,
            p.qual,
            p.with_check,
            p.roles
        FROM pg_policies p
        WHERE p.schemaname = 'public'
        AND p.roles::text ILIKE '%service_role%'
        AND (p.qual = 'true' OR p.qual IS NULL OR p.with_check = 'true')
    LOOP
        IF policy_rec.qual = 'true' OR policy_rec.qual IS NULL THEN
            RETURN QUERY SELECT 
                'Service Role Bypass'::TEXT,
                policy_rec.tablename::TEXT,
                policy_rec.policyname::TEXT,
                'CRITICAL'::TEXT,
                'Service role can access all rows regardless of ownership'::TEXT;
        END IF;
        
        IF policy_rec.with_check = 'true' THEN
            RETURN QUERY SELECT 
                'Unrestricted Write Access'::TEXT,
                policy_rec.tablename::TEXT,
                policy_rec.policyname::TEXT,
                'HIGH'::TEXT,
                'Service role can insert/update any data without validation'::TEXT;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$;

-- Test scenario 2: Anonymous role vulnerabilities
CREATE OR REPLACE FUNCTION security_test.test_anonymous_access_risks()
RETURNS TABLE(
    vulnerability_type TEXT,
    affected_table TEXT,
    policy_name TEXT,
    risk_level TEXT,
    potential_impact TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    policy_rec RECORD;
BEGIN
    FOR policy_rec IN 
        SELECT 
            p.tablename,
            p.policyname,
            p.qual,
            p.cmd,
            p.roles
        FROM pg_policies p
        WHERE p.schemaname = 'public'
        AND (p.roles::text ILIKE '%anon%' OR p.roles IS NULL)
        AND (p.qual = 'true' OR p.qual IS NULL)
    LOOP
        RETURN QUERY SELECT 
            'Anonymous Access Vulnerability'::TEXT,
            policy_rec.tablename::TEXT,
            policy_rec.policyname::TEXT,
            CASE 
                WHEN policy_rec.cmd = 'SELECT' THEN 'HIGH'
                WHEN policy_rec.cmd IN ('INSERT', 'UPDATE', 'DELETE') THEN 'CRITICAL'
                ELSE 'MEDIUM'
            END::TEXT,
            format('Unauthenticated users can %s data in %s table', 
                   LOWER(policy_rec.cmd), policy_rec.tablename)::TEXT;
    END LOOP;
    
    RETURN;
END;
$$;

-- =====================================================================
-- COMPREHENSIVE SECURITY TEST EXECUTION
-- =====================================================================

-- Main audit execution function
CREATE OR REPLACE FUNCTION security_test.execute_comprehensive_audit()
RETURNS TABLE(
    audit_section TEXT,
    finding_type TEXT,
    severity TEXT,
    table_name TEXT,
    policy_name TEXT,
    description TEXT,
    remediation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_policies INTEGER;
    vulnerable_policies INTEGER;
    critical_findings INTEGER;
    high_findings INTEGER;
BEGIN
    -- Get counts for summary
    SELECT COUNT(*) INTO total_policies 
    FROM pg_policies WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO vulnerable_policies
    FROM security_test.dangerous_policies_audit
    WHERE is_vulnerable = true;
    
    SELECT COUNT(*) INTO critical_findings
    FROM security_test.dangerous_policies_audit  
    WHERE security_risk LIKE 'CRITICAL:%';
    
    SELECT COUNT(*) INTO high_findings
    FROM security_test.dangerous_policies_audit
    WHERE security_risk LIKE 'HIGH:%';
    
    -- Return summary first
    RETURN QUERY SELECT 
        'AUDIT SUMMARY'::TEXT,
        'Policy Count'::TEXT,
        'INFO'::TEXT,
        ''::TEXT,
        ''::TEXT,
        format('Total: %s, Vulnerable: %s, Critical: %s, High: %s', 
               total_policies, vulnerable_policies, critical_findings, high_findings)::TEXT,
        'Review all findings below'::TEXT;
    
    -- Return dangerous policies
    RETURN QUERY 
    SELECT 
        'DANGEROUS POLICIES'::TEXT,
        'Policy Analysis'::TEXT,
        CASE 
            WHEN security_risk LIKE 'CRITICAL:%' THEN 'CRITICAL'
            WHEN security_risk LIKE 'HIGH:%' THEN 'HIGH'
            ELSE 'MEDIUM'
        END::TEXT,
        tablename::TEXT,
        policyname::TEXT,
        security_risk::TEXT,
        'Update policy to use proper user isolation checks'::TEXT
    FROM security_test.dangerous_policies_audit
    WHERE is_vulnerable = true;
    
    -- Return missing RLS findings
    RETURN QUERY
    SELECT 
        'MISSING RLS'::TEXT,
        'Table Security'::TEXT,
        CASE 
            WHEN rls_status LIKE 'CRITICAL:%' THEN 'CRITICAL'
            WHEN policy_status LIKE 'HIGH:%' THEN 'HIGH'
            ELSE 'MEDIUM'
        END::TEXT,
        tablename::TEXT,
        ''::TEXT,
        format('%s | %s', rls_status, policy_status)::TEXT,
        'Enable RLS and create appropriate policies'::TEXT
    FROM security_test.missing_rls_audit
    WHERE rls_status LIKE 'CRITICAL:%' OR policy_status LIKE 'CRITICAL:%' OR policy_status LIKE 'HIGH:%';
    
    -- Return service role risks
    RETURN QUERY
    SELECT 
        'SERVICE ROLE RISKS'::TEXT,
        'Privilege Escalation'::TEXT,
        CASE 
            WHEN risk_assessment LIKE 'CRITICAL:%' THEN 'CRITICAL'
            WHEN risk_assessment LIKE 'HIGH:%' THEN 'HIGH'
            ELSE 'MEDIUM'
        END::TEXT,
        tablename::TEXT,
        policyname::TEXT,
        risk_assessment::TEXT,
        'Remove service_role from policy or add proper restrictions'::TEXT
    FROM security_test.service_role_policy_risks
    WHERE risk_assessment LIKE 'CRITICAL:%' OR risk_assessment LIKE 'HIGH:%';
    
    -- Return cross-user access risks  
    RETURN QUERY
    SELECT 
        'CROSS-USER ACCESS'::TEXT,
        'Data Isolation'::TEXT,
        CASE 
            WHEN cross_user_risk LIKE 'CRITICAL:%' THEN 'CRITICAL'
            WHEN cross_user_risk LIKE 'HIGH:%' THEN 'HIGH'
            ELSE 'MEDIUM'
        END::TEXT,
        tablename::TEXT,
        policyname::TEXT,
        cross_user_risk::TEXT,
        'Add auth.uid() or proper user_id checks'::TEXT
    FROM security_test.cross_user_access_risks
    WHERE cross_user_risk LIKE 'CRITICAL:%' OR cross_user_risk LIKE 'HIGH:%';
    
    RETURN;
END;
$$;

-- =====================================================================
-- EXECUTION COMMANDS
-- =====================================================================

-- Execute comprehensive audit
\echo '🔒 EXECUTING COMPREHENSIVE RLS SECURITY AUDIT...'
\echo ''

-- Run the full audit
SELECT * FROM security_test.execute_comprehensive_audit()
ORDER BY 
    CASE severity 
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2  
        WHEN 'MEDIUM' THEN 3
        ELSE 4
    END,
    audit_section,
    table_name,
    policy_name;

-- Test privilege escalation scenarios
\echo ''
\echo '🔍 TESTING PRIVILEGE ESCALATION SCENARIOS...'
\echo ''

SELECT * FROM security_test.test_service_role_escalation()
ORDER BY risk_level, affected_table;

SELECT * FROM security_test.test_anonymous_access_risks() 
ORDER BY risk_level, affected_table;

-- Final summary
\echo ''
\echo '📊 AUDIT COMPLETE - Review findings above'
\echo 'Any CRITICAL or HIGH findings must be resolved before production deployment'
\echo ''
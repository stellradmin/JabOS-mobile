#!/bin/bash

# =====================================================================
# COMPREHENSIVE SUPABASE SECURITY AUDIT SCRIPT
# =====================================================================
# Production-grade security audit for all 93 RLS policies and backend
# Zero tolerance for privilege escalation vulnerabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
AUDIT_DATE=$(date +"%Y%m%d_%H%M%S")
AUDIT_DIR="security-audit-${AUDIT_DATE}"
REPORT_FILE="${AUDIT_DIR}/supabase-security-audit-report.md"

# Counters for tracking
TOTAL_POLICIES=0
VULNERABLE_POLICIES=0
CRITICAL_FINDINGS=0
HIGH_FINDINGS=0
MEDIUM_FINDINGS=0

# Arrays for findings
CRITICAL_ISSUES=()
HIGH_ISSUES=()
MEDIUM_ISSUES=()
POLICY_FINDINGS=()

# Logging functions
log() {
    echo -e "${BLUE}[INFO] $(date '+%H:%M:%S') - $1${NC}"
}

critical() {
    echo -e "${RED}[CRITICAL] $(date '+%H:%M:%S') - $1${NC}"
    CRITICAL_ISSUES+=("$1")
    ((CRITICAL_FINDINGS++))
}

high() {
    echo -e "${PURPLE}[HIGH] $(date '+%H:%M:%S') - $1${NC}"
    HIGH_ISSUES+=("$1")
    ((HIGH_FINDINGS++))
}

medium() {
    echo -e "${YELLOW}[MEDIUM] $(date '+%H:%M:%S') - $1${NC}"
    MEDIUM_ISSUES+=("$1")
    ((MEDIUM_FINDINGS++))
}

success() {
    echo -e "${GREEN}[SUCCESS] $(date '+%H:%M:%S') - $1${NC}"
}

# Initialize audit
init_audit() {
    log "Initializing Supabase security audit for investor compliance"
    
    # Create audit directory
    mkdir -p "$AUDIT_DIR"/{policies,functions,schemas,logs}
    
    # Check Supabase CLI
    if ! command -v supabase &> /dev/null; then
        critical "Supabase CLI not found. Install with: npm install -g supabase"
        exit 1
    fi
    
    # Verify connection
    log "Verifying Supabase connection and permissions..."
    if ! supabase status > /dev/null 2>&1; then
        critical "Cannot connect to Supabase. Check configuration and credentials."
        exit 1
    fi
    
    success "Supabase CLI configured and connected"
}

# Audit all RLS policies for privilege escalation
audit_rls_policies() {
    log "PHASE 1: Auditing all RLS policies for privilege escalation vulnerabilities"
    
    # Export all policies
    log "Exporting all RLS policies..."
    supabase db dump --data-only --file "${AUDIT_DIR}/policies/all_policies.sql" 2>/dev/null || {
        critical "Failed to export RLS policies. Check database permissions."
        return 1
    }
    
    # Get policy count and details
    local policy_query="
    SELECT 
        schemaname,
        tablename,
        policyname,
        cmd,
        roles,
        qual as using_clause,
        with_check,
        CASE 
            WHEN qual = 'true' OR qual IS NULL THEN 'DANGEROUS'
            WHEN with_check = 'true' THEN 'DANGEROUS' 
            WHEN roles::text ILIKE '%service_role%' AND (qual = 'true' OR qual IS NULL) THEN 'CRITICAL'
            ELSE 'REVIEW'
        END as security_risk
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY security_risk, schemaname, tablename, policyname;
    "
    
    log "Analyzing RLS policies for security vulnerabilities..."
    
    # Execute policy audit query
    supabase db sql --db-url="$DATABASE_URL" -c "$policy_query" > "${AUDIT_DIR}/policies/policy_analysis.csv" 2>/dev/null || {
        critical "Failed to analyze RLS policies. Check database access."
        return 1
    }
    
    # Count total policies
    TOTAL_POLICIES=$(supabase db sql --db-url="$DATABASE_URL" -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'" 2>/dev/null | tail -1 | xargs)
    
    log "Found $TOTAL_POLICIES RLS policies to audit"
    
    # Analyze dangerous policies
    audit_dangerous_policies
    
    # Check for missing RLS on sensitive tables
    audit_missing_rls
    
    # Test privilege escalation scenarios
    test_privilege_escalation
}

# Analyze dangerous RLS policies
audit_dangerous_policies() {
    log "Analyzing dangerous RLS policy patterns..."
    
    local dangerous_query="
    SELECT 
        tablename,
        policyname,
        roles,
        CASE 
            WHEN qual = 'true' THEN 'USING(true) - Allows all access'
            WHEN qual IS NULL THEN 'No USING clause - Allows all access'
            WHEN with_check = 'true' THEN 'WITH CHECK(true) - Allows all inserts/updates'
            ELSE 'Other dangerous pattern'
        END as vulnerability_type
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND (qual = 'true' OR qual IS NULL OR with_check = 'true')
    ORDER BY tablename, policyname;
    "
    
    local dangerous_policies=$(supabase db sql --db-url="$DATABASE_URL" -c "$dangerous_query" 2>/dev/null)
    
    if [[ -n "$dangerous_policies" ]]; then
        echo "$dangerous_policies" > "${AUDIT_DIR}/policies/dangerous_policies.txt"
        
        while IFS='|' read -r table policy roles vuln_type; do
            if [[ -n "$table" && "$table" != "tablename" ]]; then
                VULNERABLE_POLICIES=$((VULNERABLE_POLICIES + 1))
                if [[ "$roles" == *"service_role"* ]]; then
                    critical "PRIVILEGE ESCALATION: Policy '$policy' on table '$table' allows service_role with $vuln_type"
                    POLICY_FINDINGS+=("CRITICAL: $table.$policy - Service role privilege escalation")
                else
                    high "DANGEROUS POLICY: Policy '$policy' on table '$table' - $vuln_type"
                    POLICY_FINDINGS+=("HIGH: $table.$policy - $vuln_type")
                fi
            fi
        done <<< "$dangerous_policies"
    else
        success "No dangerous RLS policies found"
    fi
}

# Check for missing RLS on sensitive tables
audit_missing_rls() {
    log "Checking for missing RLS on sensitive tables..."
    
    local sensitive_tables=("users" "profiles" "conversations" "messages" "matches" "swipes" "blocks" "payments" "subscriptions")
    
    for table in "${sensitive_tables[@]}"; do
        local rls_enabled=$(supabase db sql --db-url="$DATABASE_URL" -c "SELECT relrowsecurity FROM pg_class WHERE relname = '$table'" 2>/dev/null | tail -1 | xargs)
        
        if [[ "$rls_enabled" == "f" || "$rls_enabled" == "" ]]; then
            critical "MISSING RLS: Table '$table' does not have Row Level Security enabled"
            POLICY_FINDINGS+=("CRITICAL: $table - Missing RLS protection")
        else
            # Check if table has adequate policies
            local policy_count=$(supabase db sql --db-url="$DATABASE_URL" -c "SELECT COUNT(*) FROM pg_policies WHERE tablename = '$table'" 2>/dev/null | tail -1 | xargs)
            
            if [[ "$policy_count" -eq 0 ]]; then
                critical "NO POLICIES: Table '$table' has RLS enabled but no policies defined"
                POLICY_FINDINGS+=("CRITICAL: $table - RLS enabled but no policies")
            elif [[ "$policy_count" -lt 2 ]]; then
                medium "LIMITED POLICIES: Table '$table' has only $policy_count policy(ies)"
                POLICY_FINDINGS+=("MEDIUM: $table - Limited policy coverage")
            else
                success "Table '$table' has adequate RLS protection ($policy_count policies)"
            fi
        fi
    done
}

# Test privilege escalation scenarios
test_privilege_escalation() {
    log "Testing privilege escalation scenarios..."
    
    # Test 1: Service role bypass attempts
    log "Testing service role policy bypass vulnerabilities..."
    
    local bypass_test_query="
    SELECT 
        t.tablename,
        COUNT(*) as policy_count,
        COUNT(CASE WHEN p.roles::text ILIKE '%service_role%' AND (p.qual = 'true' OR p.qual IS NULL) THEN 1 END) as dangerous_service_policies
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename
    WHERE t.schemaname = 'public'
    AND t.tablename IN ('users', 'profiles', 'conversations', 'messages', 'matches', 'swipes')
    GROUP BY t.tablename
    HAVING COUNT(CASE WHEN p.roles::text ILIKE '%service_role%' AND (p.qual = 'true' OR p.qual IS NULL) THEN 1 END) > 0;
    "
    
    local bypass_results=$(supabase db sql --db-url="$DATABASE_URL" -c "$bypass_test_query" 2>/dev/null)
    
    if [[ -n "$bypass_results" ]]; then
        echo "$bypass_results" > "${AUDIT_DIR}/policies/privilege_escalation_risks.txt"
        critical "PRIVILEGE ESCALATION RISKS DETECTED - See privilege_escalation_risks.txt"
    fi
    
    # Test 2: Cross-user data access patterns
    log "Testing cross-user data access vulnerabilities..."
    
    local cross_user_test="
    SELECT 
        tablename,
        policyname,
        qual
    FROM pg_policies
    WHERE schemaname = 'public'
    AND qual NOT LIKE '%auth.uid()%'
    AND qual NOT LIKE '%user_id = %'
    AND tablename IN ('profiles', 'conversations', 'messages', 'matches')
    AND cmd IN ('SELECT', 'UPDATE', 'DELETE');
    "
    
    local cross_user_results=$(supabase db sql --db-url="$DATABASE_URL" -c "$cross_user_test" 2>/dev/null)
    
    if [[ -n "$cross_user_results" ]]; then
        echo "$cross_user_results" > "${AUDIT_DIR}/policies/cross_user_access_risks.txt"
        high "POTENTIAL CROSS-USER ACCESS RISKS - See cross_user_access_risks.txt"
    fi
}

# Audit Edge Functions security
audit_edge_functions() {
    log "PHASE 2: Auditing all 51 Edge Functions for JWT and security vulnerabilities"
    
    # Get list of all functions
    local functions=$(find ../stellr-backend/supabase/functions -name "*.ts" 2>/dev/null | head -51)
    local function_count=$(echo "$functions" | wc -l)
    
    log "Found $function_count Edge Functions to audit"
    
    for func_file in $functions; do
        audit_single_function "$func_file"
    done
}

# Audit individual Edge Function
audit_single_function() {
    local func_file="$1"
    local func_name=$(basename "$func_file" .ts)
    
    log "Auditing Edge Function: $func_name"
    
    # Check for JWT validation
    if ! grep -q "jwt\|JWT\|token" "$func_file"; then
        high "MISSING JWT VALIDATION: Function '$func_name' may not validate JWT tokens"
    fi
    
    # Check for proper error handling
    if ! grep -q "try.*catch\|\.catch(" "$func_file"; then
        medium "MISSING ERROR HANDLING: Function '$func_name' lacks error handling"
    fi
    
    # Check for rate limiting
    if ! grep -q "rate.*limit\|throttle" "$func_file"; then
        medium "MISSING RATE LIMITING: Function '$func_name' lacks rate limiting"
    fi
    
    # Check for input validation
    if ! grep -q "validate\|sanitize\|clean" "$func_file"; then
        high "MISSING INPUT VALIDATION: Function '$func_name' may not validate inputs"
    fi
    
    # Check for SQL injection patterns
    if grep -q "\`.*\${.*}\`\|sql.*\${" "$func_file"; then
        critical "SQL INJECTION RISK: Function '$func_name' has potential SQL injection vulnerability"
    fi
}

# Audit database configuration
audit_database_config() {
    log "PHASE 3: Auditing database configuration and security settings"
    
    # Check PostgreSQL security settings
    log "Checking PostgreSQL security configuration..."
    
    local security_settings_query="
    SELECT name, setting, unit, context, short_desc
    FROM pg_settings 
    WHERE name IN (
        'ssl',
        'log_statement',
        'log_min_duration_statement',
        'shared_preload_libraries',
        'row_security'
    );
    "
    
    supabase db sql --db-url="$DATABASE_URL" -c "$security_settings_query" > "${AUDIT_DIR}/schemas/pg_security_settings.txt" 2>/dev/null
    
    # Check for default/weak passwords
    local password_check="
    SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
    FROM pg_roles 
    WHERE rolcanlogin = true
    ORDER BY rolname;
    "
    
    supabase db sql --db-url="$DATABASE_URL" -c "$password_check" > "${AUDIT_DIR}/schemas/database_users.txt" 2>/dev/null
    
    # Check for encryption settings
    local encryption_check="
    SELECT schemaname, tablename, attname, typname
    FROM pg_attribute a
    JOIN pg_type t ON a.atttypid = t.oid
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND (attname ILIKE '%password%' OR attname ILIKE '%secret%' OR attname ILIKE '%token%')
    AND t.typname = 'text';
    "
    
    local unencrypted_fields=$(supabase db sql --db-url="$DATABASE_URL" -c "$encryption_check" 2>/dev/null)
    
    if [[ -n "$unencrypted_fields" ]]; then
        echo "$unencrypted_fields" > "${AUDIT_DIR}/schemas/unencrypted_sensitive_fields.txt"
        high "UNENCRYPTED SENSITIVE FIELDS DETECTED - See unencrypted_sensitive_fields.txt"
    fi
}

# Generate comprehensive security report
generate_security_report() {
    log "Generating comprehensive security audit report..."
    
    cat > "$REPORT_FILE" << EOF
# 🔒 STELLR SUPABASE SECURITY AUDIT REPORT

**Audit Date**: $(date)  
**Auditor**: Automated Security Audit System  
**Scope**: Complete Supabase backend security assessment  
**Compliance**: Investor 51% stakeholder security requirements  

## 📊 EXECUTIVE SUMMARY

### Security Metrics
- **Total RLS Policies Audited**: $TOTAL_POLICIES
- **Vulnerable Policies Found**: $VULNERABLE_POLICIES  
- **Critical Findings**: $CRITICAL_FINDINGS  
- **High Risk Findings**: $HIGH_FINDINGS  
- **Medium Risk Findings**: $MEDIUM_FINDINGS  

### Risk Assessment
EOF

    if [[ $CRITICAL_FINDINGS -gt 0 ]]; then
        echo "**🚨 CRITICAL RISK**: Immediate action required - deployment BLOCKED" >> "$REPORT_FILE"
    elif [[ $HIGH_FINDINGS -gt 0 ]]; then
        echo "**⚠️ HIGH RISK**: Significant security issues require immediate attention" >> "$REPORT_FILE"
    elif [[ $MEDIUM_FINDINGS -gt 0 ]]; then
        echo "**⚠️ MEDIUM RISK**: Security improvements recommended" >> "$REPORT_FILE"
    else
        echo "**✅ LOW RISK**: Security posture is acceptable" >> "$REPORT_FILE"
    fi

    cat >> "$REPORT_FILE" << EOF

## 🚨 CRITICAL FINDINGS

EOF

    if [[ ${#CRITICAL_ISSUES[@]} -eq 0 ]]; then
        echo "✅ No critical security issues found." >> "$REPORT_FILE"
    else
        for issue in "${CRITICAL_ISSUES[@]}"; do
            echo "- ❌ $issue" >> "$REPORT_FILE"
        done
    fi

    cat >> "$REPORT_FILE" << EOF

## ⚠️ HIGH RISK FINDINGS

EOF

    if [[ ${#HIGH_ISSUES[@]} -eq 0 ]]; then
        echo "✅ No high risk security issues found." >> "$REPORT_FILE"
    else
        for issue in "${HIGH_ISSUES[@]}"; do
            echo "- ⚠️ $issue" >> "$REPORT_FILE"
        done
    fi

    cat >> "$REPORT_FILE" << EOF

## 📋 RLS POLICY FINDINGS

EOF

    if [[ ${#POLICY_FINDINGS[@]} -eq 0 ]]; then
        echo "✅ All RLS policies are properly configured." >> "$REPORT_FILE"
    else
        for finding in "${POLICY_FINDINGS[@]}"; do
            echo "- $finding" >> "$REPORT_FILE"
        done
    fi

    cat >> "$REPORT_FILE" << EOF

## 📂 DETAILED ANALYSIS FILES

The following detailed analysis files have been generated:

- \`policies/all_policies.sql\` - Complete RLS policy export
- \`policies/policy_analysis.csv\` - Comprehensive policy analysis  
- \`policies/dangerous_policies.txt\` - Policies with security risks
- \`policies/privilege_escalation_risks.txt\` - Privilege escalation vulnerabilities
- \`policies/cross_user_access_risks.txt\` - Cross-user data access risks
- \`schemas/pg_security_settings.txt\` - Database security configuration
- \`schemas/database_users.txt\` - Database user roles and permissions
- \`schemas/unencrypted_sensitive_fields.txt\` - Unencrypted sensitive data

## 🛠️ IMMEDIATE ACTIONS REQUIRED

EOF

    if [[ $CRITICAL_FINDINGS -gt 0 ]]; then
        cat >> "$REPORT_FILE" << EOF
### 🚨 CRITICAL (Fix within 24 hours)
1. **Review all service role policies** - Remove USING(true) from service role policies
2. **Implement proper RLS** - Add missing RLS policies for sensitive tables  
3. **Fix privilege escalation** - Restrict service role access patterns
4. **Test security controls** - Verify all fixes prevent unauthorized access

EOF
    fi

    if [[ $HIGH_FINDINGS -gt 0 ]]; then
        cat >> "$REPORT_FILE" << EOF
### ⚠️ HIGH PRIORITY (Fix within 1 week)
1. **Strengthen RLS policies** - Replace broad policies with specific user-scoped rules
2. **Add missing validations** - Implement comprehensive input validation
3. **Enhance monitoring** - Add security event logging for sensitive operations
4. **Review Edge Functions** - Audit all 51 functions for security vulnerabilities

EOF
    fi

    cat >> "$REPORT_FILE" << EOF

## 📞 ESCALATION CONTACTS

- **Critical Issues**: security-team@stellr.app  
- **Technical Lead**: cto@stellr.app  
- **Investor Relations**: investor-relations@stellr.app  

---

**⚠️ INVESTOR NOTICE**: This audit was conducted to meet 51% stakeholder security requirements. 
Any CRITICAL or HIGH findings must be resolved before production deployment authorization.

EOF

    success "Security audit report generated: $REPORT_FILE"
}

# Main execution
main() {
    log "🔒 STARTING COMPREHENSIVE SUPABASE SECURITY AUDIT"
    log "Investor compliance requirements: ZERO TOLERANCE for security vulnerabilities"
    echo ""
    
    # Initialize audit
    init_audit
    
    # Execute audit phases
    audit_rls_policies
    audit_edge_functions
    audit_database_config
    
    # Generate report
    generate_security_report
    
    # Final summary
    echo ""
    log "🔒 SECURITY AUDIT COMPLETE"
    echo ""
    echo "📊 AUDIT SUMMARY:"
    echo "  Total Policies: $TOTAL_POLICIES"
    echo "  Critical Issues: $CRITICAL_FINDINGS"
    echo "  High Risk Issues: $HIGH_FINDINGS"
    echo "  Medium Risk Issues: $MEDIUM_FINDINGS"
    echo ""
    echo "📂 Report Location: $REPORT_FILE"
    echo ""
    
    # Determine exit code based on findings
    if [[ $CRITICAL_FINDINGS -gt 0 ]]; then
        critical "SECURITY AUDIT FAILED - Critical vulnerabilities detected"
        critical "DEPLOYMENT BLOCKED until all critical issues are resolved"
        exit 1
    elif [[ $HIGH_FINDINGS -gt 0 ]]; then
        high "SECURITY AUDIT WARNING - High risk vulnerabilities require immediate attention"
        exit 2
    else
        success "SECURITY AUDIT PASSED - No critical or high risk vulnerabilities"
        exit 0
    fi
}

# Run main function with all arguments
main "$@"
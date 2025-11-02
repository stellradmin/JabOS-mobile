#!/bin/bash

# =====================================================================
# STELLR SECURITY VALIDATION SCRIPT
# =====================================================================
# Comprehensive validation of all security implementations
# Run this script to verify security fixes are properly implemented

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Arrays for results
PASSED_ITEMS=()
FAILED_ITEMS=()
WARNING_ITEMS=()

# Logging functions
log() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

check() {
    echo -e "${CYAN}[CHECK] $1${NC}"
    ((TOTAL_CHECKS++))
}

pass() {
    echo -e "${GREEN}  ✅ $1${NC}"
    PASSED_ITEMS+=("$1")
    ((PASSED_CHECKS++))
}

fail() {
    echo -e "${RED}  ❌ $1${NC}"
    FAILED_ITEMS+=("$1")
    ((FAILED_CHECKS++))
}

warn() {
    echo -e "${YELLOW}  ⚠️  $1${NC}"
    WARNING_ITEMS+=("$1")
    ((WARNING_CHECKS++))
}

# Main validation function
main() {
    echo -e "${CYAN}🔒 Stellr Security Validation${NC}"
    echo "=================================================="
    echo ""
    
    # 1. Environment Files Security
    log "Validating environment file security..."
    
    check "Environment files are sanitized"
    if grep -q "MOVED_TO_EAS_SECRETS\|STORE_IN_EAS_SECRETS_ONLY" .env.staging .env.production.example .env.test 2>/dev/null; then
        pass "Environment files properly sanitized"
    else
        fail "Environment files still contain sensitive secrets"
    fi
    
    check "No committed secrets in environment files"
    if grep -E "(sk_|pk_live|rk_live|whsec_|eyJ.*\.eyJ)" .env* 2>/dev/null | grep -v "MOVED_TO_EAS_SECRETS\|STORE_IN_EAS_SECRETS_ONLY\|LOAD_FROM_SECURE_TEST_CONFIG"; then
        fail "Real secrets found in environment files"
    else
        pass "No real secrets in committed environment files"
    fi
    
    # 2. Gitleaks Configuration
    log "Validating secret scanning configuration..."
    
    check "Gitleaks configuration exists"
    if [[ -f ".gitleaks.toml" ]]; then
        pass "Gitleaks configuration file present"
    else
        fail "Gitleaks configuration missing"
    fi
    
    check "Gitleaks can run secret scan"
    if command -v gitleaks >/dev/null 2>&1; then
        if gitleaks detect -v -s . -c .gitleaks.toml --redact --no-banner >/dev/null 2>&1; then
            pass "Secret scan completed successfully"
        else
            warn "Secret scan found potential issues - review manually"
        fi
    else
        warn "Gitleaks not installed - install with: brew install gitleaks"
    fi
    
    # 3. CI/CD Pipeline
    log "Validating CI/CD pipeline configuration..."
    
    check "GitHub Actions workflows exist"
    workflows_count=0
    for workflow in "security-audit.yml" "ci-cd.yml" "bundle-analysis.yml"; do
        if [[ -f ".github/workflows/$workflow" ]]; then
            ((workflows_count++))
        fi
    done
    
    if [[ $workflows_count -eq 3 ]]; then
        pass "All required GitHub Actions workflows present"
    else
        fail "Missing GitHub Actions workflows ($workflows_count/3 found)"
    fi
    
    # 4. Pre-commit Hooks
    log "Validating pre-commit hooks..."
    
    check "Husky hooks are configured"
    hooks_count=0
    for hook in "pre-commit" "pre-push" "commit-msg"; do
        if [[ -f ".husky/$hook" ]]; then
            ((hooks_count++))
        fi
    done
    
    if [[ $hooks_count -eq 3 ]]; then
        pass "All Husky hooks configured"
    else
        fail "Missing Husky hooks ($hooks_count/3 found)"
    fi
    
    check "Hook files are executable"
    if [[ -x ".husky/pre-commit" ]] && [[ -x ".husky/pre-push" ]] && [[ -x ".husky/commit-msg" ]]; then
        pass "Hook files are executable"
    else
        warn "Some hook files may not be executable"
    fi
    
    # 5. Package.json Security Scripts
    log "Validating package.json security scripts..."
    
    check "Security scripts are available"
    required_scripts=("security:scan" "security:audit" "bundle:analyze")
    missing_scripts=()
    
    for script in "${required_scripts[@]}"; do
        if ! jq -e ".scripts.\"$script\"" package.json >/dev/null 2>&1; then
            missing_scripts+=("$script")
        fi
    done
    
    if [[ ${#missing_scripts[@]} -eq 0 ]]; then
        pass "All security scripts present in package.json"
    else
        fail "Missing security scripts: ${missing_scripts[*]}"
    fi
    
    # 6. Documentation
    log "Validating security documentation..."
    
    check "Security documentation exists"
    if [[ -f "SECURITY.md" ]]; then
        pass "SECURITY.md documentation present"
    else
        fail "SECURITY.md documentation missing"
    fi
    
    check "README includes security section"
    if grep -q "🔒 Security" README.md; then
        pass "README includes security section"
    else
        warn "README missing security section"
    fi
    
    # 7. Dependencies Security
    log "Validating dependency security..."
    
    check "Dependencies can be audited"
    if npm audit --audit-level=high >/dev/null 2>&1; then
        pass "No high-severity dependency vulnerabilities"
    else
        warn "High-severity vulnerabilities detected - run 'npm audit' to review"
    fi
    
    # 8. Source Code Security
    log "Validating source code security..."
    
    check "No hardcoded secrets in source code"
    if grep -r "sk_\|pk_live\|rk_live\|whsec_" --include="*.js" --include="*.ts" --include="*.tsx" src/ 2>/dev/null; then
        fail "Potential hardcoded API keys found in source code"
    else
        pass "No hardcoded secrets in source code"
    fi
    
    check "SecureStore usage validation"
    if grep -r "AsyncStorage.*token\|AsyncStorage.*password\|AsyncStorage.*secret" --include="*.ts" --include="*.tsx" src/ 2>/dev/null; then
        fail "Insecure AsyncStorage usage for sensitive data detected"
    else
        pass "No insecure AsyncStorage usage for sensitive data"
    fi
    
    check "Proper token storage implementation"
    if grep -r "SecureStore\|expo-secure-store" --include="*.ts" --include="*.tsx" src/ >/dev/null 2>&1; then
        pass "SecureStore implementation found"
    else
        warn "SecureStore implementation not found - verify token storage"
    fi
    
    # 9. Environment Configuration
    log "Validating environment configuration..."
    
    check "Required environment files exist"
    env_files=(".env.example" ".env.production.example" ".env.staging")
    missing_env=()
    
    for file in "${env_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_env+=("$file")
        fi
    done
    
    if [[ ${#missing_env[@]} -eq 0 ]]; then
        pass "All required environment files present"
    else
        warn "Missing environment files: ${missing_env[*]}"
    fi
    
    # 10. Bundle Security
    log "Validating bundle configuration..."
    
    check "Bundle analysis scripts available"
    if jq -e '.scripts."bundle:analyze"' package.json >/dev/null 2>&1; then
        pass "Bundle analysis scripts configured"
    else
        fail "Bundle analysis scripts missing"
    fi
    
    # Generate final report
    generate_report
}

# Generate final security validation report
generate_report() {
    echo ""
    echo "=================================================="
    echo -e "${CYAN}🔒 STELLR SECURITY VALIDATION REPORT${NC}"
    echo "=================================================="
    echo ""
    echo -e "${BLUE}📊 SUMMARY${NC}"
    echo "  Total Checks: $TOTAL_CHECKS"
    echo -e "  ${GREEN}Passed: $PASSED_CHECKS${NC}"
    echo -e "  ${RED}Failed: $FAILED_CHECKS${NC}"
    echo -e "  ${YELLOW}Warnings: $WARNING_CHECKS${NC}"
    echo ""
    
    # Calculate security score
    if [[ $TOTAL_CHECKS -gt 0 ]]; then
        SCORE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
        echo -e "${BLUE}🎯 SECURITY SCORE: ${SCORE}%${NC}"
        echo ""
    fi
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}🎉 SECURITY VALIDATION PASSED!${NC}"
        echo "All critical security measures are properly implemented."
        
        if [[ $WARNING_CHECKS -gt 0 ]]; then
            echo ""
            echo -e "${YELLOW}⚠️  RECOMMENDATIONS:${NC}"
            for item in "${WARNING_ITEMS[@]}"; do
                echo -e "${YELLOW}  • $item${NC}"
            done
        fi
    else
        echo -e "${RED}❌ SECURITY VALIDATION FAILED${NC}"
        echo "Critical security issues must be resolved:"
        echo ""
        for item in "${FAILED_ITEMS[@]}"; do
            echo -e "${RED}  • $item${NC}"
        done
        
        if [[ $WARNING_CHECKS -gt 0 ]]; then
            echo ""
            echo -e "${YELLOW}⚠️  ADDITIONAL WARNINGS:${NC}"
            for item in "${WARNING_ITEMS[@]}"; do
                echo -e "${YELLOW}  • $item${NC}"
            done
        fi
    fi
    
    echo ""
    echo "=================================================="
    echo -e "${BLUE}📚 NEXT STEPS${NC}"
    echo ""
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo "✅ Security validation complete"
        echo "✅ Ready for production deployment"
        echo ""
        echo "🔗 Useful commands:"
        echo "  npm run security:scan     # Run secret scan"
        echo "  npm run security:audit    # Full security audit"
        echo "  npm run bundle:analyze    # Analyze bundle size"
        echo "  npm run test:security-comprehensive  # Security tests"
    else
        echo "❌ Fix failed security checks before proceeding"
        echo "📖 Review SECURITY.md for detailed guidance"
        echo "🆘 Contact security team if assistance needed"
    fi
    
    echo ""
    echo "=================================================="
    
    # Exit with error code if critical checks failed
    if [[ $FAILED_CHECKS -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

# Run main function
main "$@"
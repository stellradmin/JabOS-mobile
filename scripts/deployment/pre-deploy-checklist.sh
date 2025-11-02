#!/bin/bash

# Stellr Pre-Deployment Checklist Script
# Comprehensive validation before production deployment

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

# Result arrays
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

# Check if file exists
check_file() {
    local file=$1
    local description=$2
    
    if [[ -f "$file" ]]; then
        pass "$description exists"
        return 0
    else
        fail "$description missing"
        return 1
    fi
}

# Check if directory exists
check_directory() {
    local dir=$1
    local description=$2
    
    if [[ -d "$dir" ]]; then
        pass "$description exists"
        return 0
    else
        fail "$description missing"
        return 1
    fi
}

# Check environment variables in file
check_env_vars() {
    local env_file=$1
    local required_vars=(
        "EXPO_PUBLIC_SUPABASE_URL"
        "EXPO_PUBLIC_SUPABASE_ANON_KEY"
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
        "NODE_ENV"
        "EXPO_PUBLIC_ENV"
    )
    
    if [[ ! -f "$env_file" ]]; then
        fail "Environment file $env_file does not exist"
        return 1
    fi
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -eq 0 ]]; then
        pass "All required environment variables present in $env_file"
        return 0
    else
        fail "Missing environment variables in $env_file: ${missing_vars[*]}"
        return 1
    fi
}

# Check app.json configuration
check_app_config() {
    local app_json="app.json"
    
    if [[ ! -f "$app_json" ]]; then
        fail "app.json not found"
        return 1
    fi
    
    # Check required fields
    local required_fields=(
        ".expo.name"
        ".expo.slug"
        ".expo.version"
        ".expo.ios.bundleIdentifier"
        ".expo.android.package"
        ".expo.description"
        ".expo.privacy"
    )
    
    local missing_fields=()
    for field in "${required_fields[@]}"; do
        if ! jq -e "$field" "$app_json" >/dev/null 2>&1; then
            missing_fields+=("$field")
        fi
    done
    
    if [[ ${#missing_fields[@]} -eq 0 ]]; then
        pass "All required app.json fields present"
    else
        fail "Missing app.json fields: ${missing_fields[*]}"
        return 1
    fi
    
    # Check iOS configuration
    if jq -e '.expo.ios.infoPlist.NSCameraUsageDescription' "$app_json" >/dev/null 2>&1; then
        pass "iOS camera permission configured"
    else
        fail "iOS camera permission not configured"
    fi
    
    # Check Android permissions
    if jq -e '.expo.android.permissions | map(select(. == "android.permission.CAMERA")) | length > 0' "$app_json" >/dev/null 2>&1; then
        pass "Android camera permission configured"
    else
        fail "Android camera permission not configured"
    fi
}

# Check EAS configuration
check_eas_config() {
    local eas_json="eas.json"
    
    if [[ ! -f "$eas_json" ]]; then
        fail "eas.json not found"
        return 1
    fi
    
    # Check production build profile
    if jq -e '.build.production' "$eas_json" >/dev/null 2>&1; then
        pass "Production build profile configured"
    else
        fail "Production build profile missing"
        return 1
    fi
    
    # Check submit configuration
    if jq -e '.submit.production' "$eas_json" >/dev/null 2>&1; then
        pass "Production submit profile configured"
    else
        fail "Production submit profile missing"
    fi
    
    # Check iOS bundle identifier consistency
    local app_bundle_id=$(jq -r '.expo.ios.bundleIdentifier' app.json 2>/dev/null)
    local eas_bundle_id=$(jq -r '.submit.production.ios.bundleIdentifier' eas.json 2>/dev/null)
    
    if [[ "$app_bundle_id" == "$eas_bundle_id" ]]; then
        pass "iOS bundle identifier consistent between app.json and eas.json"
    else
        warn "iOS bundle identifier mismatch: app.json($app_bundle_id) vs eas.json($eas_bundle_id)"
    fi
}

# Check package.json
check_package_config() {
    local package_json="package.json"
    
    if [[ ! -f "$package_json" ]]; then
        fail "package.json not found"
        return 1
    fi
    
    # Check required scripts
    local required_scripts=("start" "build" "test" "lint" "type-check")
    local missing_scripts=()
    
    for script in "${required_scripts[@]}"; do
        if ! jq -e ".scripts.\"$script\"" "$package_json" >/dev/null 2>&1; then
            missing_scripts+=("$script")
        fi
    done
    
    if [[ ${#missing_scripts[@]} -eq 0 ]]; then
        pass "All required npm scripts present"
    else
        fail "Missing npm scripts: ${missing_scripts[*]}"
    fi
    
    # Check critical dependencies
    local critical_deps=("expo" "react" "react-native" "@supabase/supabase-js")
    for dep in "${critical_deps[@]}"; do
        if jq -e ".dependencies.\"$dep\"" "$package_json" >/dev/null 2>&1; then
            pass "$dep dependency found"
        else
            fail "$dep dependency missing"
        fi
    done
}

# Check credentials and certificates
check_credentials() {
    # Android credentials
    if [[ -f "credentials/google-play-service-account.json" ]]; then
        pass "Google Play service account key found"
        
        # Validate JSON format
        if jq . "credentials/google-play-service-account.json" >/dev/null 2>&1; then
            pass "Google Play service account key is valid JSON"
        else
            fail "Google Play service account key is invalid JSON"
        fi
    else
        warn "Google Play service account key not found (required for Android deployment)"
    fi
    
    # Check if credentials directory has proper permissions
    if [[ -d "credentials" ]]; then
        local perms=$(stat -f "%A" credentials 2>/dev/null || echo "unknown")
        if [[ "$perms" == "700" ]] || [[ "$perms" == "750" ]]; then
            pass "Credentials directory has secure permissions"
        else
            warn "Credentials directory permissions should be more restrictive (700 or 750)"
        fi
    fi
}

# Check asset files
check_assets() {
    local required_assets=(
        "assets/images/icon.png"
        "assets/images/adaptive-icon.png"
        "assets/images/favicon.png"
        "assets/images/stellr.png"
    )
    
    for asset in "${required_assets[@]}"; do
        if [[ -f "$asset" ]]; then
            pass "Asset file found: $(basename "$asset")"
        else
            fail "Missing asset file: $asset"
        fi
    done
}

# Check dependencies and security
check_dependencies() {
    log "Checking dependencies..."
    
    # Check for known vulnerabilities
    if command -v npm >/dev/null 2>&1; then
        if npm audit --audit-level high --json >/dev/null 2>&1; then
            pass "No high-severity vulnerabilities found"
        else
            fail "High-severity vulnerabilities detected - run 'npm audit' to fix"
        fi
    else
        warn "npm not available - cannot check for vulnerabilities"
    fi
    
    # Check for outdated dependencies
    if npm outdated --json >/dev/null 2>&1; then
        pass "All dependencies are up to date"
    else
        warn "Some dependencies are outdated - consider updating"
    fi
}

# Check build tools
check_build_tools() {
    log "Checking build tools..."
    
    # Check EAS CLI
    if command -v eas >/dev/null 2>&1; then
        pass "EAS CLI installed"
        
        # Check EAS login
        if eas whoami >/dev/null 2>&1; then
            local username=$(eas whoami 2>/dev/null)
            pass "Logged in to EAS as: $username"
        else
            fail "Not logged in to EAS CLI - run 'eas login'"
        fi
    else
        fail "EAS CLI not installed - run 'npm install -g @expo/eas-cli'"
    fi
    
    # Check Node.js version
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node -v)
        pass "Node.js version: $node_version"
    else
        fail "Node.js not installed"
    fi
    
    # Check npm version
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm -v)
        pass "npm version: $npm_version"
    else
        fail "npm not installed"
    fi
}

# Check store-specific requirements
check_store_requirements() {
    log "Checking app store requirements..."
    
    # Check for store metadata
    if [[ -d "store-assets" ]]; then
        pass "Store assets directory exists"
        
        if [[ -f "store-assets/ios/metadata/app-store-info.json" ]]; then
            pass "iOS app store metadata configured"
        else
            warn "iOS app store metadata not configured"
        fi
        
        if [[ -f "store-assets/android/metadata/play-store-info.json" ]]; then
            pass "Android app store metadata configured"
        else
            warn "Android app store metadata not configured"
        fi
    else
        warn "Store assets directory not found"
    fi
    
    # Check for privacy policy
    local privacy_urls=$(jq -r '.expo.ios.infoPlist.NSPrivacyPolicyURL // "not-found"' app.json 2>/dev/null)
    if [[ "$privacy_urls" != "not-found" ]] && [[ "$privacy_urls" != "null" ]]; then
        pass "Privacy policy URL configured"
    else
        fail "Privacy policy URL not configured (required for app store)"
    fi
}

# Generate final report
generate_report() {
    echo ""
    echo "=================================================="
    echo -e "${CYAN}📋 STELLR PRE-DEPLOYMENT CHECKLIST REPORT${NC}"
    echo "=================================================="
    echo ""
    echo -e "${BLUE}📊 SUMMARY${NC}"
    echo "  Total Checks: $TOTAL_CHECKS"
    echo -e "  ${GREEN}Passed: $PASSED_CHECKS${NC}"
    echo -e "  ${RED}Failed: $FAILED_CHECKS${NC}"
    echo -e "  ${YELLOW}Warnings: $WARNING_CHECKS${NC}"
    echo ""
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}🎉 READY FOR DEPLOYMENT!${NC}"
        echo "All critical checks passed. You may proceed with production deployment."
    else
        echo -e "${RED}❌ NOT READY FOR DEPLOYMENT${NC}"
        echo "Please fix the following issues before deploying:"
        echo ""
        for item in "${FAILED_ITEMS[@]}"; do
            echo -e "${RED}  • $item${NC}"
        done
    fi
    
    if [[ $WARNING_CHECKS -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}⚠️  WARNINGS TO REVIEW:${NC}"
        for item in "${WARNING_ITEMS[@]}"; do
            echo -e "${YELLOW}  • $item${NC}"
        done
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

# Main function
main() {
    echo -e "${CYAN}🚀 Stellr Pre-Deployment Checklist${NC}"
    echo "=================================================="
    echo ""
    
    # Configuration Files
    log "Checking configuration files..."
    check "app.json configuration"
    check_app_config
    
    check "EAS configuration"
    check_eas_config
    
    check "Package.json configuration"
    check_package_config
    
    # Environment Configuration
    log "Checking environment configuration..."
    check "Production environment file"
    check_env_vars ".env.production"
    
    check "Environment example file"
    check_file ".env.example" "Environment example file"
    
    # Assets and Resources
    log "Checking assets and resources..."
    check "Required asset files"
    check_assets
    
    # Credentials and Security
    log "Checking credentials and security..."
    check "Credentials configuration"
    check_credentials
    
    # Dependencies
    check "Dependencies and security"
    check_dependencies
    
    # Build Tools
    check "Build tools"
    check_build_tools
    
    # Store Requirements
    check "App store requirements"
    check_store_requirements
    
    # Directory Structure
    log "Checking directory structure..."
    check "Required directories"
    check_directory "assets/images" "Assets directory"
    check_directory "credentials" "Credentials directory"
    check_directory "store-assets" "Store assets directory"
    
    # Generate final report
    generate_report
}

# Run main function
main "$@"
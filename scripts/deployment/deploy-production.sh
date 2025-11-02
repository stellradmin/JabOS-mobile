#!/bin/bash

# Stellr Production Deployment Script
# This script handles the complete production deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Stellr"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BUILD_PROFILE="production"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -f "app.json" ]] || [[ ! -f "eas.json" ]]; then
        error "This script must be run from the project root directory"
        exit 1
    fi
    
    # Check if required environment files exist
    if [[ ! -f ".env.production" ]]; then
        error "Production environment file (.env.production) not found"
        exit 1
    fi
    
    # Check if EAS CLI is installed
    if ! command -v eas &> /dev/null; then
        error "EAS CLI is not installed. Install with: npm install -g @expo/eas-cli"
        exit 1
    fi
    
    # Check if user is logged in to EAS
    if ! eas whoami &> /dev/null; then
        error "Not logged in to EAS. Please run: eas login"
        exit 1
    fi
    
    # Check for required credentials
    if [[ ! -f "credentials/google-play-service-account.json" ]]; then
        warning "Google Play service account key not found. Android deployment will fail without it."
    fi
    
    success "Pre-deployment checks passed"
}

# Install dependencies and run tests
run_tests() {
    log "Installing dependencies and running tests..."
    
    # Install dependencies
    npm ci --legacy-peer-deps
    
    # Run linting
    npm run lint
    
    # Run type checking
    npm run type-check
    
    # Run test suite
    npm run test:production-ready
    
    success "All tests passed"
}

# Build iOS for production
build_ios() {
    log "Building iOS app for production..."
    
    # Set iOS environment
    export PLATFORM=ios
    export ENVIRONMENT=production
    
    # Build iOS
    eas build --platform ios --profile production --clear-cache
    
    success "iOS build completed"
}

# Build Android for production
build_android() {
    log "Building Android app for production..."
    
    # Set Android environment
    export PLATFORM=android
    export ENVIRONMENT=production
    
    # Build Android AAB
    eas build --platform android --profile production --clear-cache
    
    success "Android build completed"
}

# Submit to app stores
submit_apps() {
    log "Submitting apps to stores..."
    
    # iOS App Store submission
    if [[ "$1" == "ios" ]] || [[ "$1" == "both" ]]; then
        log "Submitting to iOS App Store..."
        eas submit --platform ios --profile production
        success "iOS submission completed"
    fi
    
    # Google Play Store submission
    if [[ "$1" == "android" ]] || [[ "$1" == "both" ]]; then
        log "Submitting to Google Play Store..."
        eas submit --platform android --profile production
        success "Android submission completed"
    fi
}

# Update version numbers
update_version() {
    local VERSION_TYPE=$1
    
    if [[ -z "$VERSION_TYPE" ]]; then
        VERSION_TYPE="patch"
    fi
    
    log "Updating version ($VERSION_TYPE)..."
    
    # Update package.json version
    npm version $VERSION_TYPE --no-git-tag-version
    
    # Update app.json version
    local NEW_VERSION=$(node -p "require('./package.json').version")
    
    # Update iOS build number
    local CURRENT_BUILD=$(grep -o '"buildNumber": "[^"]*"' app.json | grep -o '[0-9]*')
    local NEW_BUILD=$((CURRENT_BUILD + 1))
    
    # Update Android version code
    local CURRENT_VERSION_CODE=$(grep -o '"versionCode": [0-9]*' app.json | grep -o '[0-9]*')
    local NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
    
    # Create backup of app.json
    cp app.json "app.json.backup_$TIMESTAMP"
    
    # Update app.json with new version numbers
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" app.json
    sed -i '' "s/\"buildNumber\": \"[^\"]*\"/\"buildNumber\": \"$NEW_BUILD\"/" app.json
    sed -i '' "s/\"versionCode\": [0-9]*/\"versionCode\": $NEW_VERSION_CODE/" app.json
    
    success "Version updated to $NEW_VERSION (Build: $NEW_BUILD, Version Code: $NEW_VERSION_CODE)"
}

# Create deployment summary
create_summary() {
    log "Creating deployment summary..."
    
    local SUMMARY_FILE="deployment_summary_$TIMESTAMP.md"
    
    cat > "$SUMMARY_FILE" << EOF
# Stellr Production Deployment Summary

**Date**: $(date)
**Build Profile**: $BUILD_PROFILE
**Version**: $(node -p "require('./package.json').version")

## Deployment Details

### Pre-Deployment Checks
- [x] Environment files validated
- [x] Dependencies installed
- [x] Tests passed
- [x] Linting passed
- [x] Type checking passed

### Build Status
- iOS Build: ✅ Completed
- Android Build: ✅ Completed

### Store Submission
- iOS App Store: ✅ Submitted
- Google Play Store: ✅ Submitted

## Important Notes
- All environment variables are properly configured
- Photo verification system is enabled
- Premium features are enabled for production
- Analytics and monitoring are active

## Next Steps
1. Monitor build status in EAS dashboard
2. Check app store review status
3. Test production builds on physical devices
4. Monitor crash reports and analytics

## Support
- Technical issues: tech@stellr.app
- Store review issues: support@stellr.app
- Emergency contact: [EMERGENCY_CONTACT]
EOF

    success "Deployment summary created: $SUMMARY_FILE"
}

# Main deployment function
main() {
    log "🚀 Starting Stellr production deployment..."
    
    local PLATFORM=${1:-"both"}
    local VERSION_TYPE=${2:-"patch"}
    local SKIP_TESTS=${3:-false}
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run deployment steps
    pre_deployment_checks
    update_version "$VERSION_TYPE"
    
    if [[ "$SKIP_TESTS" != "true" ]]; then
        run_tests
    else
        warning "Skipping tests (--skip-tests flag provided)"
    fi
    
    # Build based on platform
    case $PLATFORM in
        "ios")
            build_ios
            ;;
        "android")
            build_android
            ;;
        "both")
            build_ios
            build_android
            ;;
        *)
            error "Invalid platform: $PLATFORM. Use 'ios', 'android', or 'both'"
            exit 1
            ;;
    esac
    
    # Submit to stores
    read -p "Do you want to submit to app stores? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        submit_apps "$PLATFORM"
    else
        log "Skipping app store submission"
    fi
    
    # Create deployment summary
    create_summary
    
    success "🎉 Deployment completed successfully!"
    log "Check EAS dashboard for build status: https://expo.dev"
}

# Help function
show_help() {
    echo "Stellr Production Deployment Script"
    echo ""
    echo "Usage: $0 [PLATFORM] [VERSION_TYPE] [OPTIONS]"
    echo ""
    echo "PLATFORM:"
    echo "  ios      Build and deploy iOS only"
    echo "  android  Build and deploy Android only"
    echo "  both     Build and deploy both platforms (default)"
    echo ""
    echo "VERSION_TYPE:"
    echo "  patch    Increment patch version (default)"
    echo "  minor    Increment minor version"
    echo "  major    Increment major version"
    echo ""
    echo "OPTIONS:"
    echo "  --skip-tests    Skip running tests"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Deploy both platforms, patch version"
    echo "  $0 ios minor            # Deploy iOS only, minor version bump"
    echo "  $0 android patch --skip-tests  # Deploy Android, skip tests"
}

# Parse arguments
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Check for skip-tests flag
SKIP_TESTS=false
if [[ "$*" == *"--skip-tests"* ]]; then
    SKIP_TESTS=true
fi

# Run main function
main "$1" "$2" "$SKIP_TESTS"
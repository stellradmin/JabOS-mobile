#!/bin/bash

# Environment Variable Verification Script for Stellr
# This script checks if all required environment variables are properly configured

set -e

echo "🔍 Stellr Environment Variable Verification"
echo "==========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for issues
ISSUES=0

# Function to check if variable exists and is not a placeholder
check_var() {
    local var_name=$1
    local required=${2:-true}
    local value="${!var_name}"

    if [ -z "$value" ]; then
        if [ "$required" = true ]; then
            echo -e "${RED}✗${NC} $var_name is missing (required)"
            ((ISSUES++))
        else
            echo -e "${YELLOW}⚠${NC} $var_name is missing (optional)"
        fi
    elif [[ "$value" == *"[YOUR_"* ]] || [[ "$value" == *"[SUPABASE_"* ]] || [[ "$value" == *"[STRIPE_"* ]]; then
        echo -e "${RED}✗${NC} $var_name contains placeholder value"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓${NC} $var_name is set"
    fi
}

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading variables from .env file..."
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
    echo -e "${YELLOW}⚠${NC} No .env file found"
    echo ""
fi

echo ""
echo "📱 Required Client Variables (EXPO_PUBLIC_*):"
echo "----------------------------------------------"

check_var "EXPO_PUBLIC_SUPABASE_URL" true
check_var "EXPO_PUBLIC_SUPABASE_ANON_KEY" true
check_var "EXPO_PUBLIC_APP_ENV" true

echo ""
echo "💳 Stripe Configuration:"
echo "------------------------"

check_var "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" false
check_var "EXPO_PUBLIC_STRIPE_ENABLED" false

echo ""
echo "🎯 Feature Flags:"
echo "----------------"

check_var "EXPO_PUBLIC_STRICT_SECURITY" false

echo ""
echo "📊 Analytics & Monitoring:"
echo "-------------------------"

check_var "EXPO_PUBLIC_POSTHOG_HOST" false
check_var "EXPO_PUBLIC_SENTRY_ENABLED" false

echo ""
echo "=========================================="

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All required variables are properly configured!${NC}"
    echo ""
    echo "You can now run:"
    echo "  • npm start (for local development)"
    echo "  • npx eas build --profile development (for development build)"
    echo "  • npx eas build --profile production (for production build)"
    exit 0
else
    echo -e "${RED}❌ Found $ISSUES issue(s) with environment variables${NC}"
    echo ""
    echo "To fix:"
    echo "  1. Copy .env.example to .env: cp .env.example .env"
    echo "  2. Fill in the required values"
    echo "  3. Run this script again to verify"
    echo ""
    echo "For EAS builds, also set secrets:"
    echo "  npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value \"...\""
    echo ""
    echo "See ENV_SETUP_GUIDE.md for detailed instructions"
    exit 1
fi

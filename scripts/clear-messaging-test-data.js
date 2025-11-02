#!/usr/bin/env node
/**
 * Clear Messaging Test Data by seedId
 *
 * Removes fake users, profiles, conversations, and messages created
 * by seed-messaging-test-data.js. Requires SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   node scripts/clear-messaging-test-data.js <seedId>
 *   # or omit seedId to auto-detect the latest manifest
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load env from repo root .env and from stellr-frontend/.env if present
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
const appEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(appEnv)) dotenv.config({ path: appEnv });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL in environment.');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY. This script requires the service role key to delete test users safely.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const manifestDir = path.resolve(__dirname, '.seed-manifests');
let seedId = process.argv[2];

function findLatestManifest() {
  if (!fs.existsSync(manifestDir)) return null;
  const files = fs.readdirSync(manifestDir).filter(f => f.endsWith('.json'));
  if (!files.length) return null;
  files.sort();
  return path.join(manifestDir, files[files.length - 1]);
}

async function main() {
  let manifestPath;
  if (!seedId) {
    manifestPath = findLatestManifest();
    if (!manifestPath) {
      console.error('❌ No manifest found and no seedId provided.');
      process.exit(1);
    }
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    seedId = parsed.seedId;
  } else {
    manifestPath = path.join(manifestDir, `${seedId}.json`);
    if (!fs.existsSync(manifestPath)) {
      console.error(`❌ Manifest not found for seedId ${seedId}: ${manifestPath}`);
      process.exit(1);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`🧹 Cleaning messaging test data (seedId=${seedId})...`);

  // 1) Delete messages for the recorded conversations
  if (manifest.conversations?.length) {
    const convIds = manifest.conversations.map(c => c.id);
    // Delete messages in batches
    for (const id of convIds) {
      await supabase.from('messages').delete().eq('conversation_id', id);
    }
    // Then delete conversations
    await supabase.from('conversations').delete().in('id', convIds);
    console.log(`  ✔ Removed ${convIds.length} conversations and their messages`);
  }

  // 2) Delete profiles for these users
  if (manifest.users?.length) {
    const userIds = manifest.users.map(u => u.id);
    await supabase.from('profiles').delete().in('id', userIds);
    console.log(`  ✔ Removed ${userIds.length} profiles`);

    // 3) Delete auth users via admin API
    for (const uid of userIds) {
      await supabase.auth.admin.deleteUser(uid);
    }
    console.log(`  ✔ Removed ${userIds.length} auth users`);
  }

  // 4) Remove manifest
  try {
    fs.unlinkSync(manifestPath);
  } catch {}

  console.log('\n✅ Cleanup complete.');
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err?.message || err);
  process.exit(1);
});


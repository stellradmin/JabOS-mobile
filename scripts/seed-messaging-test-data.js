#!/usr/bin/env node
/**
 * Seed Messaging Test Data (Safe, Removable)
 *
 * Creates a handful of fake users, profiles, conversations and messages
 * tagged with a unique seed ID so you can cleanly remove them later.
 *
 * Requirements:
 * - Environment variables (read from repo .env by default):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (server-side key; DO NOT COMMIT)
 *
 * Usage:
 *   node scripts/seed-messaging-test-data.js [count]
 *   # count = number of fake users to create (default 5)
 *
 * Cleanup:
 *   node scripts/clear-messaging-test-data.js <seedId>
 */

const path = require('path');
const fs = require('fs');
const { faker } = require('@faker-js/faker');
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
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY. This script requires the service role key to create test users safely.');
  console.error('   Set it locally (never commit) and try again.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const LINK_WITH_USER_ID = process.env.SEED_WITH_USER_ID || '';
const CONVOS_FOR_USER_ID = process.env.CONVOS_FOR_USER_ID || '';
const PRESENT_FOR_USER_ID = process.env.PRESENT_FOR_USER_ID || '';

const USERS_COUNT = Math.max(2, parseInt(process.argv[2] || '5', 10));
const seedId = `SEED-${Date.now()}`;
const manifestDir = path.resolve(__dirname, '.seed-manifests');
const manifestPath = path.join(manifestDir, `${seedId}.json`);

async function createAuthUserWithProfile() {
  // Create an auth user via admin API (email confirmed)
  const email = faker.internet.email({ provider: 'stellr.test' }).toLowerCase().replace(/\s/g, '');
  const password = faker.internet.password({ length: 12 });

  const { data: userRes, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { seedId },
  });
  if (createErr || !userRes?.user) throw new Error(`Create user failed: ${createErr?.message}`);
  const authUser = userRes.user;

  // Upsert profile row (profiles.id references auth.users(id))
  const profile = {
    id: authUser.id,
    display_name: faker.person.firstName() + ' ' + faker.person.lastName(),
    bio: faker.lorem.sentence(),
    avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(authUser.email || authUser.id)}`,
    zodiac_sign: faker.helpers.arrayElement(['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']),
    age: faker.number.int({ min: 21, max: 45 }),
    onboarding_completed: true,
    app_settings: { test_seed_id: seedId },
    updated_at: new Date().toISOString(),
  };

  const { error: profileErr } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
  if (profileErr) throw new Error(`Upsert profile failed: ${profileErr.message}`);

  return { authUser, profile };
}

async function insertConversation(u1, u2) {
  // Try inserting with common column names used across code branches
  const base = {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_message_at: null,
    last_message_content: null,
  };

  // Attempt user1_id/user2_id first
  let convInsert = { ...base, user1_id: u1, user2_id: u2 };
  let ins = await supabase.from('conversations').insert(convInsert).select('*').single();
  if (ins.error) {
    // Fallback to participant_1_id/participant_2_id
    convInsert = { ...base, participant_1_id: u1, participant_2_id: u2 };
    ins = await supabase.from('conversations').insert(convInsert).select('*').single();
  }
  if (ins.error) throw new Error(`Insert conversation failed: ${ins.error.message}`);
  return ins.data;
}

async function insertMessages(conversationId, senders) {
  const now = Date.now();
  const messages = [
    { content: 'Hey! Excited to plan something?', t: 0 },
    { content: 'Absolutely! How does Friday evening look?', t: 1 },
    { content: 'Perfect. 7pm at the cafe on Main St?', t: 2 },
    { content: 'Sounds great — see you then! 🎉', t: 3 },
  ].map((m, idx) => ({
    conversation_id: conversationId,
    sender_id: senders[idx % 2],
    content: m.content,
    created_at: new Date(now + m.t * 60000).toISOString(),
  }));

  const { error } = await supabase.from('messages').insert(messages);
  if (error) throw new Error(`Insert messages failed: ${error.message}`);

  const last = messages[messages.length - 1];
  await supabase
    .from('conversations')
    .update({ last_message_at: last.created_at, last_message_content: last.content, updated_at: last.created_at })
    .eq('id', conversationId);
}

async function main() {
  console.log(`🧪 Seeding messaging test data (seedId=${seedId}) for ${USERS_COUNT} users...`);
  if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true });

  const created = [];
  for (let i = 0; i < USERS_COUNT; i++) {
    const r = await createAuthUserWithProfile();
    created.push({ id: r.authUser.id, email: r.authUser.email });
    console.log(`  ✔ Created test user ${i + 1}: ${r.authUser.email}`);
  }

  // Optionally create one-way likes from seeded users to a real user, so they show as potential matches
  if (PRESENT_FOR_USER_ID) {
    console.log(`  ⭐ Marking ${created.length} seeded users as liking PRESENT_FOR_USER_ID=${PRESENT_FOR_USER_ID}`);
    for (const u of created) {
      try {
        await supabase.from('swipes').insert({
          swiper_id: u.id,
          swiped_id: PRESENT_FOR_USER_ID,
          swipe_type: 'like',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('    ⚠️  Failed to insert swipe (seed->real):', e?.message || e);
      }
    }
  }

  // Create a few conversations (pair consecutive users)
  const convs = [];
  for (let i = 0; i < created.length - 1; i++) {
    const u1 = created[i].id;
    const u2 = created[i + 1].id;
    const conv = await insertConversation(u1, u2);
    await insertMessages(conv.id, [u1, u2]);
    convs.push({ id: conv.id, users: [u1, u2] });
    console.log(`  💬 Conversation created between ${created[i].email} and ${created[i + 1].email}`);
  }

  const manifest = { seedId, users: created, conversations: convs };
  // Optionally link the first seeded user with a real user id to validate UI in your account
  if (LINK_WITH_USER_ID && created[0]) {
    try {
      const realUserId = LINK_WITH_USER_ID;
      const seededUserId = created[0].id;
      const conv = await insertConversation(seededUserId, realUserId);
      await insertMessages(conv.id, [seededUserId, realUserId]);
      manifest.conversations.push({ id: conv.id, users: [seededUserId, realUserId], linkedToRealUser: true });
      console.log(`  🔗 Linked seeded user ${created[0].email} with real user ${realUserId}`);
    } catch (e) {
      console.warn('  ⚠️  Could not create a linked conversation with SEED_WITH_USER_ID:', e?.message || e);
    }
  }

  // Optionally create conversations for ALL seeded users with a specific real user (so Messages UI is populated)
  if (CONVOS_FOR_USER_ID) {
    console.log(`  💬 Creating conversations between ${created.length} seeded users and CONVOS_FOR_USER_ID=${CONVOS_FOR_USER_ID}`);
    for (const u of created) {
      try {
        const conv = await insertConversation(u.id, CONVOS_FOR_USER_ID);
        await insertMessages(conv.id, [u.id, CONVOS_FOR_USER_ID]);
        manifest.conversations.push({ id: conv.id, users: [u.id, CONVOS_FOR_USER_ID], linkedToRealUser: true });
      } catch (e) {
        console.warn('  ⚠️  Failed to create seeded conversation with real user:', e?.message || e);
      }
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`
✅ Done. Manifest written to: ${manifestPath}
ℹ️  To remove: node scripts/clear-messaging-test-data.js ${seedId}
`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err?.message || err);
  process.exit(1);
});

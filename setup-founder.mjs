import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ggnwtszeitrrfhedgipv.supabase.co';
const supabaseAnonKey = 'sb_publishable_he8qnS-M5-uDmTVGkinzWw_39yD0BOO';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL = 'aminefjer@protonmail.com';
const PASSWORD = '@mine3820';

async function setup() {
  console.log('🔧 Setting up founder account...');
  console.log(`   Email: ${EMAIL}`);
  console.log(`   Password: ${'*'.repeat(PASSWORD.length)}`);
  console.log('');

  // Step 1: Try to sign up
  console.log('Step 1: Signing up...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: {
      data: { first_name: 'Amine', last_name: 'FJER' }
    }
  });

  if (signUpError) {
    if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
      console.log('   ℹ️  User already exists, will try to sign in instead.');
    } else {
      console.log('   ⚠️  Sign up error:', signUpError.message);
      console.log('   Trying to sign in with existing account...');
    }
  } else {
    console.log('   ✅ Sign up successful! User ID:', signUpData.user?.id);
  }

  // Step 2: Sign in to get the user ID
  console.log('Step 2: Signing in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (signInError) {
    console.log('   ❌ Sign in error:', signInError.message);
    console.log('');
    console.log('   Note: If email confirmation is required, check your inbox.');
    console.log('   The account was created but needs email verification.');
    
    // Still try to upsert with the signup user ID if we have it
    if (signUpData?.user?.id) {
      console.log('   Using signup user ID to set founder role...');
      const { error: upsertError } = await supabase.from('users').upsert({
        id: signUpData.user.id,
        email: EMAIL,
        first_name: 'Amine',
        last_name: 'FJER',
        role: 'founder',
        tokens: 999999,
      });
      if (upsertError) {
        console.log('   ❌ Upsert error:', upsertError.message);
      } else {
        console.log('   ✅ Founder role set successfully!');
      }
    }
    return;
  }

  const userId = signInData.user.id;
  console.log('   ✅ Signed in! User ID:', userId);

  // Step 3: Upsert user profile with founder role
  console.log('Step 3: Setting founder role...');
  const { error: upsertError } = await supabase.from('users').upsert({
    id: userId,
    email: EMAIL,
    first_name: 'Amine',
    last_name: 'FJER',
    role: 'founder',
    tokens: 999999,
  });

  if (upsertError) {
    console.log('   ❌ Profile update error:', upsertError.message);
  } else {
    console.log('   ✅ Founder profile configured!');
  }

  // Step 4: Verify
  console.log('Step 4: Verifying...');
  const { data: profile } = await supabase.from('users').select('*').eq('id', userId).single();
  if (profile) {
    console.log('   ✅ Profile verified:');
    console.log(`      Name: ${profile.first_name} ${profile.last_name}`);
    console.log(`      Email: ${profile.email}`);
    console.log(`      Role: ${profile.role}`);
    console.log(`      Tokens: ${profile.tokens}`);
  }

  console.log('');
  console.log('🎉 Done! You can now log in at http://localhost:3000/auth');
  console.log(`   Email: ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
}

setup().catch(console.error);

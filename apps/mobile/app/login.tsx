import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '@/components/ui';
import { signInWithIdentifier } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    const uname = username.trim().toLowerCase();
    if (mode === 'signup' && !/^[a-z0-9_.]{3,20}$/.test(uname)) {
      return setMsg({ kind: 'error', text: 'Usernames are 3–20 characters: letters, numbers, dots or underscores (no spaces).' });
    }
    if (mode === 'signup' && password.length < 8) {
      return setMsg({ kind: 'error', text: 'Use at least 8 characters for your password.' });
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const err = await signInWithIdentifier(email, password);
        if (err) return setMsg({ kind: 'error', text: err });
        router.back();
      } else {
        const { data: free } = await supabase.rpc('username_available', { u: uname });
        if (!free) return setMsg({ kind: 'error', text: `The username “${uname}” is taken. Try another one.` });
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() || undefined, username: uname } },
        });
        if (error) {
          if (/rate limit/i.test(error.message)) return setMsg({ kind: 'error', text: 'Too many sign-up emails in the last hour. Please try again later.' });
          return setMsg({ kind: 'error', text: error.message });
        }
        if (!data.session) return setMsg({ kind: 'ok', text: 'Check your email for the GLE Movies confirmation, then sign in with your username or email.' });
        router.back();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}><Text style={{ color: colors.accent }}>GLE</Text> MOVIES</Text>
        <Text style={styles.h1}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
        <Text style={styles.sub}>
          {mode === 'signin' ? 'Sign in to sync your watchlist and progress.' : 'Free to join. Watch free films with ads.'}
        </Text>
        {msg && (
          <Text style={[styles.msg, { color: msg.kind === 'error' ? colors.danger : colors.ok }]} accessibilityLiveRegion="polite">
            {msg.text}
          </Text>
        )}
        {mode === 'signup' && (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} autoComplete="name" placeholderTextColor={colors.faint} />
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
              maxLength={20}
              placeholder="e.g. abdul_ug"
              placeholderTextColor={colors.faint}
            />
          </>
        )}
        <Text style={styles.label}>{mode === 'signin' ? 'Email or username' : 'Email'}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'signin' ? 'username' : 'email'}
          keyboardType={mode === 'signin' ? 'default' : 'email-address'}
          placeholderTextColor={colors.faint}
          placeholder={mode === 'signin' ? 'Email or username' : 'you@example.com'}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          onSubmitEditing={submit}
        />
        <Button
          label={busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={submit}
          disabled={busy}
          style={{ marginTop: 8 }}
        />
        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ marginTop: 20 }}>
          <Text style={styles.switch}>
            {mode === 'signin' ? 'New here? ' : 'Have an account? '}
            <Text style={{ color: colors.accent, fontFamily: F.bold }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 12 },
  brand: { color: colors.text, fontFamily: F.extrabold, fontSize: 18, letterSpacing: 2, marginBottom: 28 },
  h1: { color: colors.text, fontFamily: F.bold, fontSize: 28 },
  sub: { color: colors.muted, fontFamily: F.regular, fontSize: 14, marginTop: 6, marginBottom: 26 },
  msg: { marginBottom: 14, fontFamily: F.medium, fontSize: 14 },
  label: { color: colors.muted, fontFamily: F.semibold, fontSize: 13, marginBottom: 8 },
  input: {
    height: 52, borderRadius: radius.md, backgroundColor: colors.raised,
    color: colors.text, paddingHorizontal: 16, marginBottom: 18, fontSize: 15, fontFamily: F.medium,
  },
  switch: { color: colors.muted, fontFamily: F.regular, textAlign: 'center' },
});

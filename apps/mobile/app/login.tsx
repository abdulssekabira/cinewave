import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (mode === 'signup' && password.length < 8) {
      return setMsg({ kind: 'error', text: 'Use at least 8 characters for your password.' });
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return setMsg({ kind: 'error', text: 'Incorrect email or password.' });
        router.back();
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) return setMsg({ kind: 'error', text: error.message });
        if (!data.session) return setMsg({ kind: 'ok', text: 'Check your email to confirm, then sign in.' });
        router.back();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.wrap}>
      <Text style={styles.h1}>{mode === 'signin' ? 'Welcome back' : 'Create account'}</Text>
      <Text style={styles.sub}>
        {mode === 'signin' ? 'Sign in to sync your list and progress.' : 'Free to join. Watch free titles with ads.'}
      </Text>
      {msg && (
        <Text style={[styles.msg, { color: msg.kind === 'error' ? colors.danger : colors.ok }]} accessibilityLiveRegion="polite">
          {msg.text}
        </Text>
      )}
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholderTextColor={colors.faint}
        placeholder="you@example.com"
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
      <Button label={busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} disabled={busy} style={{ marginTop: 8 }} />
      <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ marginTop: 18 }}>
        <Text style={styles.switch}>
          {mode === 'signin' ? 'New here? ' : 'Have an account? '}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</Text>
        </Text>
      </Pressable>
      <View style={{ flex: 1 }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  h1: { color: colors.text, fontFamily: fonts.display, fontSize: 30, fontWeight: '700' },
  sub: { color: colors.muted, marginTop: 6, marginBottom: 24 },
  msg: { marginBottom: 14, fontSize: 14 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 14,
    marginBottom: 16,
    fontSize: 15,
  },
  switch: { color: colors.muted, textAlign: 'center' },
});

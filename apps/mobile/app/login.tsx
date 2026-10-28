import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() || undefined } },
        });
        if (error) return setMsg({ kind: 'error', text: error.message });
        if (!data.session) return setMsg({ kind: 'ok', text: 'Check your email to confirm, then sign in.' });
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
          </>
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

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import { GlassCard, Button, ErrorBanner } from '../components/ui';

type Mode = 'login' | 'signup' | 'forgot' | 'update_password';

export function Login() {
  const { isRecoveryMode, initialize } = useAppStore();
  const [mode, setMode] = useState<Mode>(isRecoveryMode ? 'update_password' : 'login');

  // Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isRecoveryMode || window.location.hash.includes('type=recovery')) {
      setMode('update_password');
    }
  }, [isRecoveryMode]);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    resetMessages();
    setPassword('');
    setConfirmPassword('');
  };

  /* ── 1. Direct Email + Password Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Invalid email or password. Please verify and try again.');
        } else if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setError('Email not confirmed yet. Please verify your email or check Supabase settings.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (data.user) {
        await initialize();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── 2. Create Account (Name + Email + Password) ── */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user && !data.session) {
        setSuccess('Account created. Check your email to confirm your account, or sign in if confirmation is disabled.');
      } else if (data.session) {
        await initialize();
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── 3. Forgot Password / Reset Link ── */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/#type=recovery`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess('Password reset link sent! Please check your inbox.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  /* ── 4. Set New Password ── */
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess('Password updated successfully. Logging you in…');
        setTimeout(async () => {
          window.location.hash = '';
          await initialize();
        }, 1500);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('auth session missing')) {
        setError('Recovery link expired or already used. Please request a new reset email.');
      } else {
        setError(msg || 'Failed to update password. Link may have expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }} className="animate-fade-in">
        {/* Brand Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src="/skibidi-logo.png"
            alt="SKIBIDII"
            style={{
              height: 52,
              maxWidth: 220,
              objectFit: 'contain',
              marginBottom: '0.45rem',
              filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.06))',
            }}
          />
          <p
            style={{
              color: '#86868b',
              margin: 0,
              fontSize: '0.86rem',
              letterSpacing: '-0.01em',
            }}
          >
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'signup' && 'Create your account to get started'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'update_password' && 'Enter your new password'}
          </p>
        </div>

        {/* Apple Segmented Control Switcher (Sign In / Create Account) */}
        {(mode === 'login' || mode === 'signup') && (
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: 9999,
              padding: 3,
              marginBottom: '1rem',
            }}
          >
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0',
                  borderRadius: 9999,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  letterSpacing: '-0.01em',
                  transition: 'all 200ms ease',
                  background: mode === m ? '#ffffff' : 'transparent',
                  color: mode === m ? '#1d1d1f' : '#86868b',
                  boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        )}

        <GlassCard padding="lg">
          {/* ── Form: Login ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <p className="section-label" style={{ marginBottom: '0.35rem' }}>
                  Email
                </p>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="glass-input"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <p className="section-label" style={{ margin: 0 }}>
                    Password
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#0071e3',
                      fontSize: '0.76rem',
                      fontWeight: 500,
                      padding: 0,
                    }}
                  >
                    Forgot?
                  </button>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <img
                    src="/skibidi-icon.png"
                    alt="key"
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      opacity: 0.85,
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="glass-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#86868b',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <ErrorBanner message={error} />}
              {success && <SuccessBanner message={success} />}

              <Button type="submit" size="lg" isLoading={loading} style={{ width: '100%', marginTop: '0.35rem' }}>
                Sign In
              </Button>
            </form>
          )}

          {/* ── Form: Signup ── */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <p className="section-label" style={{ marginBottom: '0.35rem' }}>
                  Full Name
                </p>
                <input
                  type="text"
                  placeholder="Rahul Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="glass-input"
                />
              </div>

              <div>
                <p className="section-label" style={{ marginBottom: '0.35rem' }}>
                  Email
                </p>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="glass-input"
                />
              </div>

              <div>
                <p className="section-label" style={{ marginBottom: '0.35rem' }}>
                  Password
                </p>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <img
                    src="/skibidi-icon.png"
                    alt="key"
                    style={{
                      position: 'absolute',
                      left: '0.85rem',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      opacity: 0.85,
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="glass-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#86868b',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#86868b' }}>
                  Must be at least 6 characters
                </p>
              </div>

              {error && <ErrorBanner message={error} />}
              {success && <SuccessBanner message={success} />}

              <Button type="submit" size="lg" isLoading={loading} style={{ width: '100%', marginTop: '0.35rem' }}>
                Create Account
              </Button>
            </form>
          )}

          {/* ── Form: Forgot Password ── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#6e6e73', lineHeight: 1.45 }}>
                Enter your registered email address to receive a secure password reset link.
              </p>

              <div>
                <p className="section-label" style={{ marginBottom: '0.35rem' }}>
                  Email
                </p>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="glass-input"
                />
              </div>

              {error && <ErrorBanner message={error} />}
              {success && <SuccessBanner message={success} />}

              <Button type="submit" size="lg" isLoading={loading} style={{ width: '100%', marginTop: '0.35rem' }}>
                Send Reset Link
              </Button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#0071e3',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  alignSelf: 'center',
                  marginTop: '0.2rem',
                }}
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* ── Form: Update Password (Reset Link Callback) ── */}
          {mode === 'update_password' && (
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#6e6e73', lineHeight: 1.45 }}>
                Enter your new password to regain access to your account.
              </p>

              <div>
                <p className="section-label" style={{ marginBottom: '0.35rem' }}>
                  New Password
                </p>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="glass-input"
                />
              </div>

              <div>
                <p className="section-label" style={{ marginBottom: '0.35rem' }}>
                  Confirm Password
                </p>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="glass-input"
                />
              </div>

              {error && <ErrorBanner message={error} />}
              {success && <SuccessBanner message={success} />}

              <Button type="submit" size="lg" isLoading={loading} style={{ width: '100%', marginTop: '0.35rem' }}>
                Save Password
              </Button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(52, 199, 89, 0.08)',
        border: '1px solid rgba(52, 199, 89, 0.18)',
        borderRadius: '0.85rem',
        padding: '0.75rem 1rem',
        color: '#28a745',
        fontSize: '0.82rem',
        lineHeight: 1.4,
        fontWeight: 500,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {message}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { GlassCard, Button, Avatar, LimeBadge, Skeleton } from '../components/ui';
import { haptics } from '../lib/haptics';

// Available Memoji avatars
const AVAILABLE_AVATARS = Array.from({ length: 10 }, (_, i) => ({
  id: `memoji-${i + 1}`,
  url: `/avatars/memoji-${i + 1}.jpg`,
  label: `Avatar ${i + 1}`,
}));

export function ProfileView() {
  const { profile, setProfile, currentGroup, signOut } = useAppStore();
  const [myCount, setMyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [usedAvatars, setUsedAvatars] = useState<Record<string, string>>({}); // avatarUrl -> studentName
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => haptics.isEnabled());

  useEffect(() => {
    if (profile?.id && currentGroup?.id) {
      loadMyStatsAndAvatars();
    } else {
      setLoading(false);
    }
  }, [profile?.id, currentGroup?.id]);

  const loadMyStatsAndAvatars = async () => {
    try {
      // 1. Load user meal count
      const { data: eventData } = await supabase
        .from('food_events')
        .select('id')
        .eq('student_id', profile!.id)
        .eq('group_id', currentGroup!.id);

      setMyCount(eventData ? eventData.length : 0);

      // 2. Load all profiles in group to check which avatars are already taken
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('user_id, profiles(*)')
        .eq('group_id', currentGroup!.id)
        .eq('active', true);

      const avatarUsage: Record<string, string> = {};
      (memberRows || []).forEach((m: any) => {
        const student = m.profiles;
        if (student && student.avatar_url && student.id !== profile!.id) {
          const cleanUrl = student.avatar_url.trim();
          avatarUsage[cleanUrl] = student.name?.split(' ')[0] || 'Member';
        }
      });
      setUsedAvatars(avatarUsage);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatar = async (avatarUrl: string) => {
    if (!profile) return;
    setAvatarError(null);

    // Double-check if taken by someone else
    if (usedAvatars[avatarUrl]) {
      haptics.medium();
      setAvatarError(`This avatar is already used by ${usedAvatars[avatarUrl]}.`);
      return;
    }

    haptics.selection();
    setSavingAvatar(true);
    try {
      // Update state in Zustand store immediately
      const updatedProfile = { ...profile, avatar_url: avatarUrl };
      setProfile(updatedProfile);
      
      // Update in Supabase / Local DB
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      haptics.success();
      // Refresh avatars usage map
      await loadMyStatsAndAvatars();
      setIsChangingAvatar(false);
    } catch (err: any) {
      console.error('Failed to update avatar:', err);
      setAvatarError(err.message || 'Failed to update avatar. Please try again.');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleToggleHaptics = () => {
    const nextVal = !hapticsEnabled;
    setHapticsEnabled(nextVal);
    haptics.setEnabled(nextVal);
    if (nextVal) {
      haptics.medium();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Profile</h1>

      {/* Profile Card */}
      <GlassCard variant="profile" padding="lg" style={{ textAlign: 'center' }}>
        {/* Profile Avatar with Apple-style edit trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              name={profile?.name || '?'}
              avatarUrl={profile?.avatar_url}
              size={88}
              style={{
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.95)',
                border: '2px solid rgba(255, 255, 255, 0.95)',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              haptics.light();
              setIsChangingAvatar(!isChangingAvatar);
              setAvatarError(null);
            }}
            style={{
              marginTop: '0.65rem',
              background: 'rgba(0, 113, 227, 0.08)',
              color: '#0071e3',
              border: '1px solid rgba(0, 113, 227, 0.16)',
              borderRadius: 9999,
              padding: '0.3rem 0.85rem',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 180ms ease',
              letterSpacing: '-0.01em',
            }}
          >
            {isChangingAvatar ? 'Cancel' : 'Choose Profile Picture'}
          </button>
        </div>

        {/* ── Avatar Selection Picker ── */}
        {isChangingAvatar && (
          <div
            className="animate-fade-in"
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              borderRadius: '1.25rem',
              padding: '1rem',
              marginBottom: '1.25rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.84rem', color: '#1d1d1f' }}>
                Select Your Avatar
              </p>
              <span style={{ fontSize: '0.72rem', color: '#86868b' }}>
                1 avatar per member
              </span>
            </div>

            {avatarError && (
              <p style={{ margin: '0 0 0.65rem', color: '#e11d48', fontSize: '0.75rem', fontWeight: 600 }}>
                {avatarError}
              </p>
            )}

            {/* Grid of 10 Memojis */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.65rem',
                justifyItems: 'center',
              }}
            >
              {AVAILABLE_AVATARS.map((av) => {
                const isCurrent = profile?.avatar_url === av.url;
                const isTakenByOther = !!usedAvatars[av.url];
                const takenByName = usedAvatars[av.url];

                return (
                  <button
                    key={av.id}
                    type="button"
                    disabled={savingAvatar || isTakenByOther}
                    onClick={() => handleSelectAvatar(av.url)}
                    title={isTakenByOther ? `Taken by ${takenByName}` : isCurrent ? 'Current Avatar' : 'Select Avatar'}
                    style={{
                      position: 'relative',
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      padding: 0,
                      border: isCurrent
                        ? '2.5px solid #0071e3'
                        : isTakenByOther
                        ? '1px dashed rgba(0, 0, 0, 0.15)'
                        : '1.5px solid rgba(0, 0, 0, 0.06)',
                      background: 'rgba(255, 255, 255, 0.95)',
                      boxShadow: isCurrent ? '0 0 0 3px rgba(0, 113, 227, 0.2)' : 'none',
                      cursor: isTakenByOther ? 'not-allowed' : 'pointer',
                      opacity: isTakenByOther ? 0.35 : 1,
                      overflow: 'hidden',
                      transition: 'all 180ms ease',
                      transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <img
                      src={av.url}
                      alt={av.label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: isTakenByOther ? 'grayscale(80%)' : 'none',
                      }}
                    />

                    {/* Badge indicator if current or taken */}
                    {isCurrent && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: '#0071e3',
                          color: '#ffffff',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          lineHeight: '13px',
                          textAlign: 'center',
                        }}
                      >
                        ✓
                      </span>
                    )}

                    {isTakenByOther && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0, 0, 0, 0.65)',
                          color: '#ffffff',
                          fontSize: '0.5rem',
                          fontWeight: 600,
                          lineHeight: '12px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          padding: '0 2px',
                        }}
                      >
                        {takenByName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.35rem', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em' }}>
          {profile?.name}
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#86868b', fontSize: '0.86rem' }}>
          {profile?.email}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <LimeBadge>{profile?.role || 'STUDENT'}</LimeBadge>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(52, 199, 89, 0.08)',
              color: '#28a745',
              border: '1px solid rgba(52, 199, 89, 0.15)',
              borderRadius: 9999,
              padding: '0.25rem 0.75rem',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
          >
            Active Member
          </span>
        </div>

        {/* Total Food Taken Metric */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            borderRadius: '1rem',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.2rem',
          }}
        >
          <p className="section-label" style={{ margin: 0 }}>Total Food Taken</p>
          {loading ? (
            <Skeleton style={{ width: 80, height: 36 }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span className="doto-num" style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1d1d1f' }}>
                {myCount ?? 0}
              </span>
              <span style={{ color: '#86868b', fontWeight: 500, fontSize: '0.9rem' }}>
                {myCount === 1 ? 'time' : 'times'}
              </span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Preferences: Haptic Feedback ── */}
      <GlassCard padding="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.92rem', color: '#1d1d1f', letterSpacing: '-0.01em' }}>
            Haptic Feedback
          </p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.74rem', color: '#86868b' }}>
            Vibrate and acoustic micro-taps on taps and actions
          </p>
        </div>

        {/* Apple Style iOS Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={hapticsEnabled}
          aria-label="Toggle haptic feedback"
          onClick={handleToggleHaptics}
          style={{
            width: 48,
            height: 28,
            borderRadius: 9999,
            background: hapticsEnabled ? '#34c759' : 'rgba(0, 0, 0, 0.12)',
            border: 'none',
            padding: 2,
            cursor: 'pointer',
            transition: 'background-color 200ms ease',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.18)',
              transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              transform: hapticsEnabled ? 'translateX(20px)' : 'translateX(0px)',
            }}
          />
        </button>
      </GlassCard>

      {/* Logout button */}
      <Button
        variant="secondary"
        onClick={() => {
          haptics.light();
          signOut();
        }}
        style={{
          width: '100%',
          color: '#e11d48',
          borderColor: 'rgba(225, 29, 72, 0.15)',
          background: 'rgba(255, 255, 255, 0.65)',
        }}
      >
        Sign Out
      </Button>
    </div>
  );
}

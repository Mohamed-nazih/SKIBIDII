import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { GlassCard, Avatar, LimeBadge, Skeleton } from '../components/ui';
import { haptics } from '../lib/haptics';
import type { StudentFoodStat } from '../types';

export function RoundView() {
  const { currentGroup, profile } = useAppStore();
  const [students, setStudents] = useState<StudentFoodStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'least' | 'most'>('least');

  useEffect(() => {
    if (currentGroup) {
      loadStudents();
    }
  }, [currentGroup]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel('roundview-food-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_events' }, () => {
        loadStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const loadStudents = async () => {
    if (!currentGroup) return;
    try {
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('*, profiles(*)')
        .eq('group_id', currentGroup.id)
        .eq('active', true);

      const { data: eventRows } = await supabase
        .from('food_events')
        .select('*')
        .eq('group_id', currentGroup.id);

      const events = eventRows || [];
      const members = memberRows || [];

      const stats: StudentFoodStat[] = members.map((m: any) => {
        const studentProfile = m.profiles || {};
        const studentId = m.user_id;

        const studentEvents = events.filter((e: any) => e.student_id === studentId);
        const count = studentEvents.length;

        let latestTimestamp: string | null = null;
        if (studentEvents.length > 0) {
          const sorted = [...studentEvents].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          latestTimestamp = sorted[0].created_at;
        }

        return {
          id: studentId,
          name: studentProfile.name || 'Student',
          email: studentProfile.email || '',
          avatar_url: studentProfile.avatar_url,
          count,
          lastTakenAt: latestTimestamp,
        };
      });

      setStudents(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sortedStudents = [...students].sort((a, b) => {
    if (sortOrder === 'least') {
      return a.count - b.count;
    }
    return b.count - a.count;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <Skeleton style={{ height: 40, width: 140 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} style={{ height: 68 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem' }}>
        <h1 className="page-title">Tally</h1>
        <LimeBadge>
          <span className="doto-num" style={{ fontSize: '0.88rem', marginRight: '0.25rem' }}>{students.length}</span>
          <span style={{ color: '#6e6e73' }}>students</span>
        </LimeBadge>
      </div>

      {/* ── Apple Segmented Control ── */}
      <div
        style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.05)',
          borderRadius: 9999,
          padding: 3,
        }}
      >
        <button
          type="button"
          onClick={() => {
            haptics.selection();
            setSortOrder('least');
          }}
          style={{
            flex: 1,
            padding: '0.45rem 0',
            borderRadius: 9999,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.8rem',
            letterSpacing: '-0.01em',
            transition: 'all 200ms ease',
            background: sortOrder === 'least' ? '#ffffff' : 'transparent',
            color: sortOrder === 'least' ? '#1d1d1f' : '#86868b',
            boxShadow: sortOrder === 'least' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          Least Taken
        </button>
        <button
          type="button"
          onClick={() => {
            haptics.selection();
            setSortOrder('most');
          }}
          style={{
            flex: 1,
            padding: '0.45rem 0',
            borderRadius: 9999,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.8rem',
            letterSpacing: '-0.01em',
            transition: 'all 200ms ease',
            background: sortOrder === 'most' ? '#ffffff' : 'transparent',
            color: sortOrder === 'most' ? '#1d1d1f' : '#86868b',
            boxShadow: sortOrder === 'most' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          Most Taken
        </button>
      </div>

      {/* ── Students List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {sortedStudents.map((student, index) => {
          const isMe = student.id === profile?.id;
          const isTopLeast = sortOrder === 'least' && index < 3;

          return (
            <GlassCard
              key={student.id}
              padding="sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: isMe ? '1px solid rgba(0, 113, 227, 0.3)' : undefined,
                background: isMe ? 'rgba(255, 255, 255, 0.85)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isTopLeast ? 'rgba(0, 113, 227, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                    color: isTopLeast ? '#0071e3' : '#86868b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="doto-num" style={{ fontSize: '0.78rem' }}>{index + 1}</span>
                </div>

                <Avatar name={student.name} avatarUrl={student.avatar_url} size={40} />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                      {student.name}
                    </span>
                    {isMe && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 600,
                          color: '#0071e3',
                          background: 'rgba(0, 113, 227, 0.08)',
                          padding: '0.08rem 0.4rem',
                          borderRadius: 9999,
                        }}
                      >
                        You
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#86868b' }}>
                    {student.lastTakenAt
                      ? `Last taken: ${new Date(student.lastTakenAt).toLocaleDateString()}`
                      : 'Never taken'}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: isMe ? 'rgba(0, 113, 227, 0.06)' : 'rgba(0, 0, 0, 0.03)',
                    color: '#1d1d1f',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    padding: '0.25rem 0.65rem',
                    borderRadius: 9999,
                  }}
                >
                  <span className="doto-num" style={{ fontSize: '0.95rem', marginRight: '0.2rem', color: isMe ? '#0071e3' : '#1d1d1f' }}>
                    {student.count}
                  </span>
                  <span style={{ color: '#86868b' }}>{student.count === 1 ? 'time' : 'times'}</span>
                </span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { GlassCard, LimeBadge, Skeleton } from '../components/ui';

export function Stats() {
  const { currentGroup } = useAppStore();
  const [stats, setStats]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (currentGroup) fetchStats(); }, [currentGroup]);

  const fetchStats = async () => {
    if (!currentGroup) return;
    try {
      const { data } = await supabase.from('food_events')
        .select(`action, student_id, profiles:student_id (name)`)
        .eq('group_id', currentGroup.id)
        .in('action', ['COMPLETED', 'DEFERRED', 'EARLY']);

      if (data) {
        const map = new Map<string, any>();
        data.forEach((ev: any) => {
          if (!ev.student_id) return;
          if (!map.has(ev.student_id)) {
            map.set(ev.student_id, { name: ev.profiles?.name ?? 'Unknown', completed: 0, deferred: 0, early: 0 });
          }
          const s = map.get(ev.student_id);
          if (ev.action === 'COMPLETED') s.completed++;
          if (ev.action === 'DEFERRED')  s.deferred++;
          if (ev.action === 'EARLY')     { s.early++; s.completed++; }
        });
        setStats(Array.from(map.values()).sort((a, b) => b.completed - a.completed));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <Skeleton style={{ height: 300 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Statistics</h1>

      {/* Column headers */}
      <GlassCard padding="sm">
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px',
          gap: '0.5rem', alignItems: 'center',
        }}>
          <p className="section-label">Student</p>
          <p className="section-label" style={{ textAlign: 'center' }}>Done</p>
          <p className="section-label" style={{ textAlign: 'center' }}>Skip</p>
          <p className="section-label" style={{ textAlign: 'center' }}>Early</p>
        </div>

        {stats.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>
            No data yet
          </p>
        ) : (
          stats.map((s, i) => (
            <React.Fragment key={i}>
              <hr className="glass-divider" />
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px',
                gap: '0.5rem', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#c8ff00,#90ef00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.8rem', color: '#0a18a8', flexShrink: 0,
                  }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</span>
                </div>
                <LimeBadge style={{ justifySelf: 'center' }}>{s.completed}</LimeBadge>
                <span style={{ textAlign: 'center', fontWeight: 600, color: '#fbbf24' }}>{s.deferred}</span>
                <span style={{ textAlign: 'center', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                  {s.early || '—'}
                </span>
              </div>
            </React.Fragment>
          ))
        )}
      </GlassCard>
    </div>
  );
}

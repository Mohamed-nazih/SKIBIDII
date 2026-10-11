import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { GlassCard, Skeleton } from '../components/ui';
import { format } from 'date-fns';

const actionMeta: Record<string, { icon: string; label: string; color: string }> = {
  TAKEN:           { icon: '+', label: 'Took food',           color: '#1d1d1f' },
  COMPLETED:       { icon: '+', label: 'Completed pickup',    color: '#1d1d1f' },
  DEFERRED:        { icon: '-', label: 'Deferred turn',       color: '#d97706' },
  EARLY:           { icon: '*', label: 'Took turn early',     color: '#0071e3' },
  ROUND_CREATED:   { icon: 'R', label: 'New round started',   color: '#6e6e73' },
  ROUND_COMPLETED: { icon: 'R', label: 'Round completed',     color: '#28a745' },
  ADMIN_OVERRIDE:  { icon: 'A', label: 'Admin override',      color: '#e11d48' },
};

export function History() {
  const { currentGroup } = useAppStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (currentGroup) fetchHistory(); }, [currentGroup]);

  const fetchHistory = async () => {
    if (!currentGroup) return;
    try {
      const { data } = await supabase.from('food_events')
        .select(`*, profiles:student_id (name)`)
        .eq('group_id', currentGroup.id)
        .order('created_at', { ascending: false })
        .limit(60);
      setEvents(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} style={{ height: 60 }} />)}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <h1 className="page-title" style={{ marginBottom: '0.25rem', paddingTop: '0.25rem' }}>Activity</h1>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86868b', padding: '4rem 0' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No activity recorded yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {events.map((ev, i) => {
            const meta = actionMeta[ev.action] ?? { icon: '?', label: ev.action, color: '#86868b' };
            return (
              <GlassCard key={i} padding="sm" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Icon bubble */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(0, 0, 0, 0.04)',
                  color: meta.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                }}>
                  {meta.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    {(ev.profiles as any)?.name || 'System'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: meta.color, fontWeight: 500 }}>
                    {meta.label}
                  </p>
                </div>

                {/* Time */}
                <p className="doto-badge" style={{ margin: 0, fontSize: '0.74rem', color: '#86868b', whiteSpace: 'nowrap' }}>
                  {format(new Date(ev.created_at), 'h:mm a')}
                </p>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

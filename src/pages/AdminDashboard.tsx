import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { GlassCard, Button, LimeBadge, Avatar, Skeleton } from '../components/ui';
import { shuffleWithFairness } from '../lib/round-engine';
import type { MonthlyCycle, Round, Profile, GroupMember } from '../types';

export function AdminDashboard() {
  const { currentGroup, profile } = useAppStore();
  const [cycle, setCycle]   = useState<MonthlyCycle | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [members, setMembers] = useState<(GroupMember & { profiles: Profile })[]>([]);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (currentGroup && profile?.role === 'ADMIN') fetchAdminData();
  }, [currentGroup, profile]);

  const fetchAdminData = async () => {
    if (!currentGroup) return;
    try {
      const { data: cycleData } = await supabase.from('monthly_cycles').select('*')
        .eq('group_id', currentGroup.id).eq('status', 'ACTIVE').single();
      if (cycleData) {
        setCycle(cycleData as MonthlyCycle);
        const { data: roundsData } = await supabase.from('rounds').select('*')
          .eq('monthly_cycle_id', cycleData.id).order('round_number', { ascending: false });
        setRounds((roundsData as Round[]) || []);
      }
      const { data: membersData } = await supabase.from('group_members')
        .select('*, profiles(*)')
        .eq('group_id', currentGroup.id).eq('active', true);
      setMembers((membersData as any[]) || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleStartCycle = async () => {
    if (!currentGroup) return;
    setActionLoading(true); setMsg('');
    try {
      if (cycle) {
        await supabase.from('monthly_cycles')
          .update({ status: 'ARCHIVED', archived_at: new Date().toISOString() })
          .eq('id', cycle.id);
      }
      const now = new Date();
      const { error } = await supabase.from('monthly_cycles').insert({
        group_id: currentGroup.id,
        year: now.getFullYear(), month: now.getMonth() + 1, status: 'ACTIVE',
      });
      if (error) throw error;
      setMsg('Monthly cycle created ✓');
      await fetchAdminData();
    } catch (e: any) { setMsg(e.message || 'Error'); }
    finally { setActionLoading(false); }
  };

  const handleGenerateRound = async () => {
    if (!currentGroup || !cycle) return;
    setActionLoading(true); setMsg('');
    try {
      const activeRound = rounds.find(r => r.status === 'ACTIVE');
      if (activeRound) { setMsg('There is already an active round.'); return; }

      const lastRound = rounds[0];
      let prevOrder: string[] = [];
      if (lastRound) {
        const { data: lm } = await supabase.from('round_members').select('student_id')
          .eq('round_id', lastRound.id).order('position', { ascending: true });
        if (lm) prevOrder = lm.map((m: any) => m.student_id);
      }

      const activeStudentIds = members.map(m => m.user_id);
      if (!activeStudentIds.length) { setMsg('No active students.'); return; }

      const newOrder = shuffleWithFairness(activeStudentIds, prevOrder);
      const nextNum  = lastRound ? lastRound.round_number + 1 : 1;

      const { data: newRound, error: re } = await supabase.from('rounds').insert({
        monthly_cycle_id: cycle.id, round_number: nextNum, status: 'ACTIVE',
      }).select().single();
      if (re) throw re;

      const { error: me } = await supabase.from('round_members').insert(
        newOrder.map((sid, idx) => ({
          round_id: newRound.id, student_id: sid,
          position: idx + 1, status: idx === 0 ? 'CURRENT' : 'PENDING',
        }))
      );
      if (me) throw me;

      await supabase.from('food_events').insert({
        group_id: currentGroup.id, round_id: newRound.id,
        action: 'ROUND_CREATED', created_by: profile?.id,
      });
      setMsg(`Round ${nextNum} created ✓`);
      await fetchAdminData();
    } catch (e: any) { setMsg(e.message || 'Error'); }
    finally { setActionLoading(false); }
  };

  if (profile?.role !== 'ADMIN') return (
    <div style={{ textAlign: 'center', marginTop: '5rem', color: '#f87171' }}>
      <h2>Access Denied</h2>
    </div>
  );

  if (loading) return <Skeleton style={{ height: 300 }} />;

  const activeRound = rounds.find(r => r.status === 'ACTIVE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Admin</h1>
        <LimeBadge>Admin</LimeBadge>
      </div>

      {/* Status overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <GlassCard padding="sm" style={{ textAlign: 'center' }}>
          <p className="section-label">Members</p>
          <p style={{ fontSize: '2rem', fontWeight: 900, margin: '0.1rem 0 0', color: 'var(--accent)' }}>
            {members.length}
          </p>
        </GlassCard>
        <GlassCard padding="sm" style={{ textAlign: 'center' }}>
          <p className="section-label">Rounds</p>
          <p style={{ fontSize: '2rem', fontWeight: 900, margin: '0.1rem 0 0', color: 'var(--accent)' }}>
            {rounds.length}
          </p>
        </GlassCard>
      </div>

      {/* Cycle management */}
      <GlassCard variant="profile" padding="md">
        <p className="section-label" style={{ marginBottom: '0.65rem' }}>Cycle Management</p>
        {cycle ? (
          <>
            <p style={{ margin: '0 0 0.85rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
              Active: Month {cycle.month} / {cycle.year}
              {activeRound && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· Round {activeRound.round_number} in progress</span>}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Button style={{ width: '100%' }} isLoading={actionLoading} onClick={handleGenerateRound}>
                ▶ Generate Next Round
              </Button>
              <Button variant="secondary" style={{ width: '100%' }} isLoading={actionLoading} onClick={handleStartCycle}>
                Archive & Start New Cycle
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 0.85rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              No active cycle found.
            </p>
            <Button style={{ width: '100%' }} isLoading={actionLoading} onClick={handleStartCycle}>
              Start Monthly Cycle
            </Button>
          </>
        )}
        {msg && <p style={{ marginTop: '0.75rem', color: 'var(--accent)', fontSize: '0.85rem', margin: '0.75rem 0 0' }}>{msg}</p>}
      </GlassCard>

      {/* Member list */}
      <GlassCard padding="md">
        <p className="section-label" style={{ marginBottom: '0.75rem' }}>Active Members</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Avatar name={m.profiles?.name || '?'} size={34} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{m.profiles?.name}</span>
              <LimeBadge>{m.profiles?.role}</LimeBadge>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

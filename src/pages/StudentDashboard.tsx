import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { GlassCard, Avatar, LimeBadge, Skeleton } from '../components/ui';
import { haptics } from '../lib/haptics';
import type { StudentFoodStat, FoodRequest } from '../types';

export function StudentDashboard() {
  const { currentGroup, profile } = useAppStore();
  const [students, setStudents] = useState<StudentFoodStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active food requests state
  const [pendingRequests, setPendingRequests] = useState<FoodRequest[]>([]);
  const [myActiveRequest, setMyActiveRequest] = useState<FoodRequest | null>(null);
  const [votingRequestId, setVotingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (currentGroup) {
      loadStudents();
      loadRequests();
    }
  }, [currentGroup]);

  // Realtime subscription for food events and food requests
  useEffect(() => {
    const chEvents = supabase
      .channel('student-dashboard-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_events' }, () => {
        loadStudents();
      })
      .subscribe();

    const chRequests = supabase
      .channel('student-dashboard-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_requests' }, () => {
        loadRequests();
        loadStudents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chEvents);
      supabase.removeChannel(chRequests);
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

  const loadRequests = async () => {
    if (!currentGroup) return;
    try {
      const { data } = await supabase
        .from('food_requests')
        .select('*, profiles:student_id(*)')
        .eq('group_id', currentGroup.id)
        .eq('status', 'PENDING');

      const requests: FoodRequest[] = (data || []).map((r: any) => ({
        ...r,
        approvals: r.approvals || [],
        rejections: r.rejections || [],
        student: r.profiles,
      }));

      // Requests from other members that need approval
      setPendingRequests(requests.filter((r) => r.student_id !== profile?.id));

      // My own pending request (if any)
      const myReq = requests.find((r) => r.student_id === profile?.id) || null;
      setMyActiveRequest(myReq);
    } catch (e) {
      console.error('Failed to load food requests:', e);
    }
  };

  /** Initiates a "Taken" verification request */
  const handleTakeFood = async () => {
    if (!profile || !currentGroup || submitting || myActiveRequest) return;
    haptics.heavy();
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('food_requests')
        .insert({
          group_id: currentGroup.id,
          student_id: profile.id,
          status: 'PENDING',
          approvals: [],
          rejections: [],
        });

      if (error) throw error;

      await loadRequests();
      haptics.selection();
      setToastMessage('Request sent! Waiting for 2 approvals…');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || 'Failed to submit request');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  /** Cancels the requester's own pending food pickup request */
  const handleCancelRequest = async () => {
    if (!myActiveRequest || canceling) return;
    haptics.medium();
    setCanceling(true);
    try {
      const { error } = await supabase
        .from('food_requests')
        .delete()
        .eq('id', myActiveRequest.id);

      if (error) throw error;

      setMyActiveRequest(null);
      await loadRequests();
      setToastMessage('Request canceled.');
      setTimeout(() => setToastMessage(null), 2500);
      haptics.light();
    } catch (err: any) {
      console.error('Failed to cancel request:', err);
      setToastMessage(err.message || 'Could not cancel request');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setCanceling(false);
    }
  };

  /** Accept / Approve peer's food pickup request */
  const handleAcceptRequest = async (request: FoodRequest) => {
    if (!profile || !currentGroup || votingRequestId) return;
    haptics.selection();
    setVotingRequestId(request.id);

    try {
      const currentApprovals: string[] = request.approvals || [];
      if (currentApprovals.includes(profile.id)) return; // already voted

      const newApprovals = [...currentApprovals, profile.id];

      // If 2 or more members accept -> APPROVE & RECORD FOOD EVENT!
      if (newApprovals.length >= 2) {
        haptics.success();
        // 1. Update request status
        await supabase
          .from('food_requests')
          .update({
            status: 'APPROVED',
            approvals: newApprovals,
            approved_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        // 2. Record official food event
        await supabase.from('food_events').insert({
          group_id: currentGroup.id,
          student_id: request.student_id,
          action: 'TAKEN',
          note: `Approved by 2 peers (${profile.name?.split(' ')[0]} and co-members)`,
        });

        await loadStudents();
        await loadRequests();
        setToastMessage(`Verified pickup for ${request.student?.name?.split(' ')[0] || 'member'}!`);
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        // 1 approval recorded, waiting for second approval
        haptics.light();
        await supabase
          .from('food_requests')
          .update({
            approvals: newApprovals,
          })
          .eq('id', request.id);

        await loadRequests();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setVotingRequestId(null);
    }
  };

  /** Decline / Reject peer's food pickup request */
  const handleDeclineRequest = async (request: FoodRequest) => {
    if (!profile || votingRequestId) return;
    haptics.medium();
    setVotingRequestId(request.id);

    try {
      const currentRejections: string[] = request.rejections || [];
      if (currentRejections.includes(profile.id)) return;

      const newRejections = [...currentRejections, profile.id];

      await supabase
        .from('food_requests')
        .update({
          status: newRejections.length >= 2 ? 'REJECTED' : 'PENDING',
          rejections: newRejections,
        })
        .eq('id', request.id);

      await loadRequests();
    } catch (err: any) {
      console.error(err);
    } finally {
      setVotingRequestId(null);
    }
  };

  // Top 3 students with least pickups (ascending)
  const suggestions = [...students].sort((a, b) => a.count - b.count).slice(0, 3);

  // Logged-in user's count
  const myStat = students.find((s) => s.id === profile?.id);
  const myCount = myStat ? myStat.count : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Skeleton style={{ height: 40, width: 140 }} />
        <Skeleton style={{ height: 260 }} />
        <Skeleton style={{ height: 160 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Apple Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.025em' }}>
          Hi, {profile?.name?.split(' ')[0] || 'there'}
        </h1>
        <LimeBadge>
          <span className="doto-num" style={{ fontSize: '0.88rem', marginRight: '0.25rem' }}>{myCount}</span>
          <span style={{ color: '#6e6e73' }}>{myCount === 1 ? 'meal' : 'meals'}</span>
        </LimeBadge>
      </div>

      {/* ── Incoming Approval Requests from other members ── */}
      {pendingRequests.length > 0 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: '#0071e3', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Action Required · Approvals ({pendingRequests.length})
          </p>
          {pendingRequests.map((req) => {
            const hasApproved = (req.approvals || []).includes(profile?.id || '');
            const hasDeclined = (req.rejections || []).includes(profile?.id || '');
            const approvalsCount = (req.approvals || []).length;
            const isProcessing = votingRequestId === req.id;

            return (
              <GlassCard
                key={req.id}
                padding="md"
                style={{
                  border: '1.5px solid rgba(0, 113, 227, 0.25)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  boxShadow: '0 8px 24px rgba(0, 113, 227, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Avatar name={req.student?.name || 'Member'} avatarUrl={req.student?.avatar_url} size={42} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: '#1d1d1f' }}>
                        {req.student?.name || 'Member'}
                      </p>
                      <p style={{ margin: '0.1rem 0 0', fontSize: '0.74rem', color: '#86868b' }}>
                        is taking food now
                      </p>
                    </div>
                  </div>

                  <span
                    style={{
                      background: 'rgba(0, 113, 227, 0.08)',
                      color: '#0071e3',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 9999,
                    }}
                  >
                    <span className="doto-num">{approvalsCount}</span>/2 accepted
                  </span>
                </div>

                {hasApproved ? (
                  <div
                    style={{
                      background: 'rgba(52, 199, 89, 0.08)',
                      color: '#28a745',
                      padding: '0.5rem',
                      borderRadius: '0.75rem',
                      textAlign: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    You Accepted ✓ · Waiting for co-members
                  </div>
                ) : hasDeclined ? (
                  <div
                    style={{
                      background: 'rgba(225, 29, 72, 0.08)',
                      color: '#e11d48',
                      padding: '0.5rem',
                      borderRadius: '0.75rem',
                      textAlign: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    You Declined ✕
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleAcceptRequest(req)}
                      style={{
                        flex: 2,
                        background: '#000000',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 9999,
                        padding: '0.6rem 1rem',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: isProcessing ? 'wait' : 'pointer',
                        opacity: isProcessing ? 0.6 : 1,
                        transition: 'all 180ms ease',
                      }}
                    >
                      {isProcessing ? 'Verifying…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleDeclineRequest(req)}
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.04)',
                        color: '#6e6e73',
                        border: '1px solid rgba(0, 0, 0, 0.06)',
                        borderRadius: 9999,
                        padding: '0.6rem 0.75rem',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: isProcessing ? 'wait' : 'pointer',
                        opacity: isProcessing ? 0.6 : 1,
                        transition: 'all 180ms ease',
                      }}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ── Apple Frosted Hero Card ── */}
      <GlassCard variant="hero">
        {/* Dot-matrix large number */}
        <div style={{ margin: '0.25rem 0 0' }}>
          <span className="dot-matrix-number">{myCount}</span>
        </div>

        {/* Minimal label below number */}
        <p style={{ margin: '0.2rem 0 1.25rem', fontSize: '0.74rem', fontWeight: 600, color: '#86868b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Food pickups
        </p>

        {/* Taken Button / Pending Approval Status */}
        <div style={{ width: '100%', maxWidth: 240 }}>
          {myActiveRequest ? (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(0, 113, 227, 0.25)',
                borderRadius: '1.25rem',
                padding: '0.85rem 1rem',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0, 113, 227, 0.08)',
              }}
            >
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.82rem', fontWeight: 700, color: '#0071e3' }}>
                Waiting for Approvals
              </p>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.74rem', color: '#6e6e73' }}>
                2 members must accept to record
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(0, 113, 227, 0.08)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: 9999,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#0071e3',
                  marginBottom: '0.65rem',
                }}
              >
                <span className="doto-num">{myActiveRequest.approvals.length}</span>/2 accepted
              </div>

              <div>
                <button
                  type="button"
                  disabled={canceling}
                  onClick={handleCancelRequest}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e11d48',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: canceling ? 'wait' : 'pointer',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 9999,
                    transition: 'all 160ms ease',
                    opacity: canceling ? 0.6 : 1,
                  }}
                >
                  {canceling ? 'Canceling…' : 'Cancel Request'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleTakeFood}
              disabled={submitting}
              className="action-button-taken"
              style={{ width: '100%' }}
            >
              {submitting ? 'Requesting…' : 'Taken'}
            </button>
          )}
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div
            className="animate-fade-in"
            style={{
              marginTop: '0.75rem',
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#ffffff',
              borderRadius: '9999px',
              padding: '0.35rem 0.9rem',
              fontWeight: 600,
              fontSize: '0.76rem',
              letterSpacing: '-0.01em',
            }}
          >
            {toastMessage}
          </div>
        )}
      </GlassCard>

      {/* ── Suggestions Section ── */}
      <div>
        <h2 style={{ margin: '0 0 0.65rem', fontSize: '0.92rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.015em' }}>
          Suggested next
        </h2>

        {suggestions.length === 0 ? (
          <div style={{ color: '#86868b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
            No students yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
            {suggestions.map((student, i) => {
              const rankLabels = ['1st', '2nd', '3rd'];
              const isMe = student.id === profile?.id;
              return (
                <div
                  key={student.id}
                  className="clean-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '0.9rem 0.4rem',
                    gap: '0.45rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: i === 0 ? '#0071e3' : '#86868b',
                      background: i === 0 ? 'rgba(0, 113, 227, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 9999,
                      padding: '0.12rem 0.5rem',
                    }}
                  >
                    {rankLabels[i]}
                  </span>

                  <Avatar name={student.name} avatarUrl={student.avatar_url} size={42} />

                  <div style={{ overflow: 'hidden', maxWidth: '100%' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {student.name.split(' ')[0]}
                      {isMe && <span style={{ marginLeft: '0.2rem', fontSize: '0.6rem', color: '#0071e3', fontWeight: 600 }}> (You)</span>}
                    </p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#86868b' }}>
                      <span className="doto-num" style={{ color: '#1d1d1f', fontSize: '0.92rem' }}>{student.count}</span>×
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

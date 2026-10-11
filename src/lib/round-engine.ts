import { supabase } from './supabase';

/**
 * Validates and completes a turn for a student.
 * Uses a Postgres RPC to ensure atomicity.
 */
export async function completeTurn(
  groupId: string,
  roundId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('complete_turn', {
      p_group_id: groupId,
      p_round_id: roundId,
      p_student_id: studentId
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error completing turn:', err);
    return { success: false, error: err.message || 'Failed to complete turn' };
  }
}

/**
 * Defers a turn for a student.
 */
export async function deferTurn(
  groupId: string,
  roundId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('defer_turn', {
      p_group_id: groupId,
      p_round_id: roundId,
      p_student_id: studentId
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error deferring turn:', err);
    return { success: false, error: err.message || 'Failed to defer turn' };
  }
}

/**
 * Takes a turn early for a student.
 */
export async function takeTurnEarly(
  groupId: string,
  roundId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('take_turn_early', {
      p_group_id: groupId,
      p_round_id: roundId,
      p_student_id: studentId
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error taking turn early:', err);
    return { success: false, error: err.message || 'Failed to take turn early' };
  }
}

/**
 * Fisher-Yates shuffle with bias prevention (simple implementation)
 */
export function shuffleWithFairness(studentIds: string[], previousOrder: string[]): string[] {
  let array = [...studentIds];
  let currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]
    ];
  }
  
  // Basic fairness check: if the first person was the last person in the previous round, swap them
  if (previousOrder.length > 0 && array[0] === previousOrder[previousOrder.length - 1] && array.length > 1) {
    // Swap with the second person
    [array[0], array[1]] = [array[1], array[0]];
  }

  return array;
}

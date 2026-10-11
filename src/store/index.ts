import { create } from 'zustand';
import type { Profile, PgGroup } from '../types';
import { supabase } from '../lib/supabase';

interface AppState {
  user: any | null;
  profile: Profile | null;
  currentGroup: PgGroup | null;
  isLoading: boolean;
  isRecoveryMode: boolean;
  
  setUser: (user: any) => void;
  setProfile: (profile: Profile | null) => void;
  setCurrentGroup: (group: PgGroup | null) => void;
  setLoading: (loading: boolean) => void;
  setIsRecoveryMode: (isRecovery: boolean) => void;
  
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  profile: null,
  currentGroup: null,
  isLoading: true,
  isRecoveryMode: typeof window !== 'undefined' && window.location.hash.includes('type=recovery'),
  
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setCurrentGroup: (group) => set({ currentGroup: group }),
  setLoading: (loading) => set({ isLoading: loading }),
  setIsRecoveryMode: (isRecoveryMode) => set({ isRecoveryMode }),
  
  initialize: async () => {
    set({ isLoading: true });
    
    // Check if recovery link in hash
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      set({ isRecoveryMode: true });
    }

    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    
    set({ user });
    
    if (user) {
      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (profileData) {
        set({ profile: profileData as Profile });
        
        // Get user's groups
        const { data: memberData } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id)
          .eq('active', true)
          .limit(1);
          
        if (memberData && memberData.length > 0) {
          const { data: groupData } = await supabase
            .from('pg_groups')
            .select('*')
            .eq('id', memberData[0].group_id)
            .single();
            
          if (groupData) {
            set({ currentGroup: groupData as PgGroup });
          }
        } else {
          // Auto-link user to default PG group so everything renders immediately
          const { data: defaultGroup } = await supabase
            .from('pg_groups')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (defaultGroup) {
            set({ currentGroup: defaultGroup as PgGroup });
            await supabase
              .from('group_members')
              .upsert({ group_id: defaultGroup.id, user_id: user.id, active: true }, { onConflict: 'group_id,user_id' });
          }
        }
      }
    }
    
    set({ isLoading: false });
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (event === 'PASSWORD_RECOVERY') {
        set({ isRecoveryMode: true });
        return;
      }

      const newUser = session?.user || null;
      if (!newUser) {
        set({ user: null, profile: null, currentGroup: null, isRecoveryMode: false });
      } else if (newUser.id !== get().user?.id && !get().isRecoveryMode) {
        // Just reload the page if user changes significantly to restart state
        window.location.reload();
      }
    });
  },
  
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, currentGroup: null, isRecoveryMode: false });
  }
}));

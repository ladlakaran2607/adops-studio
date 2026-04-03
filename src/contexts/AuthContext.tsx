import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  session: Session | null;
  user: User | null;
  organizationId: string | null;
  role: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchMembership(userId: string) {
  const { data, error } = await supabase
    .from('User')
    .select('tenantId, userType')
    .eq('supabaseUserId', userId)
    .limit(1)
    .single();
  if (error || !data) return { organizationId: null, role: null };
  return { organizationId: data.tenantId as string, role: data.userType as string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    organizationId: null,
    role: null,
    isLoading: true,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const membership = await fetchMembership(session.user.id);
        setState({
          session,
          user: session.user,
          organizationId: membership.organizationId,
          role: membership.role,
          isLoading: false,
        });
      } else {
        setState(s => ({ ...s, isLoading: false }));
      }
    });

    // Listen for auth changes — set user immediately, then fetch membership
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          // Set user immediately so the UI can redirect
          setState(s => ({
            ...s,
            session,
            user: session.user,
            isLoading: false,
          }));
          // Then fetch membership in the background
          fetchMembership(session.user.id).then(membership => {
            setState(s => ({
              ...s,
              organizationId: membership.organizationId,
              role: membership.role,
            }));
          });
        } else {
          setState({
            session: null,
            user: null,
            organizationId: null,
            role: null,
            isLoading: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

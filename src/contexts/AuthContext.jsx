import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    const defaultProfile = {
      id: session.user.id,
      email: session.user.email,
      display_name:
        session.user.user_metadata?.display_name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'User',
      role: 'editor',
    };
    // Attempt to enrich with custom profile if exists, else keep default
    setProfile(defaultProfile);
    supabase
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile((prev) => ({
            ...prev,
            display_name: data.display_name || prev.display_name,
            role: data.role || prev.role,
          }));
        }
      })
      .catch(() => {
        // Safe to ignore if profiles table is not used
      });
  }, [session?.user?.id]);

  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const isAdmin = isAuthenticated;

  const value = {
    session,
    user,
    profile,
    isAuthenticated,
    canEdit: isAuthenticated,
    isAdmin: isAuthenticated,
    isOwner: profile?.role === 'owner',
    userEmail: user?.email ?? '',
    displayName: profile?.display_name || user?.email?.split('@')[0] || 'User',
    loading: session === undefined,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { User } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  signInWithPassword,
  signOut,
  getSession,
  onAuthStateChange,
  setCurrentSalonId,
  setCurrentUser,
  getCurrentSalonId,
  fetchUserSalon,
  fetchUserRole,
} from '../lib/supabase';
import { Salon } from '../types';

interface SalonContextType {
  supabaseReady: boolean;
  user: User | null;
  salon: Salon | null;
  salonId: string | null;
  role: string | null;
  isSuperadmin: boolean;
  isLoading: boolean;
  isRoleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSalon: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const SalonContext = createContext<SalonContextType | undefined>(undefined);

function readMetadataRole(user: User | null): string | null {
  const metadata = user?.app_metadata as Record<string, unknown> | undefined;
  return typeof metadata?.role === 'string' ? metadata.role : null;
}

export function SalonContextProvider({ children }: { children: ReactNode }) {
  const [supabaseReady, setSupabaseReady] = useState(isSupabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Separa "sessão carregada" de "role carregada": evita redirecionar um
  // superadmin para fora de /admin no intervalo entre o login e a leitura da role.
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  const salonId = getCurrentSalonId();

  // Carrega sessão existente e o salão do usuário ao montar
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setIsLoading(true);
      try {
        if (supabase) {
          const { data } = await getSession?.();
          if (data?.session?.user && mounted) {
            const sessionUser = data.session.user;
            setUser(sessionUser);
            setCurrentUser(sessionUser);
            const [userSalon, profileRole] = await Promise.all([
              fetchUserSalon(sessionUser.id),
              fetchUserRole(sessionUser.id),
            ]);
            if (mounted) {
              setSalon(userSalon);
              setRole(profileRole ?? readMetadataRole(sessionUser));
              if (userSalon) setCurrentSalonId(userSalon.id);
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao inicializar sessão Supabase:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsRoleLoading(false);
        }
      }
    }

    initAuth();

    // Escuta mudanças de autenticação (login/logout em outra aba, etc.)
    const { data: sub } = onAuthStateChange?.(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const sessionUser = session.user;
          setIsRoleLoading(true);
          setUser(sessionUser);
          setCurrentUser(sessionUser);
          const [userSalon, profileRole] = await Promise.all([
            fetchUserSalon(sessionUser.id),
            fetchUserRole(sessionUser.id),
          ]);
          if (!mounted) return;
          setSalon(userSalon);
          setRole(profileRole ?? readMetadataRole(sessionUser));
          if (userSalon) setCurrentSalonId(userSalon.id);
          setIsRoleLoading(false);
        } else {
          setUser(null);
          setSalon(null);
          setRole(null);
          setCurrentSalonId(null);
          setCurrentUser(null);
          setIsRoleLoading(false);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      (sub as any)?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleSignIn = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const { error } = await signInWithPassword(email, password);
        return { error };
      } catch (err: any) {
        return { error: err };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOut();
      setUser(null);
      setSalon(null);
      setRole(null);
      setIsRoleLoading(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefreshSalon = useCallback(async () => {
    if (!user) return;
    const userSalon = await fetchUserSalon(user.id);
    setSalon(userSalon);
    if (userSalon) setCurrentSalonId(userSalon.id);
  }, [user]);

  const handleRefreshRole = useCallback(async () => {
    if (!user) return;
    const profileRole = await fetchUserRole(user.id);
    setRole(profileRole ?? readMetadataRole(user));
  }, [user]);

  const isSuperadmin =
    role === 'superadmin' || readMetadataRole(user) === 'superadmin';

  if (!supabaseReady) {
    return null;
  }

  return (
    <SalonContext.Provider
      value={{
        supabaseReady,
        user,
        salon,
        salonId,
        role,
        isSuperadmin,
        isLoading,
        isRoleLoading,
        signIn: handleSignIn,
        signOut: handleSignOut,
        refreshSalon: handleRefreshSalon,
        refreshRole: handleRefreshRole,
      }}
    >
      {children}
    </SalonContext.Provider>
  );
}

export function useSalon() {
  const ctx = useContext(SalonContext);
  if (!ctx) {
    throw new Error('useSalon deve ser usado dentro de um SalonContextProvider');
  }
  return ctx;
}

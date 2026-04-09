import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { UserRole } from '@/types/feedback';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  profileName: string | null;
  department: string | null;
  status: 'Approved' | 'Pending' | 'Rejected';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, department: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  department: string;
  role: UserRole | null;
  status: 'Approved' | 'Pending' | 'Rejected';
}

const VALID_ROLES: UserRole[] = ['superadmin', 'admin', 'user', 'viewer'];
const EMAIL_KEYS = ['email', 'Email', 'email_id', 'Email ID', 'EmailId', 'mail', 'Mail'] as const;
const NAME_KEYS = ['name', 'Name', 'full_name', 'Full Name', 'fullName'] as const;
const DEPARTMENT_KEYS = ['department', 'Department', 'dept', 'Dept'] as const;
const STATUS_KEYS = ['status', 'Status', 'user_status', 'User Status'] as const;
const ROLE_KEYS = ['role', 'Role', 'user_role', 'User Role'] as const;
const ID_KEYS = ['id', 'Id', 'ID', '_id'] as const;

// Master User Whitelist (System Admins)
const WHITELIST: Record<string, { role: UserRole; name: string; department: string }> = {
  'pradeepmittal.mis3@rajmandirhypermarket.com': { role: 'superadmin', name: 'Super Admin', department: 'Management' },
  'admin@rajmandir.com': { role: 'superadmin', name: 'System Admin', department: 'IT' },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeStatus = (value: unknown): 'Approved' | 'Pending' | 'Rejected' => {
  const status = String(value || 'Pending').trim().toLowerCase();
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
};

const normalizeRole = (value: unknown): UserRole | null => {
  const role = String(value || '').trim().toLowerCase();
  return VALID_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
};

const pickFirst = (row: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
};

const parseDirectoryUser = (row: any): DirectoryUser => {
  const role = normalizeRole(pickFirst(row, ROLE_KEYS));
  return {
    id: String(pickFirst(row, ID_KEYS)).trim(),
    email: String(pickFirst(row, EMAIL_KEYS)).trim().toLowerCase(),
    name: String(pickFirst(row, NAME_KEYS)).trim(),
    department: String(pickFirst(row, DEPARTMENT_KEYS) || 'Staff').trim() || 'Staff',
    role,
    status: normalizeStatus(pickFirst(row, STATUS_KEYS)),
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [directoryUser, setDirectoryUser] = useState<DirectoryUser | null>(null);

  const fetchDirectoryUser = useCallback(async (lookupUser: User): Promise<DirectoryUser | null> => {
    const sheetUrl = import.meta.env.VITE_GOOGLE_SHEET_API_URL;
    if (!sheetUrl) return null;

    try {
      const requestUsers = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data?.success || !Array.isArray(data?.data)) return [];
        return data.data as any[];
      };

      let rows = await requestUsers(`${sheetUrl}?action=GET_USERS`);
      if (!rows.length) rows = await requestUsers(sheetUrl);
      if (!rows.length) return null;

      const email = lookupUser.email?.toLowerCase() ?? '';
      const id = lookupUser.id;

      const directoryUsers = rows.map(parseDirectoryUser).filter((row) => row.email.includes('@'));
      const matched = directoryUsers.find((row) => row.id === id || row.email === email) ?? null;
      setDirectoryUser(matched);
      return matched;
    } catch (error) {
      console.error('Unable to fetch user directory profile:', error);
      return null;
    }
  }, []);

  // Derived role, name, and status
  const isWhitelist = user?.email ? WHITELIST[user.email.toLowerCase()] : null;
  const role =
    isWhitelist?.role ??
    directoryUser?.role ??
    normalizeRole(user?.user_metadata?.role) ??
    null;
  const profileName =
    isWhitelist?.name ??
    directoryUser?.name ??
    user?.user_metadata?.full_name ??
    user?.email?.split('@')[0] ??
    null;
  const department =
    isWhitelist?.department ??
    directoryUser?.department ??
    user?.user_metadata?.department ??
    'Staff';
  const status = isWhitelist ? 'Approved' : normalizeStatus(directoryUser?.status ?? user?.user_metadata?.status ?? 'Pending');

  useEffect(() => {
    const syncSession = async (activeSession: Session | null) => {
      setSession(activeSession);
      const activeUser = activeSession?.user ?? null;
      setUser(activeUser);

      if (activeUser && !WHITELIST[activeUser.email?.toLowerCase() ?? '']) {
        await fetchDirectoryUser(activeUser);
      } else {
        setDirectoryUser(null);
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      void syncSession(updatedSession);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      void syncSession(initialSession);
    });

    return () => subscription.unsubscribe();
  }, [fetchDirectoryUser]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const signedInUser = data.user;
    if (!signedInUser) throw new Error('Login failed: unable to load account details.');

    const isMaster = WHITELIST[email.toLowerCase()];
    if (isMaster) return;

    const sheetProfile = await fetchDirectoryUser(signedInUser);
    const effectiveStatus = normalizeStatus(sheetProfile?.status ?? signedInUser.user_metadata?.status ?? 'Pending');
    const effectiveRole = normalizeRole(sheetProfile?.role ?? signedInUser.user_metadata?.role);

    if (effectiveStatus !== 'Approved') {
      await supabase.auth.signOut();
      throw new Error('Access Denied: Your account is pending Super Admin approval.');
    }

    if (!effectiveRole) {
      await supabase.auth.signOut();
      throw new Error('Access Denied: Role not assigned yet. Please contact Super Admin.');
    }
  };

  const signUp = async (email: string, password: string, fullName: string, dept: string) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          department: dept,
          status: 'Pending',
        },
      },
    });
    if (error) throw error;

    const sheetUrl = import.meta.env.VITE_GOOGLE_SHEET_API_URL;
    if (sheetUrl) {
      const emailKey = email.toLowerCase().trim();
      const payload = {
        action: 'ADD_USER',
        id: authData.user?.id || '',
        name: fullName,
        email,
        department: dept,
        status: 'Pending',
        role: '',
      };

      const postJson = async (data: Record<string, unknown>) => {
        const res = await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(data),
        });
        let body: any = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        return { ok: res.ok, body };
      };

      const hasUserInDirectory = async () => {
        try {
          const usersRes = await fetch(`${sheetUrl}?action=GET_USERS`);
          const usersBody = await usersRes.json();
          if (!usersRes.ok || !usersBody?.success || !Array.isArray(usersBody?.data)) return false;
          return usersBody.data.some((u: any) => {
            const rowEmail = String(u.email || u.Email || '').trim().toLowerCase();
            return rowEmail === emailKey;
          });
        } catch {
          return false;
        }
      };

      // First write
      const first = await postJson(payload);
      if (!first.ok || !first.body?.success) {
        await supabase.auth.signOut();
        throw new Error(first.body?.error || 'Signup created but user directory sync failed. Contact Super Admin.');
      }

      // Verify + retry once if row not visible yet
      let exists = await hasUserInDirectory();
      if (!exists) {
        await postJson({ ...payload, action: 'UPDATE_USER' });
        exists = await hasUserInDirectory();
      }

      if (!exists) {
        await supabase.auth.signOut();
        throw new Error('Signup submitted but request not found in User Master. Please contact Super Admin.');
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, profileName, status, department, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

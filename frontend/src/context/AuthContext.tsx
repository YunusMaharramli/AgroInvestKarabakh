import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, EntrepreneurProfile } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  profile: EntrepreneurProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, recaptchaToken: string) => Promise<{ success: boolean; error?: string; role?: string; needsEmailConfirmation?: boolean }>;
  register: (data: any) => Promise<{ success: boolean; error?: string; role?: string; needsEmailConfirmation?: boolean; message?: string; emailDeliveryFailed?: boolean }>;
  resendConfirmation: (email: string, recaptchaToken: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: any) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EntrepreneurProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('agro_token'));
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async (currentToken: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }
      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
      } else {
        setUser(null);
        setProfile(null);
        if (currentToken) {
          localStorage.removeItem('agro_token');
          setToken(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch auth session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser(token);
  }, []);

  const login = async (email: string, password: string, recaptchaToken: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, recaptchaToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Giriş uğursuz oldu.',
          needsEmailConfirmation: res.status === 403,
        };
      }
      setUser(data.user);
      setProfile(data.profile);
      setToken(data.token);
      localStorage.setItem('agro_token', data.token);
      return { success: true, role: data.user?.role };
    } catch (err: any) {
      return { success: false, error: 'Şəbəkə xətası baş verdi.' };
    }
  };

  const register = async (formData: any) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Qeydiyyat uğursuz oldu.' };
      }
      if (data.requiresEmailConfirmation === true) {
        return {
          success: true,
          needsEmailConfirmation: true,
          message: data.message,
          emailDeliveryFailed: data.emailDeliveryFailed === true,
        };
      }
      setUser(data.user);
      setProfile(data.profile);
      setToken(data.token);
      localStorage.setItem('agro_token', data.token);
      return { success: true, role: data.user?.role };
    } catch (err: any) {
      return { success: false, error: 'Şəbəkə xətası baş verdi.' };
    }
  };

  const resendConfirmation = async (email: string, recaptchaToken: string) => {
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Məktub yenidən göndərilə bilmədi.' };
      }

      return { success: true, message: data.message };
    } catch {
      return { success: false, error: 'Şəbəkə xətası baş verdi. Yenidən cəhd edin.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setToken(null);
      localStorage.removeItem('agro_token');
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser(token);
  };

  const updateProfile = async (data: any) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || 'Yenilənmədi.' };
      }
      setUser(result.user);
      setProfile(result.profile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Profil yenilənərkən xəta baş verdi.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        login,
        register,
        resendConfirmation,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

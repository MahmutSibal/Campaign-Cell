import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '@workspace/api-client-react';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem('campaigncell_user');
    return stored ? JSON.parse(stored) : null;
  });
  
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('campaigncell_token');
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('campaigncell_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('campaigncell_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('campaigncell_token', token);
    } else {
      localStorage.removeItem('campaigncell_token');
    }
  }, [token]);

  const login = (newUser: UserProfile, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('campaigncell_user');
    localStorage.removeItem('campaigncell_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

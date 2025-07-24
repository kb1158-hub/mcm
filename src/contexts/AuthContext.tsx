import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user?: { name: string; email: string } | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem('mcm-auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      setUser({ name: 'MCM User', email: 'user@mcm-alerts.com' });
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === 'user' && password === '123456') {
      setIsAuthenticated(true);
      setUser({ name: 'MCM User', email: 'user@mcm-alerts.com' });
      localStorage.setItem('mcm-auth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('mcm-auth');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

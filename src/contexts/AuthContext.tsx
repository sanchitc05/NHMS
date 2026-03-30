import React, { createContext, useContext, useState, ReactNode } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: 'traveller' | 'admin'
  vehicleNumber?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  register: (
    name: string,
    email: string,
    password: string,
    vehicleNumber?: string
  ) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nhms_user')
    return saved ? JSON.parse(saved) : null
  })

  // ✅ REAL LOGIN
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (data.success && data.token) {
        setUser(data.user);
        localStorage.setItem('nhms_user', JSON.stringify(data.user));
        localStorage.setItem('nhms_token', data.token);
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err: any) {
      console.error('Login Error:', err);
      return { success: false, message: err.message || 'Login failed' };
    }
  }

  // ✅ REAL REGISTER
  const register = async (
    name: string,
    email: string,
    password: string,
    vehicleNumber?: string
  ) => {
    try {
      const res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, vehicleNumber }),
      });
      const data = await res.json();
      
      if (data.success && data.token) {
        setUser(data.user);
        localStorage.setItem('nhms_user', JSON.stringify(data.user));
        localStorage.setItem('nhms_token', data.token);
        return true;
      }
      throw new Error(data.message || 'Registration failed');
    } catch (err: any) {
      console.error('Register Error:', err);
      throw err;
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('nhms_user')
    localStorage.removeItem('nhms_token')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

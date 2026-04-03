import React, { createContext, useContext, useState, ReactNode } from 'react'
import { API_BASE_URL } from '@/lib/api-config'

interface User {
  id: string
  name: string
  email: string
  role: 'traveller' | 'admin'
  vehicleNumber?: string
  phone?: string
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
  ) => Promise<{ success: boolean; requireOtp?: boolean; message?: string }>
  verifyRegistration: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>
  updateUser: (data: Partial<User>) => Promise<{ success: boolean; message?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nhms_user')
    return saved ? JSON.parse(saved) : null
  })

  // REAL LOGIN
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
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

  // REAL REGISTER
  const register = async (
    name: string,
    email: string,
    password: string,
    vehicleNumber?: string
  ) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, vehicleNumber }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.requireOtp) {
          return { success: true, requireOtp: true, message: data.message };
        }
        setUser(data.user);
        localStorage.setItem('nhms_user', JSON.stringify(data.user));
        localStorage.setItem('nhms_token', data.token);
        return { success: true };
      }
      return { success: false, message: data.message || 'Registration failed' };
    } catch (err: any) {
      console.error('Register Error:', err);
      return { success: false, message: err.message || 'Registration failed' };
    }
  }

  // VERIFY REGISTRATION OTP
  const verifyRegistration = async (email: string, otp: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      
      if (data.success && data.token) {
        setUser(data.user);
        localStorage.setItem('nhms_user', JSON.stringify(data.user));
        localStorage.setItem('nhms_token', data.token);
        return { success: true };
      }
      return { success: false, message: data.message || 'Verification failed' };
    } catch (err: any) {
      console.error('Verification Error:', err);
      return { success: false, message: err.message || 'Verification failed' };
    }
  }

  // UPDATE USER PROFILE
  const updateUser = async (data: Partial<User>) => {
    if (!user) return { success: false, message: 'Not logged in' };
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      
      if (result.success && result.user) {
        const updatedUser = { ...user, ...result.user };
        setUser(updatedUser);
        localStorage.setItem('nhms_user', JSON.stringify(updatedUser));
        return { success: true };
      }
      return { success: false, message: result.message || 'Update failed' };
    } catch (err: any) {
      console.error('Update Profile Error:', err);
      return { success: false, message: err.message || 'Update failed' };
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
        verifyRegistration,
        updateUser,
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


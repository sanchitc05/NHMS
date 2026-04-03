import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, AlertCircle, Eye, EyeOff } from 'lucide-react';

import { useEffect } from 'react';

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (!result.success) {
        setError(result.message || 'Invalid credentials. Please try again.');
      }
      // Note: redirection is now handled by the useEffect above
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent/20" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-primary-foreground">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-8 shadow-glow">
            <Car className="w-8 h-8 text-accent-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Welcome to NHMS</h1>
          <p className="text-xl text-primary-foreground/80 mb-8">
            National Highway Management System
          </p>
          <ul className="space-y-4 text-primary-foreground/70">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent" />
              Plan your route with real-time updates
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent" />
              Calculate toll costs before your journey
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent" />
              Access emergency services instantly
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent" />
              Stay safe with speed monitoring
            </li>
          </ul>
        </div>
        {/* Decorative Elements */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mb-32" />
        <div className="absolute top-20 right-20 w-32 h-32 bg-accent/5 rounded-full" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="lg:hidden w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
              <Car className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Sign in to your account</h2>
            <p className="text-muted-foreground mt-2">Access highway services securely</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="gov-input"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="gov-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            {/* Demo Credentials */}
            <div className="text-center text-sm text-muted-foreground bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium mb-1">Demo Credentials</p>
              <p>User: traveller@nhms.gov / password123</p>
              <p>Admin: admin@nhms.com / admin123</p>
            </div>

            {/* Register Link */}
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="text-accent font-medium hover:underline">
                Register here
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

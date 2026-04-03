import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, AlertCircle, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!email && !token) {
      setError('Invalid request. Please go back and provide your email.');
    }
  }, [email, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp, token, newPassword: password }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.message || 'Verification failed. Please check your OTP.');
      }
    } catch (err: any) {
      setError('Failed to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Page Content */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
        <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-xl border border-border animate-in slide-in-from-bottom-4">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Secure Reset</h2>
            <p className="text-muted-foreground mt-2">Enter the verification code and set your new password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
             {/* Email (Disabled) */}
             <div className="space-y-2 opacity-70">
              <Label htmlFor="email">Resetting password for:</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted border-dashed"
              />
            </div>

            {/* OTP */}
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code (6-digit OTP)</Label>
              <Input
                id="otp"
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                required
                className="text-center text-2xl tracking-[10px] font-bold py-6 focus:ring-accent"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="pr-10"
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

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {message}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isLoading || !!message || !email}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                'Save New Password'
              )}
            </Button>

            <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              Cancel and return to login
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

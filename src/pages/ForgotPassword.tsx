import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, AlertCircle, ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        // Navigate to reset password page after a short delay
        setTimeout(() => {
          navigate('/reset-password', { state: { email } });
        }, 3000);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err: any) {
      setError('Failed to connect to the server. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Decorative (Minimized version of Login) */}
      <div className="hidden lg:flex lg:w-1/3 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent/20" />
        <div className="relative z-10 flex flex-col justify-center p-8 text-primary-foreground">
          <Link to="/login" className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground mb-12 w-fit">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-6">
            <Mail className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Password Recovery</h1>
          <p className="text-lg text-primary-foreground/80">
            Don't worry, it happens to the best of us. We'll help you get back on the road.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-left mb-8">
            <Link to="/login" className="lg:hidden flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 w-fit">
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
            <div className="lg:hidden w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-4">
              <Car className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Forgot Password?</h2>
            <p className="text-muted-foreground mt-2">
              Enter email address registered with your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="traveller@example.com"
                required
                className="gov-input"
                disabled={isLoading || !!message}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {message && (
              <div className="flex flex-col gap-2 text-emerald-600 text-sm bg-emerald-50 p-4 rounded-lg border border-emerald-100 animate-in zoom-in-95">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="font-medium">{message}</p>
                </div>
                <p className="text-emerald-600/80">Redirecting you to reset page...</p>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isLoading || !!message}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                'Send Reset OTP'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Remembered your password?{' '}
              <Link to="/login" className="text-accent font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

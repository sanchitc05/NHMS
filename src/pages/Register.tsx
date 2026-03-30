import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    vehicleNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); 
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(formData.password) },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(formData.password) },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  // Validate password match
  if (formData.password !== formData.confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  // Validate all password requirements
  const allRequirementsMet = passwordRequirements.every(req => req.met);
  if (!allRequirementsMet) {
    setError('Please meet all password requirements');
    return;
  }

  setIsLoading(true);

  try {
    const success = await register(
      formData.name,
      formData.email,
      formData.password,
      formData.vehicleNumber
    );

    if (success) {
      navigate('/dashboard');
    } else {
      setError('Signup failed. Please try again.');
    }
  } catch (err: any) {
    console.error('REGISTER PAGE ERROR:', err);
    setError(err?.message || 'Signup failed. Please try again.');
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
          <h1 className="text-4xl font-bold mb-4">Join NHMS Today</h1>
          <p className="text-xl text-primary-foreground/80 mb-8">
            Your gateway to safer highway travel
          </p>
          <ul className="space-y-4 text-primary-foreground/70">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              Access real-time traffic and weather updates
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              Plan routes with accurate toll estimates
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              Get instant emergency assistance
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              Receive speed limit alerts for safer driving
            </li>
          </ul>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/10 rounded-full -mr-32 -mb-32" />
        <div className="absolute top-20 right-20 w-32 h-32 bg-accent/5 rounded-full" />
      </div>

      {/* Right Panel - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="lg:hidden w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
              <Car className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
            <p className="text-muted-foreground mt-2">Register as a highway traveller</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
                className="gov-input"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                className="gov-input"
              />
            </div>

            {/* Vehicle Number */}
            <div className="space-y-2">
              <Label htmlFor="vehicleNumber">Vehicle Number (Optional)</Label>
              <Input
                id="vehicleNumber"
                name="vehicleNumber"
                type="text"
                value={formData.vehicleNumber}
                onChange={handleChange}
                placeholder="e.g., MH-01-AB-1234"
                className="gov-input"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
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
              {/* Password Requirements */}
              <div className="space-y-1 mt-2">
                {passwordRequirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <CheckCircle2
                      className={`w-3 h-3 ${req.met ? 'text-success' : 'text-muted-foreground'}`}
                    />
                    <span className={req.met ? 'text-success' : 'text-muted-foreground'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Password */}
<div className="space-y-2">
  <Label htmlFor="confirmPassword">Confirm Password</Label>
  <div className="relative">
    <Input
      id="confirmPassword"
      name="confirmPassword"
      type={showConfirmPassword ? 'text' : 'password'}
      value={formData.confirmPassword}
      onChange={handleChange}
      placeholder="Confirm your password"
      required
      className="gov-input pr-10"
    />
    <button
      type="button"
      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    >
      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>

            {/* Login Link */}
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-accent font-medium hover:underline">
                Sign in here
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

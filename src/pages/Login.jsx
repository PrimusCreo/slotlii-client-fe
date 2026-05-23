import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import AuthSlideshow from '@/components/auth-slideshow';
import darkLogo from '../assets/dark-logo.png';

function GmailIcon({ className = 'size-4' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 193"
      className={className}
      aria-hidden
    >
      <path fill="#4285f4" d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z" />
      <path fill="#34a853" d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837-27.026 25.798z" />
      <path fill="#ea4335" d="M58.182 93.14L54.024 54.65l4.158-37.486L128 69.868l69.818-52.704 4.65 34.082-4.65 41.894L128 145.84z" />
      <path fill="#fbbc04" d="M197.818 17.164v75.976l58.182-44.586v-22.69c0-21.012-23.985-32.992-40.727-20.305z" />
      <path fill="#c5221f" d="M0 49.504l26.759 20.32L58.182 93.14V17.164L40.727 3.873C23.957-8.814 0 3.166 0 24.178z" />
    </svg>
  );
}

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleGmailClick() {
    toast.info('Google sign-in is coming soon.');
  }

  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left pane — form */}
      <div className="relative flex min-h-screen flex-col px-6 py-10 sm:px-10 lg:px-12">
        <Link to="/login" className="flex items-center gap-2">
          <img src={darkLogo} alt="Slotlii" className="size-8 rounded-md" />
          <span className="text-sm font-semibold tracking-tight">Slotlii</span>
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight">Login to your account</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email below to login to your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="m@example.com"
                  autoComplete="email"
                  autoFocus
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                id="login-submit"
                type="submit"
                className="h-10 w-full"
                disabled={loading}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Login'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 w-full gap-2"
                onClick={handleGmailClick}
              >
                <GmailIcon className="size-4" />
                Log in with Gmail
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Sign up
                </Link>
              </p>

              <p className="text-balance text-center text-[11px] leading-relaxed text-muted-foreground">
                By clicking continue, you agree to our{' '}
                <a
                  href="https://slotlii.com/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="https://slotlii.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Right pane — product slideshow */}
      <div className="relative hidden lg:block">
        <AuthSlideshow ariaLabel="Slotlii product highlights" />
      </div>
    </div>
  );
}

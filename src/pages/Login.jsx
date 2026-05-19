import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, HeartPulse, Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
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
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -right-32 size-[34rem] rounded-full bg-primary/30 blur-[120px] opacity-60" />
        <div className="absolute bottom-[-12rem] left-[-8rem] size-[28rem] rounded-full bg-chart-2/30 blur-[120px] opacity-50" />
        <div className="absolute left-1/2 top-1/2 size-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-3/20 blur-[100px] opacity-40" />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-2xl backdrop-blur-xl">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <HeartPulse className="size-7" />
            </div>
            <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
            <CardDescription>Sign in to your Slotlii Clinic dashboard</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your clinic username"
                  autoComplete="username"
                  autoFocus
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="h-11 pr-10"
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
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <Button
                id="login-submit"
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Sign in'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Contact your administrator for credentials
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

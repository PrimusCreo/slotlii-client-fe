import { useEffect, useMemo, useState } from 'react';
import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
  Link,
} from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import darkLogo from '../assets/dark-logo.png';

/**
 * Single page that handles both ends of the email-verification flow:
 *
 *   /verify-email?token=...  →  signup auto-verify + auto-login
 *   /set-password?token=...  →  admin invite, user picks a password,
 *                                account is created, auto-login
 *
 * The route mode is decided by `useLocation().pathname` so a stale token
 * sent via the wrong link still produces a sensible UI (the GET /invite
 * call returns the canonical purpose; we steer the UI from there).
 */
export default function VerifyEmail() {
  const { isAuthenticated, applyAuthPayload } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const token = params.get('token');

  const isSetPasswordRoute = location.pathname.startsWith('/set-password');

  const [status, setStatus] = useState('loading'); // loading | needs_password | verifying | success | error
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → bounce home. Done before any token work.
  const goingToDashboard = useMemo(
    () => isAuthenticated && status === 'success',
    [isAuthenticated, status]
  );

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing verification token.');
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const { data } = await api.getInvite(token);
        if (cancelled) return;
        const meta = data.data;
        setInvite(meta);

        if (meta.purpose === 'admin_invite') {
          // Admin invite — user must pick a password.
          setStatus('needs_password');
          return;
        }

        // Signup invite — verify immediately and auto-login.
        setStatus('verifying');
        const verifyRes = await api.verifyEmail(token);
        if (cancelled) return;
        applyAuthPayload(verifyRes.data.data);
        setStatus('success');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(
          err.response?.data?.error ||
            'This verification link is invalid or has expired.'
        );
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // After a successful flow, head to the dashboard.
  useEffect(() => {
    if (goingToDashboard) {
      const t = setTimeout(() => navigate('/', { replace: true }), 800);
      return () => clearTimeout(t);
    }
  }, [goingToDashboard, navigate]);

  async function handleSetPassword(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.setPassword(token, password);
      applyAuthPayload(res.data.data);
      setStatus('success');
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Could not finish creating your account. Try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Already logged-in users who somehow land here (e.g. after success).
  if (isAuthenticated && status !== 'success' && status !== 'verifying') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left pane */}
      <div className="relative flex min-h-screen flex-col px-6 py-10 sm:px-10 lg:px-12">
        <Link to="/login" className="flex items-center gap-2">
          <img src={darkLogo} alt="Slotlii" className="size-8 rounded-md" />
          <span className="text-sm font-semibold tracking-tight">Slotlii</span>
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            {(status === 'loading' || status === 'verifying') && (
              <div className="text-center">
                <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
                <h1 className="mt-6 text-2xl font-bold tracking-tight">
                  {status === 'loading'
                    ? 'Checking your invite…'
                    : 'Verifying your email…'}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hang tight, this only takes a moment.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 className="size-7" />
                </div>
                <h1 className="mt-6 text-2xl font-bold tracking-tight">
                  You're all set
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your account is verified. Redirecting you to your dashboard…
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <XCircle className="size-7" />
                </div>
                <h1 className="mt-6 text-2xl font-bold tracking-tight">
                  {isSetPasswordRoute
                    ? "We couldn't open this invite"
                    : "We couldn't verify this link"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                <div className="mt-6 flex flex-col gap-2">
                  <Link to="/signup">
                    <Button variant="outline" className="h-10 w-full">
                      Request a new link
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="ghost" className="h-10 w-full">
                      Back to login
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {status === 'needs_password' && (
              <>
                <div className="mb-8 text-center">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Set your password
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {invite?.clinicName ? (
                      <>
                        Finish setting up{' '}
                        <span className="font-medium text-foreground">
                          {invite.clinicName}
                        </span>{' '}
                        on Slotlii. Choose a password for{' '}
                        <span className="font-medium text-foreground">
                          {invite.email}
                        </span>
                        .
                      </>
                    ) : (
                      <>
                        Choose a password for{' '}
                        <span className="font-medium text-foreground">
                          {invite?.email}
                        </span>{' '}
                        to finish creating your Slotlii account.
                      </>
                    )}
                  </p>
                </div>

                <form onSubmit={handleSetPassword} className="space-y-5">
                  {error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="set-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="set-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        autoFocus
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

                  <div className="space-y-2">
                    <Label htmlFor="set-confirm">Confirm password</Label>
                    <Input
                      id="set-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="h-10"
                    />
                  </div>

                  <Button type="submit" className="h-10 w-full" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      'Create account'
                    )}
                  </Button>

                  <p className="text-balance text-center text-[11px] leading-relaxed text-muted-foreground">
                    By clicking continue, you agree to our{' '}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Privacy Policy
                    </a>
                    .
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right pane — brand panel */}
      <div className="relative hidden overflow-hidden bg-muted lg:block">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 size-[34rem] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute bottom-[-12rem] left-[-8rem] size-[28rem] rounded-full bg-chart-2/20 blur-[120px]" />
        </div>

        <div className="relative flex h-full flex-col items-center justify-center px-12 text-center">
          <div className="rounded-3xl bg-background/40 p-6 shadow-xl shadow-primary/10 ring-1 ring-border/50 backdrop-blur-md">
            <img src={darkLogo} alt="Slotlii" className="size-28 rounded-2xl" />
          </div>
          <h2 className="mt-8 text-3xl font-bold tracking-tight">
            Welcome to Slotlii
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            One last step and your dashboard is ready.
          </p>
        </div>
      </div>
    </div>
  );
}

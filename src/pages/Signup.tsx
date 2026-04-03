import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

export default function Signup() {
  const { user, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? undefined;

  const [step, setStep] = useState<1 | 2>(inviteToken ? 2 : 1);
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (user) return <Navigate to="/templates" replace />;

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: err } = await signUp(email, password, orgName, inviteToken);
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
              <Megaphone className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button variant="outline" className="w-full">Back to login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
            <Megaphone className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">
            {step === 1 ? 'Create your organization' : 'Create your account'}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? 'Your team will share templates, ad accounts, and campaigns under this organization.'
              : inviteToken
                ? 'You\'ve been invited to join an organization. Create your account below.'
                : `Setting up "${orgName}". Enter your credentials below.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. BrandPeak, Gorilla Wear"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full">Continue</Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
              {!inviteToken && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>
                  Back
                </Button>
              )}
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

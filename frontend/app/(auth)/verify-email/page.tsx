'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MailIcon, ExternalLinkIcon, RefreshCwIcon, CheckCircleIcon } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState<string>('');
    const [checking, setChecking] = useState(false);
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        // Get email from localStorage
        const pendingEmail = localStorage.getItem('pending_email');
        if (pendingEmail) {
            setEmail(pendingEmail);
        }

        // Check if we have a verification token in URL (from email link)
        const token = searchParams.get('token');
        if (token) {
            verifyEmail(token);
        }
    }, [searchParams]);

    const verifyEmail = async (token: string) => {
        try {
            setChecking(true);
            // This endpoint will handle email confirmation
            const response = await apiClient.post('/auth/verify-email', { token });

            if (response.data.success) {
                setVerified(true);
                localStorage.removeItem('pending_email');

                // Auto-login after verification
                localStorage.setItem('access_token', response.data.access_token);

                toast.success('Email verified! Redirecting to dashboard...');
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);
            }
        } catch (error) {
            toast.error('Verification failed. Please try again.');
        } finally {
            setChecking(false);
        }
    };

    const openMailpit = () => {
        window.open('http://localhost:54324', '_blank');
    };

    const checkVerification = async () => {
        try {
            setChecking(true);
            // Check if email is verified
            const response = await apiClient.post('/auth/check-verification', { email });

            if (response.data.verified) {
                setVerified(true);
                localStorage.removeItem('pending_email');

                if (response.data.access_token) {
                    localStorage.setItem('access_token', response.data.access_token);
                }

                toast.success('Email verified! Redirecting...');
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);
            } else {
                toast.info('Email not verified yet. Check your inbox.');
            }
        } catch (error) {
            toast.error('Failed to check verification status');
        } finally {
            setChecking(false);
        }
    };

    if (verified) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                            <CheckCircleIcon className="h-8 w-8 text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Email Verified!</h2>
                        <p className="text-gray-400 mb-4">
                            Your email has been successfully verified. Redirecting to dashboard...
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                        <MailIcon className="h-8 w-8 text-purple-400" />
                    </div>
                    <CardTitle className="text-2xl">Check Your Email</CardTitle>
                    <CardDescription>
                        We've sent a verification link to <strong>{email || 'your email'}</strong>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                        <p className="text-sm text-yellow-400 font-medium mb-2">
                            📧 Local Development Email Testing
                        </p>
                        <p className="text-xs text-gray-400 mb-3">
                            Emails are captured by Mailpit. Open the Mailpit UI to view the verification email.
                        </p>
                        <Button
                            onClick={openMailpit}
                            variant="outline"
                            className="w-full"
                        >
                            <ExternalLinkIcon className="h-4 w-4 mr-2" />
                            Open Mailpit (Local Email Inbox)
                        </Button>
                    </div>

                    <div className="text-center text-sm text-gray-400">
                        <p>Didn't receive the email? Check your spam folder or</p>
                        <Button
                            variant="link"
                            className="text-purple-400"
                            onClick={checkVerification}
                            disabled={checking}
                        >
                            {checking ? (
                                <>
                                    <RefreshCwIcon className="h-3 w-3 mr-1 animate-spin" />
                                    Checking...
                                </>
                            ) : (
                                <>
                                    <RefreshCwIcon className="h-3 w-3 mr-1" />
                                    I've verified my email
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-800">
                        <p>Verification link expires in 24 hours</p>
                        <Button variant="link" size="sm" className="text-gray-400" asChild>
                            <Link href="/register">Use different email</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center px-4">
                    Loading...
                </div>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    );
}
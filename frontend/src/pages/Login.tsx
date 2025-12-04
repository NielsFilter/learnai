import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Github, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
    const { signInWithGoogle, signInWithGithub, user } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <Card className="w-full max-w-md space-y-8 text-center">
                <div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                        Welcome to LearnAI
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Sign in to access your projects and quizzes
                    </p>
                </div>
                <div className="space-y-4">
                    <Button
                        variant="secondary"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={signInWithGoogle}
                    >
                        <Mail className="w-5 h-5" />
                        Sign in with Google
                    </Button>
                    <Button
                        variant="secondary"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={signInWithGithub}
                    >
                        <Github className="w-5 h-5" />
                        Sign in with GitHub
                    </Button>
                </div>
            </Card>
        </div>
    );
};

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Github, Mail, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import loginBg from '../assets/login-bg.png';

export const Login: React.FC = () => {
    const { signInWithGoogle, signInWithGithub, user } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Background Image */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `url(${loginBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            </div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md p-8 mx-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 transform transition-all duration-500 hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-8">
                    <div className="text-center space-y-2 mb-8">
                        <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-4 ring-1 ring-white/30 shadow-lg">
                            <Sparkles className="w-8 h-8 text-cyan-300" />
                        </div>
                        <h2 className="text-4xl font-bold text-white tracking-tight drop-shadow-sm">
                            Learn using AI
                        </h2>
                        <p className="text-blue-100/80 text-lg font-light">
                            Unlock your potential with AI-powered learning
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Button
                            variant="primary"
                            className="w-full h-12 bg-white/5 text-white border border-white/10 flex items-center justify-center gap-3 text-base font-medium hover:bg-white/10 hover:scale-[1.02] transition-all duration-200 shadow-lg group backdrop-blur-md"
                            onClick={signInWithGoogle}
                        >
                            <Mail className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
                            Continue with Google
                        </Button>

                        <Button
                            variant="primary"
                            className="w-full h-12 bg-[#24292e] text-white flex items-center justify-center gap-3 text-base font-medium hover:bg-[#2f363d] hover:scale-[1.02] transition-all duration-200 shadow-lg border border-white/10 group"
                            onClick={signInWithGithub}
                        >
                            <Github className="w-5 h-5 group-hover:text-white transition-colors" />
                            Continue with GitHub
                        </Button>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-blue-200/60 font-light">
                            By continuing, you agree to our Terms of Service and Privacy Policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

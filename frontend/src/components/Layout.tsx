import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import loginBg from '../assets/login-bg.png';

export const Layout: React.FC<{ children: React.ReactNode, headerContent?: React.ReactNode }> = ({ children, headerContent }) => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen relative text-gray-100 overflow-hidden font-sans">
            {/* Global Background */}
            <div
                className="fixed inset-0 z-0"
                style={{
                    backgroundImage: `url(${loginBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            </div>

            {/* Glass Navbar */}
            <nav className="sticky top-0 z-50 w-full bg-white/5 backdrop-blur-xl border-b border-white/10 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-6">
                            <Link to="/" className="flex-shrink-0 transition-transform hover:scale-105 duration-200">
                                <Logo />
                            </Link>
                            {headerContent}
                        </div>
                        <div className="flex items-center gap-4">
                            {user && (
                                <>
                                    <span className="hidden sm:block text-sm text-blue-100/80 font-medium">{user.email}</span>
                                    <button
                                        onClick={logout}
                                        className="text-sm px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all duration-200"
                                    >
                                        Logout
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
                {children}
            </main>
        </div>
    );
};

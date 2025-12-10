import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode, headerContent?: React.ReactNode }> = ({ children, headerContent }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <nav className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-6">
                            <Link to="/" className="flex-shrink-0 font-bold text-xl text-blue-600 hover:text-blue-700 transition-colors">
                                LearnAI
                            </Link>
                            {headerContent}
                        </div>
                        <div className="flex items-center gap-4">
                            {user && (
                                <>
                                    <span className="text-sm text-gray-500">{user.email}</span>
                                    <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Logout</button>
                                </>
                            )}
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                aria-label="Toggle theme"
                            >
                                {theme === 'light' ? (
                                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                ) : (
                                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                {children}
            </main>
        </div>
    );
};

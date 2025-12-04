import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <nav className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex-shrink-0 font-bold text-xl text-blue-600">LearnAI</div>
                        <div className="flex items-center gap-4">
                            {user && (
                                <>
                                    <span className="text-sm text-gray-500">{user.email}</span>
                                    <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Logout</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
};

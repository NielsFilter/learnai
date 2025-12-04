import React from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

export const Profile: React.FC = () => {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <Layout>
            <h1 className="text-2xl font-bold mb-6">Profile</h1>

            <Card className="max-w-md mx-auto space-y-6">
                <div className="flex flex-col items-center space-y-4">
                    {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-24 h-24 rounded-full" />
                    ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-3xl font-bold text-gray-500">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                    )}

                    <div className="text-center">
                        <h2 className="text-xl font-bold">{user.displayName || 'User'}</h2>
                        <p className="text-gray-500">{user.email}</p>
                    </div>
                </div>

                <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">User ID</h3>
                    <code className="bg-gray-100 dark:bg-gray-700 p-2 rounded block text-xs break-all">
                        {user.uid}
                    </code>
                </div>

                <Button variant="danger" className="w-full" onClick={logout}>
                    Logout
                </Button>
            </Card>
        </Layout>
    );
};

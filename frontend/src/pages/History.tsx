import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest } from '../lib/api';
import { Card } from '../components/Card';
import { Link } from 'react-router-dom';

interface QuizResult {
    quizId: string;
    projectId: string;
    score: number;
    total: number;
    submittedAt: string;
}

export const History: React.FC = () => {
    const [history, setHistory] = useState<QuizResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const stats = await apiRequest('/stats');
                // Sort by date desc
                const sorted = stats.history.sort((a: any, b: any) =>
                    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
                );
                setHistory(sorted);
            } catch (error) {
                console.error('Failed to fetch history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    if (loading) return <Layout><div>Loading...</div></Layout>;

    return (
        <Layout>
            <h1 className="text-2xl font-bold mb-6">Quiz History</h1>

            <div className="space-y-4">
                {history.length === 0 && (
                    <p className="text-gray-500">No quizzes taken yet.</p>
                )}

                {history.map((item, idx) => (
                    <Card key={idx} className="flex justify-between items-center">
                        <div>
                            <div className="font-medium">Quiz Result</div>
                            <div className="text-sm text-gray-500">
                                {new Date(item.submittedAt).toLocaleDateString()} at {new Date(item.submittedAt).toLocaleTimeString()}
                            </div>
                            <Link to={`/project/${item.projectId}`} className="text-sm text-blue-600 hover:underline">
                                View Project
                            </Link>
                        </div>
                        <div className="text-xl font-bold">
                            <span className={item.score / item.total >= 0.7 ? 'text-green-600' : 'text-red-600'}>
                                {item.score}
                            </span>
                            <span className="text-gray-400"> / {item.total}</span>
                        </div>
                    </Card>
                ))}
            </div>
        </Layout>
    );
};

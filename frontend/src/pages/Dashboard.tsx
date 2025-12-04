import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { apiRequest } from '../lib/api';
import { Link } from 'react-router-dom';
import { Plus, BookOpen } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CreateProjectModal } from '../components/CreateProjectModal';

interface Project {
    _id: string;
    name: string;
    subject: string;
    createdAt: string;
}

interface Stats {
    history: any[];
    averageScore: number;
    totalQuizzes: number;
}

export const Dashboard: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchData = async () => {
        try {
            const [projectsData, statsData] = await Promise.all([
                apiRequest('/projects'),
                apiRequest('/stats')
            ]);
            setProjects(projectsData);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return <Layout><div>Loading...</div></Layout>;
    }

    return (
        <Layout>
            <div className="space-y-8">
                {/* Stats Section */}
                <section>
                    <h2 className="text-2xl font-bold mb-4">Your Progress</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <Card>
                            <h3 className="text-sm font-medium text-gray-500">Average Score</h3>
                            <p className="text-3xl font-bold">{stats?.averageScore}%</p>
                        </Card>
                        <Card>
                            <h3 className="text-sm font-medium text-gray-500">Total Quizzes</h3>
                            <p className="text-3xl font-bold">{stats?.totalQuizzes}</p>
                        </Card>
                    </div>

                    <Card className="h-64">
                        <h3 className="text-sm font-medium text-gray-500 mb-4">Performance History</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats?.history}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="submittedAt" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                                <YAxis />
                                <Tooltip labelFormatter={(date) => new Date(date).toLocaleString()} />
                                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </section>

                {/* Projects Section */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Your Projects</h2>
                        <Button className="flex items-center gap-2" onClick={() => setIsModalOpen(true)}>
                            <Plus className="w-4 h-4" />
                            New Project
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Link key={project._id} to={`/project/${project._id}`}>
                                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">{project.name}</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-4">{project.subject}</p>
                                    <div className="mt-auto text-sm text-gray-400">
                                        Created {new Date(project.createdAt).toLocaleDateString()}
                                    </div>
                                </Card>
                            </Link>
                        ))}

                        {projects.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                <p className="text-gray-500">No projects yet. Create one to get started!</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <CreateProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onProjectCreated={fetchData}
            />
        </Layout>
    );
};

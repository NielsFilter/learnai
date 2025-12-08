import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { apiRequest } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { ConfirmModal } from '../components/ConfirmModal';

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
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Delete Confirmation State
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const promptDeleteProject = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setProjectToDelete(projectId);
    };

    const handleConfirmDelete = async () => {
        if (!projectToDelete) return;

        setIsDeleting(true);
        try {
            await apiRequest(`/projects?id=${projectToDelete}`, 'DELETE');
            await fetchData();
            setProjectToDelete(null); // Close modal
        } catch (error) {
            console.error('Failed to delete project:', error);
            // Optionally set error state to show in modal/toast
        } finally {
            setIsDeleting(false);
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
                {projects.length > 0 && (
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
                )}

                {/* Projects Section */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Your Projects</h2>
                        <Button className="flex items-center gap-2" onClick={() => setIsCreateModalOpen(true)}>
                            <Plus className="w-4 h-4" />
                            New Project
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Card
                                key={project._id}
                                className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col"
                                onClick={() => navigate(`/project/${project._id}`)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                        <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                                    </div>
                                    <button
                                        onClick={(e) => promptDeleteProject(e, project._id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="Delete Project"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                <h3 className="text-xl font-bold mb-2">{project.name}</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">{project.subject}</p>
                                <div className="mt-auto text-sm text-gray-400">
                                    Created {new Date(project.createdAt).toLocaleDateString()}
                                </div>
                            </Card>
                        ))}

                        {projects.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                                    <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">No projects yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first project to start learning.</p>
                                <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Project
                                </Button>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onProjectCreated={fetchData}
            />

            <ConfirmModal
                isOpen={!!projectToDelete}
                onClose={() => setProjectToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Project?"
                message="Are you sure you want to delete this project? This action cannot be undone and will permanently delete all uploaded documents and chat history."
                confirmText="Delete Project"
                isDestructive={true}
                isLoading={isDeleting}
            />
        </Layout>
    );
};

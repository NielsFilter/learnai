import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { apiRequest } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

    // Process data for the chart
    const { chartData, subjects } = React.useMemo(() => {
        if (!stats?.history || !projects.length) return { chartData: [], subjects: [] };

        const subjectSet = new Set<string>();
        const data = stats.history.map(entry => {
            const project = projects.find(p => p._id === entry.projectId);
            const subject = project ? project.subject : 'Other';
            subjectSet.add(subject);

            return {
                submittedAt: entry.submittedAt,
                [subject]: Math.round((entry.score / entry.total) * 100), // Calculate percentage
                originalScore: entry.score,
                total: entry.total,
                quizId: entry.quizId // Keep track for uniqueness if needed
            };
        }); /* .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()) */
        // Backend already sorts by submittedAt, but safe to leave as is or re-sort if needed. 
        // Backend sort is: { "$sort": { "submittedAt": 1 } }

        return { chartData: data, subjects: Array.from(subjectSet) };
    }, [stats, projects]);

    const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#4f46e5'];

    if (loading) {
        return <Layout><div>Loading...</div></Layout>;
    }

    return (
        <Layout>
            <div className="space-y-8">
                {/* Stats Section */}
                {projects.length > 0 && (
                    <section className="animate-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
                            Your Progress
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <Card className="relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500" />
                                <h3 className="text-sm font-medium text-blue-200/70 mb-1">Average Score</h3>
                                <p className="text-4xl font-bold text-white tracking-tight">{stats?.averageScore}%</p>
                            </Card>
                            <Card className="relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500" />
                                <h3 className="text-sm font-medium text-purple-200/70 mb-1">Total Quizzes</h3>
                                <p className="text-4xl font-bold text-white tracking-tight">{stats?.totalQuizzes}</p>
                            </Card>
                        </div>

                        <Card className="h-80 mb-2 pb-12">
                            <h3 className="text-sm font-medium text-gray-400 mb-6">Performance History</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="submittedAt"
                                        tickFormatter={(date) => new Date(date).toLocaleDateString()}
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(23, 25, 35, 0.9)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            backdropFilter: 'blur(10px)',
                                            color: '#fff'
                                        }}
                                        itemStyle={{ color: '#fff' }}
                                        labelFormatter={(date) => new Date(date).toLocaleString()}
                                        formatter={(value: number, name: string) => [`${value}%`, name]}
                                    />
                                    <Legend
                                        wrapperStyle={{ paddingTop: '0' }}
                                        formatter={(value) => <span className="text-gray-300 font-medium">{value}</span>}
                                    />
                                    {subjects.map((subject, index) => (
                                        <Line
                                            key={subject}
                                            connectNulls
                                            type="monotone"
                                            dataKey={subject}
                                            stroke={colors[index % colors.length]}
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 0, fill: colors[index % colors.length] }}
                                            activeDot={{ r: 8, strokeWidth: 0, fill: colors[index % colors.length] }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </Card>
                    </section>
                )}

                {/* Projects Section */}
                <section className="animate-in slide-in-from-bottom-4 duration-500 delay-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
                            Your Projects
                        </h2>
                        <Button
                            className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-0 shadow-lg shadow-cyan-900/20"
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            <Plus className="w-4 h-4" />
                            New Project
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Card
                                key={project._id}
                                className="h-full flex flex-col group hover:ring-1 hover:ring-cyan-500/30"
                                onClick={() => navigate(`/project/${project._id}`)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors duration-300">
                                        <BookOpen className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <button
                                        onClick={(e) => promptDeleteProject(e, project._id)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Project"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-white group-hover:text-cyan-100 transition-colors">{project.name}</h3>
                                <p className="text-gray-400 mb-6 text-sm">{project.subject}</p>
                                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                                    <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                                    {/* Optional: Add usage stats or arrow icon here */}
                                </div>
                            </Card>
                        ))}

                        {projects.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl backdrop-blur-sm">
                                <div className="p-4 bg-white/5 rounded-full mb-6 ring-1 ring-white/10">
                                    <BookOpen className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-white">No projects yet</h3>
                                <p className="text-gray-400 mb-8 max-w-sm text-center">Create your first project to start generating quizzes and learning with AI.</p>
                                <Button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
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

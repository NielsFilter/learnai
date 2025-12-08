import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { apiRequest } from '../lib/api';
import { X, Upload } from 'lucide-react';
import { auth } from '../lib/firebase';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onProjectCreated }) => {
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [files, setFiles] = useState<FileList | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Create Project
            const project = await apiRequest('/projects', 'POST', { name, subject });
            const projectId = project._id;

            // 2. Upload Files
            if (files && files.length > 0) {
                const user = auth.currentUser;
                if (!user) throw new Error('User not authenticated');
                const token = await user.getIdToken();

                const uploadPromises = Array.from(files).map(async (file) => {
                    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/upload`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'X-Project-Id': projectId,
                            'X-Filename': file.name,
                            'Content-Type': file.type || 'application/octet-stream',
                        },
                        body: file // Send file directly as body
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to upload ${file.name}: ${errorText}`);
                    }
                });

                await Promise.all(uploadPromises);
            }

            onProjectCreated();
            onClose();
            setName('');
            setSubject('');
            setFiles(null);
        } catch (err: any) {
            setError(err.message || 'Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4">Create New Project</h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Project Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="e.g., Biology 101"
                    />
                    <Input
                        label="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        placeholder="e.g., Photosynthesis"
                    />

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Document (PDF/Text)</label>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative">
                            <input
                                type="file"
                                onChange={(e) => setFiles(e.target.files)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept=".pdf,.txt"
                                multiple
                                required
                            />
                            <div className="flex flex-col items-center gap-2 text-gray-500">
                                <Upload className="w-6 h-6" />
                                <span className="text-sm">
                                    {files && files.length > 0
                                        ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
                                        : "Click to upload files"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Project'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Layout } from '../components/Layout';
import { apiRequest } from '../lib/api';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Send, MessageSquare, FileQuestion, BookOpen, ChevronRight, ChevronDown, Trash2, Music, Sparkles, AlertCircle, Loader2, Plus, FileText } from 'lucide-react';

interface Project {
    _id: string;
    name: string;
    subject: string;
    status?: 'created' | 'processing' | 'ready';
    processingCount?: number;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface Document {
    _id?: string; // Add optional ID if available from backend, though we mostly use filename
    filename: string;
    summary: string;
    uploadedAt: string;
    isRegenerating?: boolean;
}

interface Song {
    _id: string;
    title: string;
    genre: string;
    lyrics?: string;
    originalPrompt?: string;
    audioUrl?: string; // If null, check status?
    status: 'created' | 'pending' | 'completed';
    createdAt: string;
}

export const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'quiz' | 'songs'>('overview');
    const [loading, setLoading] = useState(true);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [expandedDocs, setExpandedDocs] = useState<Record<number, boolean>>({});
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Quiz State
    const [quizState, setQuizState] = useState<{
        quizId: string | null;
        questions: any[];
        answers: Record<number, string>;
        results: any | null;
    }>({ quizId: null, questions: [], answers: {}, results: null });
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);
    const [score, setScore] = useState(0);
    const [generatingQuiz, setGeneratingQuiz] = useState(false);
    const [submittingQuiz, setSubmittingQuiz] = useState(false);
    const [quizTopic, setQuizTopic] = useState('');
    const [showClearChatModal, setShowClearChatModal] = useState(false);

    // Songs State
    const [songs, setSongs] = useState<Song[]>([]);
    const [generatingSong, setGeneratingSong] = useState(false);
    const [songForm, setSongForm] = useState({
        title: '',
        genre: 'Pop',
        lyrics: '',
        duration: 30
    });

    // Lyrics Generation State
    const [lyricsPanelOpen, setLyricsPanelOpen] = useState(false);
    const [lyricsPrompt, setLyricsPrompt] = useState('');
    const [generatingLyrics, setGeneratingLyrics] = useState(false);
    const [expandedSongLyrics, setExpandedSongLyrics] = useState<Record<string, boolean>>({});


    // Error Handling State
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [clearingChat, setClearingChat] = useState(false);
    const [deletingSongId, setDeletingSongId] = useState<string | null>(null);

    // File Upload State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Polling for processing status
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        if (project?.status === 'processing') {
            interval = setInterval(async () => {
                if (!id) return;
                try {
                    const projects = await apiRequest('/projects');
                    const found = projects.find((p: Project) => p._id === id);
                    if (found) {
                        setProject(found);
                        // If status changed to ready, refresh documents
                        if (found.status === 'ready' && project.status === 'processing') {
                            const docs = await apiRequest(`/documents?projectId=${id}`);
                            setDocuments(docs);
                        }
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }, 3000); // Poll every 3 seconds
        }

        return () => clearInterval(interval);
    }, [project?.status, id]);

    useEffect(() => {
        const fetchProjectData = async () => {
            if (!id) return;
            try {
                const projects = await apiRequest('/projects');
                const found = projects.find((p: Project) => p._id === id);
                if (found) {
                    setProject(found);
                    const [history, docs] = await Promise.all([
                        apiRequest(`/chat?projectId=${id}`),
                        apiRequest(`/documents?projectId=${id}`)
                    ]);

                    setMessages(history.map((h: any) => ([
                        { role: 'user', content: h.message, timestamp: h.timestamp },
                        { role: 'assistant', content: h.answer, timestamp: h.timestamp }
                    ])).flat());
                    setDocuments(docs);
                }
            } catch (error) {
                console.error('Failed to fetch project data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectData();
    }, [id]);

    useEffect(() => {
        if (documents.length <= 1 && documents.length > 0) {
            setExpandedDocs({ 0: true });
        } else {
            setExpandedDocs({});
        }

        // Force overview tab if no documents
        if (documents.length === 0 && activeTab !== 'overview') {
            setActiveTab('overview');
        }
    }, [documents, activeTab]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (activeTab === 'songs' && id) {
            const fetchSongs = async () => {
                try {
                    const data = await apiRequest(`/songs?projectId=${id}`);
                    setSongs(data);
                } catch (error) {
                    console.error('Failed to fetch songs:', error);
                }
            };
            fetchSongs();
        }
    }, [messages, activeTab, id]);

    const handleGenerateLyrics = async () => {
        if (!id || !lyricsPrompt.trim()) return;
        setGeneratingLyrics(true);
        try {
            const response = await apiRequest('/songs/generate-lyrics', 'POST', {
                projectId: id,
                prompt: lyricsPrompt,
                genre: songForm.genre
            });
            setSongForm(prev => ({ ...prev, lyrics: response.lyrics }));
            setLyricsPanelOpen(false);
        } catch (error) {
            console.error('Failed to generate lyrics:', error);
            setErrorMessage('Failed to generate lyrics.');
            setShowErrorModal(true);
        } finally {
            setGeneratingLyrics(false);
        }
    };



    const handleCreateSong = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        setGeneratingSong(true);
        try {
            const newSong = await apiRequest('/songs', 'POST', {
                projectId: id,
                title: songForm.title,
                genre: songForm.genre,
                lyrics: songForm.lyrics,
                duration: songForm.duration
            });
            setSongs(prev => [newSong, ...prev]);
            setSongForm(prev => ({ ...prev, title: '', lyrics: '' }));
        } catch (error) {
            console.error('Failed to create song:', error);
            setErrorMessage('Failed to generate song. Please try again.');
            setShowErrorModal(true);
        } finally {
            setGeneratingSong(false);
        }
    };

    const handleDeleteSong = async (songId: string) => {
        if (!confirm('Are you sure you want to delete this song?')) return;
        setDeletingSongId(songId);
        try {
            await apiRequest(`/songs?songId=${songId}`, 'DELETE');
            setSongs(prev => prev.filter(s => s._id !== songId));
        } catch (error) {
            console.error('Failed to delete song:', error);
        } finally {
            setDeletingSongId(null);
        }
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || !id) return;

        const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setNewMessage('');
        setSending(true);

        try {
            const response = await apiRequest('/chat', 'POST', { projectId: id, message: text });
            const assistantMsg: ChatMessage = { role: 'assistant', content: response.answer, timestamp: new Date().toISOString() };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleClearChat = () => {
        setShowClearChatModal(true);
    };

    const confirmClearChat = async () => {
        if (!id) return;
        setClearingChat(true);
        try {
            await apiRequest(`/chat?projectId=${id}`, 'DELETE');
            setMessages([]);
            setShowClearChatModal(false);
        } catch (error) {
            console.error('Failed to clear chat:', error);
        } finally {
            setClearingChat(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        await sendMessage(newMessage);
    };

    const handleElaborate = async (explanation: string) => {
        setActiveTab('chat');
        // Small delay to allow tab switch rendering if needed, though React state updates are batched usually.
        // We can just call sendMessage.
        await sendMessage(`Please elaborate on: "${explanation}"`);
    };

    const handleRegenerateSummary = async (filename: string) => {
        if (!id) return;

        setDocuments(prev => prev.map(d => d.filename === filename ? { ...d, isRegenerating: true } : d));

        try {
            const response = await apiRequest('/summary/regenerate', 'POST', { projectId: id, filename });
            setDocuments(prev => prev.map(d => d.filename === filename ? { ...d, summary: response.summary, isRegenerating: false } : d));
        } catch (error) {
            console.error('Failed to regenerate summary:', error);
            setDocuments(prev => prev.map(d => d.filename === filename ? { ...d, isRegenerating: false } : d));
        }
    };

    const handleAddDocumentClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !id) return;

        const files = Array.from(e.target.files);
        setUploading(true);
        setProject(prev => prev ? { ...prev, status: 'processing', processingCount: (prev.processingCount || 0) + files.length } : null);

        try {
            // Upload files sequentially or in parallel? Parallel is fine for now.
            await Promise.all(files.map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('projectId', id);

                // We need to use fetch directly or update apiRequest to handle FormData if it doesn't already
                // Assuming apiRequest handles JSON, we might need a separate call for multipart.
                // Let's implement a quick fetch wrapper for upload here or assume apiRequest can be modified/used.
                // Since api.ts is simple, let's just use fetch here for simplicity and control.
                // const token = localStorage.getItem('token'); // If authentication was needed, but it's valid for now.

                // Re-using the env variable logic or just hardcoding the base path from api.ts
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_AZURE_FUNCTIONS_URL ? `${import.meta.env.VITE_AZURE_FUNCTIONS_URL}/api` : 'http://localhost:7071/api');

                const response = await fetch(`${API_BASE_URL}/upload`, {
                    method: 'POST',
                    body: formData,
                    // Content-Type header is set automatically by browser with boundary for FormData
                });

                if (!response.ok) {
                    throw new Error(`Upload failed for ${file.name}`);
                }
            }));

            // After upload triggering, the poll will pick up the status/documents eventually.
            // But we set immediate processing state.
        } catch (error) {
            console.error('Upload failed:', error);
            setErrorMessage('Failed to upload one or more files.');
            setShowErrorModal(true);
            // Revert status if needed or let poll fix it
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDocument = async (filename: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggle
        if (!id) return;

        if (documents.length <= 1) {
            alert("You cannot delete the last document of a project.");
            return;
        }

        if (!confirm(`Are you sure you want to delete "${filename}"? This will remove its summary and associated data.`)) return;

        try {
            await apiRequest(`/documents?projectId=${id}&filename=${encodeURIComponent(filename)}`, 'DELETE');
            setDocuments(prev => prev.filter(d => d.filename !== filename));
            // Also update messages if necessary, or just let them be? 
            // Ideally we might want to clear chat if it was based on this doc, but RAG is complex.
        } catch (error) {
            console.error('Failed to delete document:', error);
            setErrorMessage('Failed to delete document.');
            setShowErrorModal(true);
        }
    };

    const handleGenerateQuiz = async (topic?: string) => {
        if (!id) return;
        setGeneratingQuiz(true);
        try {
            const body: any = { projectId: id };
            if (topic) body.topic = topic;

            const response = await apiRequest('/quiz/generate', 'POST', body);
            setQuizState({
                quizId: response.quizId,
                questions: response.questions,
                answers: {},
                results: null
            });
        } catch (error) {
            console.error('Failed to generate quiz:', error);
        } finally {
            setGeneratingQuiz(false);
            setCurrentQuestionIndex(0);
            setShowFeedback(false);
            setScore(0);
        }
    };

    const handleOptionSelect = (option: string) => {
        if (showFeedback) return; // Prevent changing answer after submission
        setQuizState(prev => ({
            ...prev,
            answers: { ...prev.answers, [currentQuestionIndex]: option }
        }));
    };

    const handleCheckAnswer = () => {
        setShowFeedback(true);
        const currentQuestion = quizState.questions[currentQuestionIndex];
        const selectedAnswer = quizState.answers[currentQuestionIndex];
        if (selectedAnswer === currentQuestion.correctAnswer) {
            setScore(prev => prev + 1);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < quizState.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setShowFeedback(false);
        } else {
            handleSubmitQuiz();
        }
    };

    const handleSubmitQuiz = async () => {
        if (!id || !quizState.quizId) return;
        setSubmittingQuiz(true);
        try {
            const answersArray = quizState.questions.map((_, idx) => quizState.answers[idx]);

            const response = await apiRequest('/quiz/submit', 'POST', {
                quizId: quizState.quizId,
                answers: answersArray
            });

            setQuizState(prev => ({ ...prev, results: response }));
        } catch (error) {
            console.error('Failed to submit quiz:', error);
        } finally {
            setSubmittingQuiz(false);
        }
    };

    if (loading) return <Layout><div>Loading...</div></Layout>;
    if (!project) return <Layout><div>Project not found</div></Layout>;

    return (
        <>
            <Layout headerContent={
                <div className="flex items-center gap-2 text-sm text-gray-500 border-l border-gray-300 dark:border-gray-600 pl-6 h-6">
                    <Link to="/" className="hover:text-blue-600 transition-colors">Projects</Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
                </div>
            }>

                <div className="flex flex-col h-[calc(100vh-8rem)] relative">
                    {/* Processing Overlay */}
                    {project.status === 'processing' && (
                        <div className="absolute inset-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700">
                                <div className="relative w-20 h-20 mx-auto mb-6">
                                    <div className="absolute inset-0 border-4 border-blue-100 dark:border-blue-900 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                                    <FileText className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">Processing Documents</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">
                                    AI is analyzing your files to generate summaries and quiz content. This may take a few moments.
                                </p>
                                {project.processingCount && project.processingCount > 0 && (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>{project.processingCount} document{project.processingCount > 1 ? 's' : ''} remaining</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold">{project.name}</h1>
                                <p className="text-gray-500">{project.subject}</p>
                            </div>
                            <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab('chat')}
                                    disabled={documents.length === 0}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'chat'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        } ${documents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Chat
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('quiz')}
                                    disabled={documents.length === 0}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'quiz'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        } ${documents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileQuestion className="w-4 h-4" />
                                        Quiz
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('songs')}
                                    disabled={documents.length === 0}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'songs'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        } ${documents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Music className="w-4 h-4" />
                                        Songs
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {activeTab !== 'songs' && (
                        <Card className="flex-1 overflow-hidden flex flex-col p-0">
                            {activeTab === 'overview' ? (
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        {documents.length > 0 && (
                                            <div className="prose dark:prose-invert max-w-none flex justify-between items-start">
                                                <div>
                                                    <h2 className="text-xl font-bold mb-4">Project Overview</h2>
                                                    <p className="text-gray-600 dark:text-gray-400">
                                                        Here are the documents uploaded to this project along with their AI-generated summaries.
                                                        Use this guide to understand the content and decide where to focus your studies.
                                                    </p>
                                                </div>
                                                <div>
                                                    <input
                                                        type="file"
                                                        multiple
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        onChange={handleFileChange}
                                                        accept=".pdf,.txt,.docx,.md"
                                                    />
                                                    <Button onClick={handleAddDocumentClick} disabled={uploading}>
                                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                                        Add Document
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            {documents.map((doc, idx) => (
                                                <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                    <button
                                                        onClick={() => setExpandedDocs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                                        className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                                                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                                                            </div>
                                                            <h3 className="font-bold text-lg">{doc.filename}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => handleDeleteDocument(doc.filename, e)}
                                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                                title="Delete Document"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            <ChevronDown
                                                                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expandedDocs[idx] ? 'transform rotate-180' : ''}`}
                                                            />
                                                        </div>
                                                    </button>

                                                    {expandedDocs[idx] && (
                                                        <div className="px-4 pb-4 pl-14 animate-in slide-in-from-top-2 duration-200">
                                                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
                                                            {doc.summary === "Summary generation failed." ? (
                                                                <div className="mt-2">
                                                                    <p className="text-red-500 text-sm mb-2">Summary generation failed.</p>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRegenerateSummary(doc.filename);
                                                                        }}
                                                                        disabled={doc.isRegenerating}
                                                                    >
                                                                        {doc.isRegenerating ? 'Regenerating...' : 'Regenerate Summary'}
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed prose dark:prose-invert max-w-none"
                                                                    dangerouslySetInnerHTML={{ __html: doc.summary || "Summary not available." }}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {documents.length === 0 && (
                                                <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                                                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                                                        <FileText className="w-10 h-10 text-gray-400" />
                                                    </div>
                                                    <h3 className="text-xl font-bold mb-2">No Documents Uploaded</h3>
                                                    <p className="text-gray-500 max-w-sm mb-6">
                                                        Upload a document to generate summaries, quizzes, and start chatting.
                                                    </p>
                                                    <input
                                                        type="file"
                                                        multiple
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        onChange={handleFileChange}
                                                        accept=".pdf,.txt,.docx,.md"
                                                    />
                                                    <Button onClick={handleAddDocumentClick} disabled={uploading}>
                                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                                        Upload Your First Document
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                        <form
                                            onSubmit={async (e) => {
                                                e.preventDefault();
                                                if (!newMessage.trim()) return;
                                                setActiveTab('chat');
                                                await handleSendMessage(e);
                                            }}
                                            className="flex gap-2"
                                        >
                                            <div className="flex-1">
                                                <Input
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    placeholder="Ask a question..."
                                                    className="flex-1 w-full"
                                                    disabled={sending}
                                                />
                                            </div>
                                            <Button type="submit" disabled={sending || !newMessage.trim()}>
                                                <Send className="w-5 h-5" />
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            ) : activeTab === 'chat' ? (
                                <div className="flex flex-col h-[calc(100vh-14rem)]">
                                    <div className="flex justify-end px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleClearChat}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Clear Chat History"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Trash2 className="w-4 h-4" />
                                                <span className="text-xs">Clear Chat</span>
                                            </div>
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {messages.length === 0 && (
                                            <div className="text-center text-gray-500 mt-10">
                                                Ask a question about your documents to get started!
                                            </div>
                                        )}
                                        {messages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user'
                                                    ? 'bg-blue-600 text-white prose-headings:text-white prose-p:text-white prose-strong:text-white prose-li:text-white'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                                    }`}>
                                                    <div className={`prose dark:prose-invert max-w-none text-sm break-words ${msg.role === 'user' ? 'dark:prose-invert-headings:text-white' : ''
                                                        }`}>
                                                        <ReactMarkdown>
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {sending && (
                                            <div className="flex justify-start">
                                                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                                                    <div className="flex gap-1">
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                        <form onSubmit={handleSendMessage} className="flex gap-2">
                                            <div className="flex-1">
                                                <Input
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    placeholder="Ask a question..."
                                                    className="flex-1"
                                                    disabled={sending}
                                                />
                                            </div>
                                            <Button type="submit" disabled={sending || !newMessage.trim()}>
                                                <Send className="w-5 h-5" />
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            ) : activeTab === 'quiz' ? (
                                <div className="p-6 h-full overflow-y-auto">
                                    {!quizState.quizId ? (
                                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                                            <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                                                <FileQuestion className="w-12 h-12 text-blue-600 dark:text-blue-300" />
                                            </div>
                                            <h2 className="text-xl font-bold">Test Your Knowledge</h2>
                                            <p className="text-gray-500 text-center max-w-md">
                                                Generate a multiple choice quiz based on your project documents to test your understanding.
                                            </p>
                                            <div className="w-full max-w-md space-y-4">
                                                <div className="gap-2 w-full">
                                                    <div className="w-full">
                                                        <Input
                                                            placeholder="Choose a topic..."
                                                            value={quizTopic}
                                                            onChange={(e) => setQuizTopic(e.target.value)}
                                                            disabled={generatingQuiz}
                                                        />
                                                    </div>
                                                    <div className="mt-2">
                                                        <Button
                                                            onClick={() => handleGenerateQuiz(quizTopic)}
                                                            disabled={generatingQuiz || !quizTopic.trim()}
                                                            className="w-full"
                                                        >
                                                            {generatingQuiz && quizTopic ? 'Thinking noises...' : 'Generate Quiz'}
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="relative">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                                                    </div>
                                                    <div className="relative flex justify-center text-xs uppercase">
                                                        <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">Or</span>
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={() => handleGenerateQuiz()}
                                                    disabled={generatingQuiz}
                                                    className="w-full"
                                                    variant="secondary"
                                                >
                                                    {generatingQuiz && !quizTopic ? 'Opening lucky packet...' : 'Surprise Me'}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : !quizState.results ? (
                                        <div className="space-y-8 max-w-3xl mx-auto">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                                <div className="w-full sm:w-auto flex-1 mr-4">
                                                    <h2 className="text-xl font-bold">Question {currentQuestionIndex + 1} of {quizState.questions.length}</h2>
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                                                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${((currentQuestionIndex + 1) / quizState.questions.length) * 100}%` }}></div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => setQuizState({ quizId: null, questions: [], answers: {}, results: null })}
                                                    size="sm"
                                                    className="w-full sm:w-auto"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>

                                            {quizState.questions[currentQuestionIndex] && (
                                                <Card className="space-y-6">
                                                    <h3 className="font-medium text-xl">{quizState.questions[currentQuestionIndex].question}</h3>
                                                    <div className="space-y-3">
                                                        {quizState.questions[currentQuestionIndex].options.map((option: string, optIdx: number) => {
                                                            const isSelected = quizState.answers[currentQuestionIndex] === option;
                                                            const isCorrect = option === quizState.questions[currentQuestionIndex].correctAnswer;

                                                            let borderClass = 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800';
                                                            if (isSelected) borderClass = 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';

                                                            if (showFeedback) {
                                                                if (isCorrect) borderClass = 'border-green-500 bg-green-50 dark:bg-green-900/20';
                                                                else if (isSelected && !isCorrect) borderClass = 'border-red-500 bg-red-50 dark:bg-red-900/20';
                                                                else borderClass = 'border-gray-200 dark:border-gray-700 opacity-50';
                                                            }

                                                            return (
                                                                <label key={optIdx} className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${borderClass}`}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`question-${currentQuestionIndex}`}
                                                                        value={option}
                                                                        checked={isSelected}
                                                                        onChange={() => handleOptionSelect(option)}
                                                                        disabled={showFeedback}
                                                                        className="w-4 h-4 text-blue-600 mr-3"
                                                                    />
                                                                    <span className="flex-1">{option}</span>
                                                                    {showFeedback && isCorrect && <span className="text-green-600 font-bold ml-2">Correct</span>}
                                                                    {showFeedback && isSelected && !isCorrect && <span className="text-red-600 font-bold ml-2">Incorrect</span>}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>

                                                    {showFeedback && (
                                                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="font-semibold">Explanation:</span>
                                                                <Button variant="ghost" size="sm" onClick={() => handleElaborate(quizState.questions[currentQuestionIndex].explanation)} className="-mt-1 -mr-2 text-blue-600 hover:text-blue-700">
                                                                    Elaborate
                                                                </Button>
                                                            </div>
                                                            <p className="text-gray-600 dark:text-gray-300">{quizState.questions[currentQuestionIndex].explanation}</p>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-end pt-4">
                                                        {!showFeedback ? (
                                                            <Button
                                                                onClick={handleCheckAnswer}
                                                                disabled={!quizState.answers[currentQuestionIndex]}
                                                            >
                                                                Submit Answer
                                                            </Button>
                                                        ) : (
                                                            <Button onClick={handleNextQuestion} disabled={submittingQuiz}>
                                                                {currentQuestionIndex < quizState.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Card>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-8 max-w-xl mx-auto text-center pt-10">
                                            <div className="space-y-4">
                                                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
                                                    <FileQuestion className="w-10 h-10 text-blue-600 dark:text-blue-300" />
                                                </div>
                                                <h2 className="text-3xl font-bold">Quiz Complete!</h2>
                                                <div className="py-6">
                                                    <p className="text-gray-500 mb-2">Your Score</p>
                                                    <div className="text-6xl font-bold text-blue-600">
                                                        {score} <span className="text-3xl text-gray-400">/ {quizState.questions.length}</span>
                                                    </div>
                                                </div>
                                                <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                                                    Great job! You've completed the quiz. Review your documents to improve your score or try again.
                                                </p>
                                                <div className="pt-6">
                                                    <Button size="lg" onClick={() => {
                                                        setQuizState({ quizId: null, questions: [], answers: {}, results: null });
                                                        setCurrentQuestionIndex(0);
                                                        setScore(0);
                                                        setShowFeedback(false);
                                                    }}>
                                                        Take Another Quiz
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </Card>
                    )}
                    {activeTab === 'songs' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1">
                                <Card className="p-6 sticky top-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Music className="w-5 h-5 text-blue-600" />
                                        Create New Song
                                    </h2>
                                    <form onSubmit={handleCreateSong} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Title</label>
                                            <Input
                                                value={songForm.title}
                                                onChange={(e) => setSongForm({ ...songForm, title: e.target.value })}
                                                placeholder="My Study Song"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Genre</label>
                                            <select
                                                value={songForm.genre}
                                                onChange={(e) => setSongForm({ ...songForm, genre: e.target.value })}
                                                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 transition-all p-3"
                                            >
                                                <option value="Pop">Pop</option>
                                                <option value="Rock">Rock</option>
                                                <option value="Hip Hop">Hip Hop</option>
                                                <option value="Jazz">Jazz</option>
                                                <option value="Electronic">Electronic</option>
                                                <option value="Country">Country</option>
                                                <option value="Classical">Classical</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Lyrics</label>
                                            <textarea
                                                value={songForm.lyrics}
                                                onChange={(e) => setSongForm({ ...songForm, lyrics: e.target.value })}
                                                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 min-h-[120px] p-3 transition-all font-mono text-sm"
                                                placeholder="Add your song lyrics here..."
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setLyricsPanelOpen(true)}
                                                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                                Help me generate lyrics
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Duration (Seconds)</label>
                                            <select
                                                value={songForm.duration}
                                                onChange={(e) => setSongForm({ ...songForm, duration: Number(e.target.value) })}
                                                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 transition-all p-3"
                                            >
                                                <option value={15}>15 Seconds</option>
                                                <option value={30}>30 Seconds</option>
                                                <option value={45}>45 Seconds</option>
                                                <option value={60}>60 Seconds</option>
                                            </select>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                            disabled={generatingSong}
                                        >
                                            {generatingSong ? 'Creating Magic...' : 'Generate Song'}
                                        </Button>
                                    </form>
                                </Card>
                            </div>

                            <div className="lg:col-span-2 space-y-4">
                                <h2 className="text-xl font-bold mb-4">Your Library</h2>
                                {songs.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <Music className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No songs created yet. Make some music!</p>
                                    </div>
                                ) : (
                                    songs.map((song) => (
                                        <Card key={song._id} className="p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-lg">{song.title}</h3>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                            {song.genre}
                                                        </span>
                                                        {song.status === 'pending' && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 animate-pulse">
                                                                Generating...
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                                        {song.lyrics ? 'Lyrics generated from content' : song.title}
                                                    </p>

                                                    {song.audioUrl ? (
                                                        <audio controls src={song.audioUrl} className="w-full h-8 mt-2" />
                                                    ) : song.status === 'completed' && !song.audioUrl ? (
                                                        <div className="text-sm text-red-500">Audio unavailable</div>
                                                    ) : null}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteSong(song._id)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Delete Song"
                                                    disabled={deletingSongId === song._id}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                                                <button
                                                    onClick={() => setExpandedSongLyrics(prev => ({ ...prev, [song._id]: !prev[song._id] }))}
                                                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                >
                                                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expandedSongLyrics[song._id] ? 'rotate-90' : ''}`} />
                                                    {expandedSongLyrics[song._id] ? 'Hide Lyrics' : 'Show Lyrics'}
                                                </button>

                                                {expandedSongLyrics[song._id] && (
                                                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 animate-in slide-in-from-top-1 fade-in duration-200">
                                                        {song.originalPrompt || "No lyrics available."}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </Layout>




            <Modal
                isOpen={lyricsPanelOpen}
                onClose={() => setLyricsPanelOpen(false)}
                title="Generate Lyrics"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Describe what the lyrics should be about. We'll use the project's documents to make them relevant!
                    </p>
                    <textarea
                        value={lyricsPrompt}
                        onChange={(e) => setLyricsPrompt(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 min-h-[120px] p-3 transition-all"
                        placeholder="E.g., A song about the French Revolution..."
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="secondary"
                            onClick={() => setLyricsPanelOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleGenerateLyrics}
                            disabled={generatingLyrics || !lyricsPrompt.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {generatingLyrics ? 'Writing...' : 'Generate Lyrics'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showClearChatModal}
                onClose={() => setShowClearChatModal(false)}
                title="Clear Chat History"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Are you sure you want to delete all chat history for this project? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setShowClearChatModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={confirmClearChat}
                            disabled={clearingChat}
                        >
                            {clearingChat ? 'Deleting...' : 'Delete'}
                        </Button>
                    </div>
                </div>
            </Modal>


            <Modal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                title="Error"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                        <p>{errorMessage}</p>
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={() => setShowErrorModal(false)}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

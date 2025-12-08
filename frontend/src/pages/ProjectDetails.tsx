import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout';
import { apiRequest } from '../lib/api';
import { useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Send, MessageSquare, FileQuestion, BookOpen } from 'lucide-react';

interface Project {
    _id: string;
    name: string;
    subject: string;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface Document {
    filename: string;
    summary: string;
    uploadedAt: string;
    isRegenerating?: boolean;
}

export const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'quiz'>('overview');
    const [loading, setLoading] = useState(true);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Quiz State
    const [quizState, setQuizState] = useState<{
        quizId: string | null;
        questions: any[];
        answers: Record<number, string>;
        results: any | null;
    }>({ quizId: null, questions: [], answers: {}, results: null });
    const [generatingQuiz, setGeneratingQuiz] = useState(false);
    const [submittingQuiz, setSubmittingQuiz] = useState(false);

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
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeTab]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !id) return;

        const userMsg: ChatMessage = { role: 'user', content: newMessage, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setNewMessage('');
        setSending(true);

        try {
            const response = await apiRequest('/chat', 'POST', { projectId: id, message: userMsg.content });
            const assistantMsg: ChatMessage = { role: 'assistant', content: response.answer, timestamp: new Date().toISOString() };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSending(false);
        }
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

    const handleGenerateQuiz = async () => {
        if (!id) return;
        setGeneratingQuiz(true);
        try {
            const response = await apiRequest('/quiz/generate', 'POST', { projectId: id });
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
        <Layout>
            <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="mb-6 flex justify-between items-center">
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
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'chat'
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Chat
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('quiz')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'quiz'
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <FileQuestion className="w-4 h-4" />
                                Quiz
                            </div>
                        </button>
                    </div>
                </div>

                <Card className="flex-1 overflow-hidden flex flex-col p-0">
                    {activeTab === 'overview' ? (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="prose dark:prose-invert max-w-none">
                                    <h2 className="text-xl font-bold mb-4">Project Overview</h2>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Here are the documents uploaded to this project along with their AI-generated summaries.
                                        Use this guide to understand the content and decide where to focus your studies.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {documents.map((doc, idx) => (
                                        <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                                                </div>
                                                <h3 className="font-bold text-lg">{doc.filename}</h3>
                                            </div>
                                            <div className="pl-11">
                                                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Summary</h4>
                                                {doc.summary === "Summary generation failed." ? (
                                                    <div className="mt-2">
                                                        <p className="text-red-500 text-sm mb-2">Summary generation failed.</p>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => handleRegenerateSummary(doc.filename)}
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
                                        </div>
                                    ))}
                                    {documents.length === 0 && (
                                        <div className="text-center py-10 text-gray-500">
                                            No documents found. Upload a document to generate a summary.
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
                                    <Input
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Ask a question about your documents..."
                                        className="flex-1 w-full"
                                        disabled={sending}
                                    />
                                    <Button type="submit" disabled={sending || !newMessage.trim()}>
                                        <Send className="w-5 h-5" />
                                    </Button>
                                </form>
                            </div>
                        </div>
                    ) : activeTab === 'chat' ? (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.length === 0 && (
                                    <div className="text-center text-gray-500 mt-10">
                                        Ask a question about your documents to get started!
                                    </div>
                                )}
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                            }`}>
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
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
                                    <Input
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Ask a question..."
                                        className="flex-1"
                                        disabled={sending}
                                    />
                                    <Button type="submit" disabled={sending || !newMessage.trim()}>
                                        <Send className="w-5 h-5" />
                                    </Button>
                                </form>
                            </div>
                        </div>
                    ) : (
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
                                    <Button onClick={handleGenerateQuiz} disabled={generatingQuiz}>
                                        {generatingQuiz ? 'Generating...' : 'Generate Quiz'}
                                    </Button>
                                </div>
                            ) : !quizState.results ? (
                                <div className="space-y-8 max-w-3xl mx-auto">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-bold">Quiz</h2>
                                        <Button variant="secondary" onClick={() => setQuizState({ quizId: null, questions: [], answers: {}, results: null })} size="sm">
                                            Cancel
                                        </Button>
                                    </div>

                                    {quizState.questions.map((q, idx) => (
                                        <Card key={idx} className="space-y-4">
                                            <h3 className="font-medium text-lg">{idx + 1}. {q.question}</h3>
                                            <div className="space-y-2">
                                                {q.options.map((option: string, optIdx: number) => (
                                                    <label key={optIdx} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${quizState.answers[idx] === option
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                        }`}>
                                                        <input
                                                            type="radio"
                                                            name={`question-${idx}`}
                                                            value={option}
                                                            checked={quizState.answers[idx] === option}
                                                            onChange={() => setQuizState(prev => ({
                                                                ...prev,
                                                                answers: { ...prev.answers, [idx]: option }
                                                            }))}
                                                            className="w-4 h-4 text-blue-600 mr-3"
                                                        />
                                                        <span>{option}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}

                                    <div className="flex justify-end pt-4">
                                        <Button
                                            onClick={handleSubmitQuiz}
                                            disabled={submittingQuiz || Object.keys(quizState.answers).length < quizState.questions.length}
                                        >
                                            {submittingQuiz ? 'Submitting...' : 'Submit Answers'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 max-w-3xl mx-auto">
                                    <div className="text-center space-y-2">
                                        <h2 className="text-2xl font-bold">Quiz Results</h2>
                                        <div className="text-4xl font-bold text-blue-600">
                                            {quizState.results.score} / {quizState.results.total}
                                        </div>
                                        <Button onClick={() => setQuizState({ quizId: null, questions: [], answers: {}, results: null })}>
                                            Take Another Quiz
                                        </Button>
                                    </div>

                                    <div className="space-y-6">
                                        {quizState.results.results.map((r: any, idx: number) => (
                                            <Card key={idx} className={`border-l-4 ${r.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <h3 className="font-medium text-lg">{idx + 1}. {r.question}</h3>
                                                        {r.isCorrect ? (
                                                            <span className="text-green-600 font-bold">Correct</span>
                                                        ) : (
                                                            <span className="text-red-600 font-bold">Incorrect</span>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
                                                        <div className={`p-2 rounded ${r.isCorrect ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                                            <span className="font-semibold">Your Answer:</span> {r.userAnswer}
                                                        </div>
                                                        {!r.isCorrect && (
                                                            <div className="p-2 rounded bg-green-100 dark:bg-green-900/30">
                                                                <span className="font-semibold">Correct Answer:</span> {r.correctAnswer}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-2 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                                                        <span className="font-semibold">Explanation:</span> {r.explanation}
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </Layout>
    );
};

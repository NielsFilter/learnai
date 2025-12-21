import { auth } from './firebase';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.VITE_AZURE_FUNCTIONS_URL
        ? `${import.meta.env.VITE_AZURE_FUNCTIONS_URL}/api`
        : (import.meta.env.DEV ? 'http://localhost:7071/api' : '/api'));

export const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const token = await user.getIdToken();

    const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
};

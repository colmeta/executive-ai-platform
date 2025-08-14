// src/app/page.tsx
    'use client';

    import { useState, useEffect } from 'react';

    // This component now handles the auth status display
    function AuthStatus() {
      const [isConnected, setIsConnected] = useState(false);

      useEffect(() => {
        // This runs once when the page loads
        const params = new URLSearchParams(window.location.search);
        if (params.get('auth') === 'success') {
          setIsConnected(true);
        }
      }, []); // The empty array means it only runs on the first render

      if (isConnected) {
        return (
          <div className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md">
            ✓ Calendar Connected
          </div>
        );
      }

      return (
        <a href="/api/auth/google/signin" 
           className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700">
          Connect Google Calendar
        </a>
      );
    }

    // The main page component
    export default function HomePage() {
      const [prompt, setPrompt] = useState('');
      const [response, setResponse] = useState('');
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState('');

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setResponse('');

        try {
          const res = await fetch('/api/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.details || 'An error occurred.');
          setResponse(data.response);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };

      return (
        <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
          <div className="w-full max-w-2xl flex justify-end mb-4">
            <AuthStatus />
          </div>

          <h1 className="text-4xl font-bold mb-8">AI Executive Assistant</h1>
          
          <form onSubmit={handleSubmit} className="w-full max-w-2xl">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your command... (e.g., 'Schedule a meeting with Jane for 3pm tomorrow')"
              className="w-full p-4 rounded-md bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 p-4 rounded-md bg-blue-600 hover:bg-blue-700 font-bold disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Execute Task'}
            </button>
          </form>

          {response && (
            <div className="mt-8 p-6 w-full max-w-2xl bg-gray-800 rounded-md border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Response:</h2>
              <p className="whitespace-pre-wrap">{response}</p>
            </div>
          )}
          {error && (
            <div className="mt-8 p-6 w-full max-w-2xl bg-red-900 bg-opacity-50 rounded-md border border-red-700">
              <h2 className="text-xl font-bold mb-4">Error:</h2>
              <p className="text-red-300">{error}</p>
            </div>
          )}
        </main>
      );
    }
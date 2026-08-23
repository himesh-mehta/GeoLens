"use client";

import React, { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Viewer Page Crash:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong!</h2>
      <p className="text-gray-700 mb-6 font-mono text-sm bg-gray-100 p-4 rounded max-w-2xl overflow-auto">
        {error.message || String(error)}
        {error.stack && (
          <div className="mt-4 pt-4 border-t border-gray-300 text-xs text-gray-500 whitespace-pre-wrap">
            {error.stack}
          </div>
        )}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}

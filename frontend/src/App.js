import React from 'react';
import MediaFetcher from './components/MediaFetcher';
import ImageUpscaler from './components/ImageUpscaler';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-800">TikSharp</h1>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4">
        <div className="space-y-8">
          <MediaFetcher />
          <ImageUpscaler />
        </div>
      </main>

      <footer className="bg-white shadow-sm mt-8">
        <div className="max-w-7xl mx-auto px-4 py-3 text-center text-gray-600">
          <p>TikSharp - Media Downloader & Image Upscaler</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

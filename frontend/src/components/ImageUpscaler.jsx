import React, { useState } from 'react';
import axios from 'axios';

const ImageUpscaler = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [upscaledImage, setUpscaledImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setUpscaledImage(null);
      setError(null);
    }
  };

  const handleUpscale = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      console.log('Sending request to upscale image...');
      const response = await axios.post('http://localhost:3001/api/upscale', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      console.log('Response received:', response);

      if (response.data.upscaledImageUrl) {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const imageUrl = `${response.data.upscaledImageUrl}?t=${timestamp}`;
        console.log('Setting upscaled image URL:', imageUrl);
        setUpscaledImage(imageUrl);
      } else {
        throw new Error('No upscaled image URL in response');
      }
    } catch (err) {
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        headers: err.response?.headers
      });
      setError(err.response?.data?.error || 'Failed to upscale image');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!upscaledImage) return;

    try {
      setDownloading(true);
      // Fetch the image with the full URL
      const response = await fetch(`http://localhost:3001${upscaledImage}`);
      if (!response.ok) throw new Error('Failed to download image');
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      
      // Set the download filename with .jpg extension
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `upscaled-image-${timestamp}.jpg`;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Image Upscaler</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Image
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      {preview && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Original Image</h3>
          <img
            src={preview}
            alt="Preview"
            className="max-w-full h-auto rounded-lg shadow-md"
          />
        </div>
      )}

      {upscaledImage && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Upscaled Image</h3>
          <img
            src={upscaledImage}
            alt="Upscaled"
            className="max-w-full h-auto rounded-lg shadow-md"
          />
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 ${
              downloading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {downloading ? 'Downloading...' : 'Download Upscaled Image'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">Upscaling in progress... {progress}%</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={handleUpscale}
          disabled={!selectedFile || loading}
          className={`px-4 py-2 rounded-lg font-medium ${
            !selectedFile || loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Upscaling...' : 'Upscale Image'}
        </button>
      </div>
    </div>
  );
};

export default ImageUpscaler; 
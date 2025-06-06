import React, { useState } from 'react';
import axios from 'axios';
import './MediaFetcher.css';

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001',
  timeout: 120000
});

const MediaFetcher = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [images, setImages] = useState([]);
  const [success, setSuccess] = useState('');
  const [storyMedia, setStoryMedia] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [upscaling, setUpscaling] = useState(false);
  const [upscaledImage, setUpscaledImage] = useState(null);

  const handleTabChange = (newValue) => {
    setTabValue(newValue);
    setUrl('');
    setError('');
    setImages([]);
    setSuccess('');
    setStoryMedia(null);
    setUpscaledImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setImages([]);
    setSuccess('');
    setStoryMedia(null);

    if (!url.includes('instagram.com')) {
      setError('Please provide a valid Instagram URL');
      setLoading(false);
      return;
    }

    try {
      let endpoint;
      let downloadFilename = 'download';
      
      switch (tabValue) {
        case 0: // Reels
          endpoint = '/api/fetch-reel';
          downloadFilename = 'reel';
          break;
        case 1: // Posts
          endpoint = '/api/fetch-post';
          break;
        case 2: // Stories
          endpoint = '/api/fetch-story';
          break;
        default:
          endpoint = '/api/fetch-reel';
      }

      console.log(`Fetching ${getTabName()} from:`, url);
      const response = await api.post(endpoint, { url }, {
        responseType: tabValue === 0 ? 'blob' : 'json'
      });

      if (tabValue === 2) {
        // Stories
        if (response.data && response.data.mediaUrl) {
          setStoryMedia({
            url: `${api.defaults.baseURL}${response.data.mediaUrl}`,
            type: response.data.type,
            filename: response.data.filename
          });
          setSuccess('Story media fetched successfully!');
        } else {
          setError('No story media found');
        }
      } else if (tabValue === 1) {
        // Posts
        if (response.data && response.data.images && response.data.images.length > 0) {
          const absoluteImages = response.data.images.map(img => ({
            ...img,
            url: img.url.startsWith('/uploads/') 
              ? `${api.defaults.baseURL}${img.url}` 
              : img.url
          }));
          setImages(absoluteImages);
          setSuccess(`Post with ${absoluteImages.length} media items fetched successfully!`);
        } else {
          setError('No media found in the post');
        }
      } else {
        // Reels
        await handleBlobDownload(response, downloadFilename, 'Reel');
      }
      
    } catch (error) {
      console.error('Error:', error);
      await handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlobDownload = async (response, downloadFilename, mediaType) => {
    try {
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      
      if (blob.size < 1000) {
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          setError(errorData.error || errorData.details || `Failed to fetch ${mediaType.toLowerCase()}`);
          return;
        } catch (e) {}
      }
      
      let filename = downloadFilename;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      if (!filename.includes('.')) {
        const extension = contentType.includes('video') ? '.mp4' : '.jpg';
        filename += extension;
      }
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      setSuccess(`${mediaType} downloaded successfully as ${filename}!`);
    } catch (error) {
      console.error('Download error:', error);
      setError(`Failed to download ${mediaType.toLowerCase()}: ${error.message}`);
    }
  };

  const handleError = async (error) => {
    if (error.response) {
      let errorMessage = '';
      
      if (error.response.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.details || errorData.error || 'Failed to fetch media';
        } catch (e) {
          errorMessage = text || 'Failed to fetch media';
        }
      } else if (typeof error.response.data === 'object') {
        errorMessage = error.response.data.details || error.response.data.error || 'Failed to fetch media';
      } else {
        errorMessage = error.response.data || 'Failed to fetch media';
      }
      
      if (error.response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment before trying again.';
      } else if (error.response.status === 403) {
        errorMessage = 'Access denied. The content may be private or temporarily unavailable.';
      } else if (error.response.status === 408) {
        errorMessage = 'Request timeout. Please try again later.';
      }
      
      setError(errorMessage);
    } else if (error.request) {
      setError('Network error: Please check your connection and try again.');
    } else {
      setError(`Error: ${error.message}`);
    }
  };

  const handleDownload = async (imageUrl, filename) => {
    try {
      console.log('Downloading:', imageUrl);
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download error:', error);
      setError(`Failed to download ${filename}: ${error.message}`);
    }
  };

  const handleDownloadAll = () => {
    if (images.length === 0) return;
    
    images.forEach((image, index) => {
      setTimeout(() => {
        handleDownload(image.url, image.filename);
      }, index * 1000);
    });
    
    setSuccess(`Started downloading ${images.length} media items...`);
  };

  const handleStoryDownload = () => {
    if (!storyMedia) return;
    
    handleDownload(storyMedia.url, storyMedia.filename);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        setUploadFile(file);
        setError('');
      } else {
        setError('Please select a JPEG or PNG image file');
        setUploadFile(null);
      }
    }
  };

  const handleUpscale = async () => {
    if (!uploadFile) {
      setError('Please select an image file first');
      return;
    }

    setUpscaling(true);
    setError('');
    setUpscaledImage(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadFile);

      const response = await api.post('/api/upscale', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 180000
      });

      if (response.data && response.data.upscaledImageUrl) {
        const absoluteUrl = response.data.upscaledImageUrl.startsWith('/uploads/') 
          ? `${api.defaults.baseURL}${response.data.upscaledImageUrl}` 
          : response.data.upscaledImageUrl;
        
        setUpscaledImage(absoluteUrl);
        setSuccess('Image upscaled successfully!');
      } else {
        setError('Unexpected response from upscale service');
      }
    } catch (error) {
      console.error('Upscale error:', error);
      await handleError(error);
    } finally {
      setUpscaling(false);
    }
  };

  const getExampleUrl = () => {
    switch (tabValue) {
      case 0: return 'https://www.instagram.com/reel/C3YwJq4NQzX/';
      case 1: return 'https://www.instagram.com/p/C3YwJq4NQzX/';
      case 2: return 'https://www.instagram.com/stories/username/storyId/';
      case 3: return 'Upload an image to upscale';
      default: return '';
    }
  };
  
  const getTabName = () => {
    switch (tabValue) {
      case 0: return 'Reels';
      case 1: return 'Posts';
      case 2: return 'Stories';
      case 3: return 'Upscale';
      default: return 'Media';
    }
  };

  const isValidInstagramUrl = (url) => {
    return url.includes('instagram.com') && (
      url.includes('/p/') || 
      url.includes('/reel/') || 
      url.includes('/tv/') || 
      url.includes('/stories/')
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Instagram Media Downloader</h1>
        <p className="text-gray-600">Download Instagram reels, posts, stories, and upscale images</p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tabValue === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
          }`}
          onClick={() => handleTabChange(0)}
        >
          📹 Reels
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tabValue === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
          }`}
          onClick={() => handleTabChange(1)}
        >
          📷 Posts
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tabValue === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
          }`}
          onClick={() => handleTabChange(2)}
        >
          📱 Stories
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            tabValue === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
          }`}
          onClick={() => handleTabChange(3)}
        >
          🔍 Upscale
        </button>
      </div>

      {tabValue === 3 ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Image Upscaler</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Image (JPEG or PNG)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileUpload}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            
            {uploadFile && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Selected: {uploadFile.name}</p>
                <button
                  onClick={handleUpscale}
                  disabled={upscaling}
                  className={`px-6 py-2 rounded-lg font-medium ${
                    upscaling
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {upscaling ? 'Upscaling...' : 'Upscale Image'}
                </button>
              </div>
            )}
            
            {upscaledImage && (
              <div className="mt-6">
                <h4 className="font-medium mb-2">Upscaled Image:</h4>
                <img 
                  src={upscaledImage} 
                  alt="Upscaled" 
                  className="max-w-full h-auto rounded-lg border"
                />
                <button
                  onClick={() => handleDownload(upscaledImage, `upscaled_${Date.now()}.jpg`)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Download Upscaled Image
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Instagram URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={getExampleUrl()}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {url && !isValidInstagramUrl(url) && (
                <p className="text-red-500 text-sm mt-1">
                  Please enter a valid Instagram URL
                </p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading || !url || !isValidInstagramUrl(url)}
              className={`px-6 py-3 rounded-lg font-medium w-full transition-colors ${
                loading || !url || !isValidInstagramUrl(url)
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading {getTabName()}...
                </span>
              ) : (
                `Download ${getTabName()}`
              )}
            </button>
          </form>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <div className="flex">
            <span className="text-red-500 mr-2">⚠️</span>
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          <div className="flex">
            <span className="text-green-500 mr-2">✅</span>
            <div>
              <strong>Success:</strong> {success}
            </div>
          </div>
        </div>
      )}

      {storyMedia && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Story Media</h3>
            <button 
              onClick={handleStoryDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Download Story
            </button>
          </div>
          
          {storyMedia.type === 'video' ? (
            <video 
              src={storyMedia.url} 
              controls 
              className="w-full max-w-md mx-auto rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <img 
              src={storyMedia.url} 
              alt="Story" 
              className="w-full max-w-md mx-auto rounded-lg"
              onError={(e) => {
                console.error('Image load error:', e);
                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="16" fill="%236b7280">Failed to load image</text></svg>';
              }}
            />
          )}
        </div>
      )}

      {tabValue === 1 && images.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Post Media ({images.length})</h3>
            <button 
              onClick={handleDownloadAll}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              📥 Download All ({images.length})
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((image, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                {image.type === 'video' ? (
                  <video 
                    src={image.url} 
                    controls 
                    className="w-full h-48 object-cover rounded mb-2"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img 
                    src={image.url} 
                    alt={`Post ${index + 1}`}
                    className="w-full h-48 object-cover rounded mb-2"
                    onError={(e) => {
                      console.error('Image load error for index', index, ':', e);
                      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="14" fill="%236b7280">Image Error</text></svg>';
                    }}
                  />
                )}
                <button 
                  onClick={() => handleDownload(image.url, image.filename)}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  📥 Download {image.type === 'video' ? 'Video' : 'Image'} {index + 1}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">How to use:</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p><strong>📹 Reels:</strong> Paste Instagram reel URL and click download</p>
          <p><strong>📷 Posts:</strong> Download single images/videos or multiple carousel posts</p>
          <p><strong>📱 Stories:</strong> Download Instagram story media (requires story URL)</p>
          <p><strong>🔍 Upscale:</strong> Upload and enhance image quality</p>
        </div>
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          <strong>Note:</strong> This tool respects Instagram's terms of service. Only download content you have permission to use.
        </div>
      </div>
    </div>
  );
};

export default MediaFetcher;
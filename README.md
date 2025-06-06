# TikSharp

A web application for downloading media from Instagram/TikTok and upscaling images using AI.

## Features

- Download media from Instagram and TikTok posts
- Upscale images using Real-ESRGAN AI model
- Simple and intuitive user interface
- Support for both images and videos

## Prerequisites

- Node.js (v14 or higher)
- Python 3.8 or higher
- CUDA-capable GPU (recommended for image upscaling)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tiksharp.git
cd tiksharp
```

2. Install backend dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Install frontend dependencies:
```bash
cd frontend
npm install
```

## Running the Application

1. Start the backend server:
```bash
npm start
```

2. In a new terminal, start the frontend development server:
```bash
cd frontend
npm start
```

The application will be available at http://localhost:3000

## Usage

### Media Downloader
1. Paste a public Instagram or TikTok URL
2. Click "Fetch Media"
3. Preview and download the media

### Image Upscaler
1. Upload a JPEG or PNG image
2. Click "Upscale Image"
3. Preview and download the upscaled result

## License

MIT License 
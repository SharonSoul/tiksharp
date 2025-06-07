const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PythonShell } = require('python-shell');
const YTDlpWrap = require('yt-dlp-wrap').default; 

const app = express();
const port = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  }
});

// Function to find Python executable
function findPythonPath() {
  const possiblePaths = [
    'python',
    'python3',
    'C:\\Python39\\python.exe',
    'C:\\Python310\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\Python\\Python39\\python.exe',
    'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',
    'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
  ];

  for (const pythonPath of possiblePaths) {
    try {
      const { execSync } = require('child_process');
      execSync(`${pythonPath} --version`);
      return pythonPath;
    } catch (error) {
      continue;
    }
  }
  throw new Error('Python not found. Please install Python and add it to your PATH.');
}

const ytDlp = new YTDlpWrap();

// Helper function to determine media type
function getMediaType(url) {
  if (url.includes('/reel/')) return 'reel';
  if (url.includes('/p/')) return 'post';
  if (url.includes('/stories/')) return 'story';
  return 'unknown';
}

// Helper function to download media
async function downloadMedia(url, outputPath, type) {
  const baseArgs = [
    url,
    '-o', outputPath,
    '--no-check-certificates',
    '--no-warnings',
    '--prefer-free-formats',
    '--add-header', 'Referer: https://www.instagram.com/',
    '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    '--verbose'
  ];

  let args;
  switch (type) {
    case 'reel':
      args = [...baseArgs, '--format', 'best'];
      break;
    case 'post':
      args = [
        ...baseArgs,
        '--format', 'best[ext=jpg]/best[ext=jpeg]/best[ext=png]/best',
        '--no-playlist'
      ];
      break;
    case 'story':
      args = [...baseArgs, '--format', 'best'];
      break;
    default:
      args = baseArgs;
  }

  console.log(`Executing yt-dlp for ${type} with args:`, args);
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const process = ytDlp.exec(args, {
      onStdout: (data) => {
        stdout += data;
        console.log('yt-dlp output:', data);
      },
      onStderr: (data) => {
        stderr += data;
        console.error('yt-dlp error:', data);
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
      }
    });
  });
}

// Routes for different media types
app.post('/api/fetch-reel', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const type = getMediaType(url);
    console.log(`Fetching ${type} from URL:`, url);
    const timestamp = Date.now();
    const outputPath = path.join(uploadsDir, `${type}_${timestamp}.mp4`);

    try {
      await downloadMedia(url, outputPath, type);
      
      if (!fs.existsSync(outputPath)) {
        throw new Error('Downloaded file not found');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      // Send the file directly
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_${timestamp}.mp4"`);
      res.setHeader('Content-Length', stats.size);
      
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);

      // Clean up the file after sending
      fileStream.on('end', () => {
        fs.unlink(outputPath, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });

    } catch (error) {
      console.error(`Error downloading ${type}:`, error);
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      res.status(500).json({ 
        error: `Failed to download ${type}`,
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Error in fetch-reel endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

app.post('/api/fetch-post', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Fetching post from URL:', url);
    const timestamp = Date.now();
    const outputDir = path.join(uploadsDir, `post_${timestamp}`);
    
    // Create a temporary directory for this post's images
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      // First try to get info about the post with additional options
      const info = await ytDlp.getVideoInfo(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
          'Referer: https://www.instagram.com/',
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
      });
      console.log('Post info:', info);

      // Get all available formats
      const formats = info.formats || [];
      console.log('Available formats:', formats);

      // Try to find image formats
      const imageFormats = formats.filter(format => 
        format.ext === 'jpg' || format.ext === 'jpeg' || format.ext === 'png' ||
        format.format_note?.includes('image') || format.format_id?.includes('image')
      );

      if (imageFormats.length === 0) {
        // If no image formats found, try downloading with a more general format
        const outputPath = path.join(outputDir, 'image.jpg');
        const args = [
          url,
          '-o', outputPath,
          '--format', 'best[ext=jpg]/best[ext=jpeg]/best[ext=png]/best',
          '--no-check-certificates',
          '--no-warnings',
          '--prefer-free-formats',
          '--add-header', 'Referer: https://www.instagram.com/',
          '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          '--no-playlist'
        ];

        await new Promise((resolve, reject) => {
          const process = ytDlp.exec(args, {
            onStdout: (data) => console.log('yt-dlp output:', data),
            onStderr: (data) => console.error('yt-dlp error:', data)
          });

          process.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`yt-dlp failed with code ${code}`));
          });
        });

        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            return res.json({
              images: [{
                url: `/uploads/post_${timestamp}/image.jpg`,
                filename: 'image.jpg'
              }]
            });
          }
        }
        throw new Error('No images found in the post');
      }

      // Download each image
      const imageUrls = [];
      for (let i = 0; i < imageFormats.length; i++) {
        const format = imageFormats[i];
        const outputPath = path.join(outputDir, `image_${i + 1}.${format.ext}`);
        
        const args = [
          url,
          '-o', outputPath,
          '--format', format.format_id,
          '--no-check-certificates',
          '--no-warnings',
          '--prefer-free-formats',
          '--add-header', 'Referer: https://www.instagram.com/',
          '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];

        await new Promise((resolve, reject) => {
          const process = ytDlp.exec(args, {
            onStdout: (data) => console.log('yt-dlp output:', data),
            onStderr: (data) => console.error('yt-dlp error:', data)
          });

          process.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`yt-dlp failed with code ${code}`));
          });
        });

        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            imageUrls.push({
              url: `/uploads/post_${timestamp}/image_${i + 1}.${format.ext}`,
              filename: `image_${i + 1}.${format.ext}`
            });
          }
        }
      }

      if (imageUrls.length === 0) {
        throw new Error('Failed to download any images from the post');
      }

      res.json({ images: imageUrls });

    } catch (error) {
      console.error('Error downloading post:', error);
      // Clean up the temporary directory
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
      res.status(500).json({ 
        error: 'Failed to download post',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Error in fetch-post endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

app.post('/api/fetch-story', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Fetching story from URL:', url);
    const timestamp = Date.now();
    const outputPath = path.join(uploadsDir, `story_${timestamp}.mp4`);

    try {
      await downloadMedia(url, outputPath, 'story');
      
      if (!fs.existsSync(outputPath)) {
        throw new Error('Downloaded file not found');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      const mediaUrl = `/uploads/${path.basename(outputPath)}`;
      res.json({ mediaUrl });
    } catch (error) {
      console.error('Error downloading story:', error);
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      res.status(500).json({ 
        error: 'Failed to download story',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Error in fetch-story endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

app.post('/api/upscale', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(uploadsDir, `upscaled_${Date.now()}.jpg`);

  try {
    console.log('Starting upscaling process...');
    console.log('Input path:', inputPath);
    console.log('Output path:', outputPath);

    const result = await upscaleImage(inputPath, outputPath);
    console.log('Upscaling completed:', result);

    // Return the URL to the upscaled image
    const imageUrl = `/uploads/${path.basename(outputPath)}`;
    res.json({ upscaledImageUrl: imageUrl });

    // Clean up the input file after sending response
    fs.unlink(inputPath, () => {});
  } catch (error) {
    console.error('Error in upscale endpoint:', error);
    res.status(500).json({ error: 'Error processing image' });
    // Clean up the temporary files
    fs.unlink(inputPath, () => {});
    if (fs.existsSync(outputPath)) {
      fs.unlink(outputPath, () => {});
    }
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Uploads directory:', uploadsDir);
}); 
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

// Helper function to download media (for reels only)
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
    
    const options = {
      mode: 'text',
      pythonPath: findPythonPath(),
      scriptPath: __dirname,
      args: [url]
    };

    PythonShell.run('instagram_graphql_scraper.py', options).then(results => {
      if (results && results.length > 0) {
        try {
          const response = JSON.parse(results[0]);
          
          if (response.error) {
            console.error('Error from Python scraper:', response.error);
            return res.status(500).json({ error: response.error });
          }

          // Extract media URLs from the post data
          const mediaFiles = [];
          
          // Handle carousel posts
          if (response.edge_sidecar_to_children) {
            response.edge_sidecar_to_children.edges.forEach(edge => {
              const node = edge.node;
              if (node.is_video) {
                mediaFiles.push({
                  url: node.video_url,
                  filename: `video_${Date.now()}.mp4`,
                  type: 'video'
                });
              } else {
                mediaFiles.push({
                  url: node.display_url,
                  filename: `image_${Date.now()}.jpg`,
                  type: 'image'
                });
              }
            });
          } else {
            // Handle single media posts
            if (response.is_video) {
              mediaFiles.push({
                url: response.video_url,
                filename: `video_${Date.now()}.mp4`,
                type: 'video'
              });
            } else {
              mediaFiles.push({
                url: response.display_url,
                filename: `image_${Date.now()}.jpg`,
                type: 'image'
              });
            }
          }
          
          if (mediaFiles.length === 0) {
            return res.status(404).json({ error: 'No media found in post' });
          }
          
          res.json({ images: mediaFiles });
    } catch (error) {
          console.error('Error parsing Python results:', error);
          res.status(500).json({ error: 'Failed to parse media results' });
        }
      } else {
        res.status(500).json({ error: 'No results from Python scraper' });
      }
    }).catch(error => {
      console.error('Error running Python scraper:', error);
      res.status(500).json({ error: 'Failed to fetch post', details: error.message });
    });

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
    
    const options = {
      mode: 'text',
      pythonPath: findPythonPath(),
      scriptPath: __dirname,
      args: [url, 'story']
    };

    PythonShell.run('instagram_scraper.py', options).then(results => {
      if (results && results.length > 0) {
        try {
          const mediaFiles = JSON.parse(results[0]);
          if (mediaFiles && mediaFiles.length > 0) {
            res.json({
              mediaUrl: mediaFiles[0].url,
              filename: mediaFiles[0].filename,
              type: mediaFiles[0].type
            });
          } else {
            res.status(500).json({ error: 'No story media found' });
          }
        } catch (error) {
          console.error('Error parsing Python results:', error);
          res.status(500).json({ error: 'Failed to parse media results' });
        }
      } else {
        res.status(500).json({ error: 'No results from Python scraper' });
      }
    }).catch(error => {
      console.error('Error running Python scraper:', error);
      res.status(500).json({ error: 'Failed to fetch story', details: error.message });
    });

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
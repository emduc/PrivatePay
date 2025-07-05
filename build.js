const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const copyFile = (src, dest) => {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
};

const build = async () => {
  try {
    // Clean dist directory
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true });
    }
    
    fs.mkdirSync('dist', { recursive: true });

    // Build TypeScript files
    await esbuild.build({
      entryPoints: {
        'popup': 'src/popup/index.tsx',
        'background': 'src/background.ts',
        'content': 'src/content.ts'
      },
      bundle: true,
      outdir: 'dist',
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      minify: false,
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      external: ['chrome']
    });

    // Copy manifest.json and inject.js
    copyFile('public/manifest.json', 'dist/manifest.json');
    copyFile('src/inject.js', 'dist/inject.js');

    // Create popup.html
    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mini ETH Wallet</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="popup.js"></script>
</body>
</html>`;

    fs.writeFileSync('dist/popup.html', popupHtml);

    // Create a simple icon if it doesn't exist
    if (!fs.existsSync('public/icon.png')) {
      const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <rect width="16" height="16" fill="#007bff"/>
        <text x="8" y="12" text-anchor="middle" fill="white" font-family="Arial" font-size="10">W</text>
      </svg>`;
      
      fs.writeFileSync('public/icon.svg', iconSvg);
      console.log('Created icon.svg (you may want to create a proper icon.png)');
    }

    // Copy icon if it exists
    if (fs.existsSync('public/icon.png')) {
      copyFile('public/icon.png', 'dist/icon.png');
    }

    console.log('✅ Build completed successfully!');
    console.log('📁 Extension files are in the dist/ directory');
    console.log('🔧 Load the extension in Chrome by going to chrome://extensions and selecting the dist/ folder');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
};

build();
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const pdfPath = 'C:\\Users\\Rajdip Parmar\\.gemini\\antigravity\\brain\\79e41acf-b52b-4cfb-98b2-62344f995035\\.user_uploaded\\media_1791032764813.pdf';

if (!fs.existsSync(pdfPath)) {
  console.error('File not found:', pdfPath);
  process.exit(1);
}

console.log('File exists, size:', fs.statSync(pdfPath).size);

async function run() {
  try {
    // Upload as raw so it can be directly downloaded/viewed as a PDF document
    const rawResult = await cloudinary.uploader.upload(pdfPath, {
      folder: 'portfolio',
      public_id: 'Rajdip-parmar-cv',
      resource_type: 'raw',
      overwrite: true,
      invalidate: true,
    });
    console.log('Raw upload result secure_url:', rawResult.secure_url);
    console.log('Raw public_id:', rawResult.public_id);

    // Also upload as image / document so it has an image representation if needed
    const imageResult = await cloudinary.uploader.upload(pdfPath, {
      folder: 'portfolio',
      public_id: 'Rajdip-parmar-cv',
      resource_type: 'image',
      overwrite: true,
      invalidate: true,
    });
    console.log('Image upload result secure_url:', imageResult.secure_url);
    console.log('Image public_id:', imageResult.public_id);
  } catch (err) {
    console.error('Upload error:', err);
  }
}

run();

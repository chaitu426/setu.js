<!-- # Setu HTTP Client ⚡

> A fast, minimal, and modern HTTP client for **Node.js** and **browsers**, with built-in support for timeouts, retries, progress tracking, and streaming.

---

[![npm version](https://img.shields.io/npm/v/setu?color=%2300b894&label=Install%20via%20npm&style=flat-square)](https://www.npmjs.com/package/setu)
[![Docs](https://img.shields.io/badge/📘%20View%20Docs-blue?style=flat-square)](https://yourdomain.com/docs)
[![License](https://img.shields.io/npm/l/setu?style=flat-square)](https://github.com/yourusername/setu/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/setu?style=flat-square)](https://bundlephobia.com/package/setu)

---

## 📦 Installation

```bash
# Using npm
npm install setu

# Using yarn
yarn add setu

# Using pnpm
pnpm add setu
```

## 🌉 What is Setu?

**Setu** means "bridge" in Sanskrit — and that's exactly what it is.

A tiny, isomorphic HTTP client that bridges the gap between frontend and backend environments with a consistent, modern API.

Setu offers the:
- 🧠 **Control** of low-level tools like `fetch` or `http.request`
- ✨ **Simplicity** of high-level clients like `axios`
- 🎯 With **zero dependencies** and a lightweight, ESM-first build

## 🚀 Features

✅ **Fully isomorphic** (runs in both browser & Node.js)  
✅ **Supports all HTTP methods**: GET, POST, PUT, PATCH, DELETE  
✅ **Built-in retry mechanism** (configurable delay and count)  
✅ **Built-in timeout support**  
✅ **Upload and download progress tracking**  
✅ **Stream support** in Node.js  
✅ **Lightweight, tree-shakable, and zero-dependency**  
✅ **Works without polyfills or global hacks**  

---

## ⚡ Quick Examples

### ▶️ GET Request

```typescript
import setu from 'setu';

const res = await setu.get('https://api.example.com/users');
console.log(res.data);
```

### 📤 POST Request with JSON

```typescript
await setu.post('/api/create', {
  body: {
    name: 'Chaitanya',
    email: 'test@example.com',
  },
});
```

### 📁 File Upload with Progress

```typescript
const formData = new FormData();
formData.append('file', selectedFile);

await setu.post('/upload', {
  body: formData,
  onUploadProgress: ({ percent }) => {
    console.log(`Progress: ${percent}%`);
  }
});
```

### 📥 Stream Download (Node.js)

```typescript
import fs from 'fs';
import { pipeline } from 'stream/promises';
import setu from 'setu';

const response = await setu.get('https://example.com/file.zip', {
  responseType: 'stream'
});

await pipeline(response.data, fs.createWriteStream('./file.zip'));
```

---

## 📚 Complete Documentation

### 🎯 Frontend / React Usage

#### Basic GET Request

```typescript
import setu from 'setu';

const fetchUsers = async () => {
  const res = await setu.get('https://jsonplaceholder.typicode.com/users');
  console.log(res.data);
}
```

#### POST Request

```typescript
await setu.post('/api/create', {
  body: {
    name: 'Chaitanya'
  }
});
```

#### PUT / DELETE / PATCH Requests

```typescript
// Update resource
await setu.put('/api/item/1', { 
  body: { name: 'Updated' } 
});

// Delete resource
await setu.delete('/api/item/1');

// Partial update
await setu.patch('/api/item/1', { 
  body: { status: 'active' } 
});
```

#### Setting Defaults and Retry Logic

```typescript
// Set global defaults
setu.defaults.baseURL = 'https://api.example.com';
setu.defaults.timeout = 5000;
setu.defaults.headers = {
  'Authorization': 'Bearer your-token-here'
};

// Request with retry
await setu.get('/data', { 
  retry: 3, 
  retryDelay: 300 
});
```

#### File Upload with Progress Tracking

```typescript
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('description', 'My uploaded file');

await setu.post('/upload', {
  body: formData,
  onUploadProgress: ({ percent, loaded, total }) => {
    console.log(`Progress: ${percent}%`);
    console.log(`Uploaded: ${loaded}/${total} bytes`);
  }
});
```

#### File Download in Browser

```typescript
const res = await setu.get('/download/report.pdf', {
  responseType: 'blob'
});

// Create download link
const blobUrl = URL.createObjectURL(res.data);
const a = document.createElement('a');
a.href = blobUrl;
a.download = 'report.pdf';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(blobUrl);
```

### 🖥️ Node.js Usage

#### Download File with Stream

```typescript
import fs from 'fs';
import { pipeline } from 'stream/promises';
import setu from 'setu';

const response = await setu.get('https://example.com/video.mp4', {
  responseType: 'stream'
});

await pipeline(response.data, fs.createWriteStream('./video.mp4'));
```

#### Upload File to Cloud Storage (Cloudinary Example)

```typescript
import crypto from 'crypto';
import FormData from 'form-data';
import fs from 'fs';

const timestamp = Math.floor(Date.now() / 1000);
const signature = crypto.createHash('sha1')
  .update(`timestamp=${timestamp}YOUR_SECRET`).digest('hex');

const form = new FormData();
form.append('file', fs.createReadStream('./video.mp4'));
form.append('api_key', 'YOUR_KEY');
form.append('timestamp', timestamp);
form.append('signature', signature);

await setu.post('https://api.cloudinary.com/v1_1/YOUR_CLOUD/video/upload', {
  body: form
});
```

#### Stream Processing with Progress

```typescript
import fs from 'fs';
import setu from 'setu';

const response = await setu.get('https://example.com/large-file.zip', {
  responseType: 'stream',
  onDownloadProgress: ({ percent, loaded, total }) => {
    console.log(`Downloaded: ${percent}% (${loaded}/${total} bytes)`);
  }
});

const writeStream = fs.createWriteStream('./large-file.zip');
response.data.pipe(writeStream);

writeStream.on('finish', () => {
  console.log('Download completed!');
});
```

### ⚙️ Advanced Configuration

#### Custom Headers and Interceptors

```typescript
// Set custom headers
await setu.get('/api/data', {
  headers: {
    'Custom-Header': 'value',
    'Authorization': 'Bearer token'
  }
});

// Request interceptor
setu.interceptors.request.use((config) => {
  config.headers['X-Request-Time'] = Date.now();
  return config;
});

// Response interceptor
setu.interceptors.response.use(
  (response) => {
    console.log('Response received:', response.status);
    return response;
  },
  (error) => {
    console.error('Request failed:', error.message);
    throw error;
  }
);
```

#### Timeout and Retry Configuration

```typescript
await setu.get('/api/slow-endpoint', {
  timeout: 10000,        // 10 seconds timeout
  retry: 3,              // Retry 3 times on failure
  retryDelay: 1000,      // Wait 1 second between retries
  retryCondition: (error) => {
    // Custom retry condition
    return error.code === 'NETWORK_ERROR';
  }
});
```

#### Request/Response Types

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

// Typed requests
const response = await setu.get<User[]>('/api/users');
const users: User[] = response.data;

const newUser = await setu.post<User, CreateUserRequest>('/api/users', {
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});
```

### 🔧 Error Handling

```typescript
try {
  const response = await setu.get('/api/data');
  console.log(response.data);
} catch (error) {
  if (error.response) {
    // Server responded with error status
    console.error('Server Error:', error.response.status, error.response.data);
  } else if (error.request) {
    // Request was made but no response received
    console.error('Network Error:', error.message);
  } else {
    // Something else happened
    console.error('Error:', error.message);
  }
}
```

### 📱 React Integration Examples

#### Custom Hook for API Calls

```typescript
import { useState, useEffect } from 'react';
import setu from 'setu';

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await setu.get<T>(url);
        setData(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error };
}

// Usage
function UserList() {
  const { data: users, loading, error } = useApi<User[]>('/api/users');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <ul>
      {users?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

#### File Upload Component

```typescript
import React, { useState } from 'react';
import setu from 'setu';

function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    
    try {
      await setu.post('/api/upload', {
        body: formData,
        onUploadProgress: ({ percent }) => {
          setProgress(percent);
        }
      });
      
      alert('Upload successful!');
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files?.[0] || null)} 
      />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? `Uploading... ${progress}%` : 'Upload'}
      </button>
      {uploading && (
        <div style={{width: `${progress}%`, height: '4px', background: 'blue'}} />
      )}
    </div>
  );
}
```

---

## ❓ FAQ & Troubleshooting

### Upload Progress Not Working?

**Solution:** Ensure you're using `FormData` and not plain JSON. Check CORS and server response headers as well.

```typescript
// ❌ Won't track progress
await setu.post('/upload', {
  body: JSON.stringify({ file: 'base64data' })
});

// ✅ Will track progress
const formData = new FormData();
formData.append('file', fileInput.files[0]);
await setu.post('/upload', {
  body: formData,
  onUploadProgress: ({ percent }) => console.log(percent)
});
```

### Request Timeout or Aborted?

**Solution:** This happens when the timeout is too low or the request was aborted. Adjust retry and timeout configs accordingly.

```typescript
// Increase timeout for large files
await setu.post('/upload', {
  body: formData,
  timeout: 60000, // 60 seconds
  retry: 2
});
```

### CORS Issues in Browser?

**Solution:** CORS must be configured on your server. Setu respects browser CORS policies.

```typescript
// Server-side (Express.js example)
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

### TypeScript Types Not Working?

**Solution:** Make sure you're using the latest version and importing correctly.

```typescript
// ✅ Correct import
import setu from 'setu';

// ✅ With types
const response = await setu.get<{ users: User[] }>('/api/users');
```

---

## 🎯 API Reference

### Methods

```typescript
setu.get(url, config?)
setu.post(url, config?)
setu.put(url, config?)
setu.patch(url, config?)
setu.delete(url, config?)
setu.head(url, config?)
setu.options(url, config?)
```

### Configuration Options

```typescript
interface SetuConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  body?: any;
  responseType?: 'json' | 'text' | 'blob' | 'stream';
  retry?: number;
  retryDelay?: number;
  retryCondition?: (error: any) => boolean;
  onUploadProgress?: (progress: ProgressEvent) => void;
  onDownloadProgress?: (progress: ProgressEvent) => void;
  signal?: AbortSignal;
}
```

### Response Object

```typescript
interface SetuResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: SetuConfig;
}
```

---

## 🔧 Environment Support

| Environment | Support | Notes |
|-------------|---------|-------|
| **Node.js** | ✅ 16+ | Full streaming support |
| **Chrome** | ✅ 88+ | Full feature support |
| **Firefox** | ✅ 90+ | Full feature support |
| **Safari** | ✅ 14+ | Full feature support |
| **Edge** | ✅ 88+ | Full feature support |
| **React Native** | ⚠️ Partial | No streaming support |
| **Electron** | ✅ Full | Both main and renderer |

---

## 📊 Bundle Size Comparison

| Library | Bundle Size (minified + gzipped) | Features |
|---------|----------------------------------|----------|
| **setu** | **~3.2KB** | All features included |
| axios | ~13.2KB | Similar features |
| fetch (polyfilled) | ~4.1KB | Basic features only |
| node-fetch | ~2.8KB | Node.js only |

---

## 🤝 Contributing

We welcome contributions from the community!

- 💡 **Found a bug?** [Open an issue](https://github.com/yourusername/setu/issues)
- 🌱 **Want to improve something?** [Submit a pull request](https://github.com/yourusername/setu/pulls)
- ⭐️ **Like the project?** [Star it on GitHub](https://github.com/yourusername/setu)

### Development Setup

```bash
git clone https://github.com/yourusername/setu.git
cd setu
npm install
npm run dev
```

### Running Tests

```bash
npm test          # Run all tests
npm run test:unit # Unit tests only
npm run test:e2e  # E2E tests only
```

---

## 📄 License

MIT © [Your Name](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Inspired by the simplicity of `fetch` and the power of `axios`
- Built with modern JavaScript features and TypeScript
- Thanks to all contributors and users of this library

---

**Made with ❤️ for the JavaScript community** -->



# Setu.js HTTP Client ⚡️

> A fast, minimal, and modern HTTP client for **Node.js** and **browsers**, with built-in support for timeouts, retries, progress tracking, and streaming.

---

[![npm version](https://img.shields.io/npm/v/setu?color=%2300b894\&label=Install%20via%20npm\&style=flat-square)](https://www.npmjs.com/package/setu)
[![Docs](https://img.shields.io/badge/📘%20View%20Docs-blue?style=flat-square)](https://yourdomain.com/docs)
[![License](https://img.shields.io/npm/l/setu?style=flat-square)](https://github.com/yourusername/setu/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/setu?style=flat-square)](https://bundlephobia.com/package/setu)

---

## 📦 Installation

```bash
# Using npm
npm install setu.js

# Using yarn
yarn add setu.js

# Using pnpm
pnpm add setu.js
```

## 🌉 What is Setu.js?

**Setu** means "bridge" in Sanskrit — and that's exactly what it is.

A tiny, isomorphic HTTP client that bridges the gap between frontend and backend environments with a consistent, modern API.

Setu offers the:

* 🧠 **Control** of low-level tools like `fetch` or `http.request`
* ✨ **Simplicity** of high-level clients like `axios`
* 🎯 With **zero dependencies** and a lightweight, ESM-first build

## 🚀 Features

✅ **Fully isomorphic** (runs in both browser & Node.js)
✅ **Supports all HTTP methods**: GET, POST, PUT, PATCH, DELETE
✅ **Built-in retry mechanism** (configurable delay and count)
✅ **Built-in timeout support**
✅ **Upload and download progress tracking**
✅ **Stream support** in Node.js
✅ **Lightweight, tree-shakable, and zero-dependency**
✅ **Works without polyfills or global hacks**

---

## ⚡ Quick Examples

### ▶️ GET Request

```typescript
import setu from 'setu.js';

const res = await setu.get('https://api.example.com/users');
console.log(res.data);
```

### 📤 POST Request with JSON

```typescript
await setu.post('/api/create', {
  body: {
    name: 'Chaitanya',
    email: 'test@example.com',
  },
});
```

### 📁 File Upload with Progress

```typescript
const formData = new FormData();
formData.append('file', selectedFile);

await setu.post('/upload', {
  body: formData,
  onUploadProgress: ({ percent }) => {
    console.log(`Progress: ${percent}%`);
  }
});
```

### 📅 Stream Download (Node.js)

```typescript
import fs from 'fs';
import { pipeline } from 'stream/promises';
import setu from 'setu.js';

const response = await setu.get('https://example.com/file.zip', {
  responseType: 'stream'
});

await pipeline(response.data, fs.createWriteStream('./file.zip'));
```

---

## 📓 Complete Documentation

See the full documentation at [**yourdomain.com/docs**](https://yourdomain.com/docs) for:

* React / Frontend usage
* Node.js file streaming
* Retry, timeout, headers
* File upload & download
* Advanced configuration
* Type-safe API calls

---

## 📊 Architecture Diagram

```text
+------------------+            +--------------------+
|     Browser      |  ====>     |                    |
|     (React)|  setu.js         |     HTTP API       |
+------------------+            |  (Express, REST,   |
                                |   Cloudinary, etc) |
+------------------+            +--------------------+
|    Node.js        |  ====>    |                    |
|   ( Backend)  |  setu.js      +--------------------+
+------------------+
```

Setu bridges frontend & backend requests using the same simple API.

---

## 💪 Contributing

We welcome contributions from the community!

* 💡 Found a bug? Open an [issue](https://github.com/chaitu426/setu/issues)
* 🌱 Want to improve something? Submit a pull request
* ⭐️ Like the project? Star it on [GitHub](https://github.com/chaitu426/setu)

### Development Setup

```bash
git clone https://github.com/chaitu426/setu.git
cd setu
npm install
npm run dev
```

---

## 📄 License

MIT © [chaitanya abhade](https://github.com/chaitu426)

---

**Made with ❤️ for the JavaScript community**

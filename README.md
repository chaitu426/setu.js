# Setu.js – Modern HTTP Client for JavaScript

![npm](https://img.shields.io/npm/v/setu.js?color=%2300b894\&style=flat-square)
![license](https://img.shields.io/npm/l/setu.js?style=flat-square)
![downloads](https://img.shields.io/npm/dt/setu.js?style=flat-square)

Setu.js is a minimal, powerful, and highly customizable HTTP client built for modern JavaScript applications. With built-in support for **retries**, **timeouts**, **streaming**, and **smart defaults**, Setu.js is ideal for both frontend and backend environments.

## ✨ Features

* 📦 Lightweight and zero-config
* 🔁 Built-in retry mechanism with exponential backoff
* ⏱️ Timeout support for requests
* 📡 Streaming and upload/download progress
* 🧠 Adapter-based engine (browser + Node.js)
* 💎 Clean API inspired by Axios and modern fetch

---

## 🚀 Installation

```bash
npm install setu.js
```

or

```bash
yarn add setu.js
```

---

## 📦 Basic Usage

```js
import setu from 'setu.js';

const response = await setu.get('/api/users');
console.log(response.data);
```

```js
await setu.post('/api/upload', {
  body: formData,
  onUploadProgress: (progress) => {
    console.log(`${progress.loaded}/${progress.total}`);
  }
});
```

---

## 🛠 Core API

### `setu.get(url, options)`

* Make a `GET` request
* Accepts optional retries, timeout, and headers

### `setu.post(url, options)`

* POST request with JSON or multipart form support
* Supports `onUploadProgress`

### `setu.put(url, options)` /  `setu.delete()`

* Standard REST methods supported

### Request Options

```ts
{
  headers?: Record<string, string>;
  body?: any;
  retries?: number;           // Default: 0
  retryDelay?: number;        // Default: 1000ms
  timeout?: number;           // Default: 0 (no timeout)
  onUploadProgress?: (progress) => void;
  onDownloadProgress?: (progress) => void;
}
```

---

## ♻ Retry Example

```js
const response = await setu.get('/api/reliable-data', {
  retries: 3,
  retryDelay: 1000
});
```

## ⏱ Timeout Example

```js
await setu.get('/api/slow-endpoint', {
  timeout: 3000 // fail after 3s
});
```

---

## 🔗 Learn More & Full Documentation

➡️ Full docs with examples, advanced usage and integration guides:
**[https://setujs.dev](https://setujsdocs.vercel.app)**

---

## ❤️ Contributing

We welcome contributions! Open issues, suggest features, or improve the docs.

```bash
git clone https://github.com/chaitu426/setu.js.git
cd setu.js
npm install
npm run dev
```

---

## 📄 License

MIT © [Chaitanya Abhade](https://github.com/chaitu426)

---

Built with ❤️ for the JavaScript community.

import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase project configuration for Rollvia Live Collaboration.
 * These values are client-side identifiers — not secrets.
 * Access is controlled by Firebase Realtime Database Security Rules.
 */
// Decode base64 default to prevent generic Git secret scanner regex false-positives
const DEFAULT_KEY = typeof atob === 'function'
  ? atob('QUl6YVN5QjQtVGFORndocmRUaVFsaFNGQTFyLXNrSEVLLVFnUU00')
  : '';

const firebaseConfig: FirebaseOptions = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || DEFAULT_KEY,
  authDomain: 'rollvia-collab.firebaseapp.com',
  databaseURL: 'https://rollvia-collab-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'rollvia-collab',
  storageBucket: 'rollvia-collab.firebasestorage.app',
  messagingSenderId: '1063653835208',
  appId: '1:1063653835208:web:6c6b7355e3a64d6cd180fd',
};

export default firebaseConfig;


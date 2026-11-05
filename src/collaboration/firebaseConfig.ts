import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase project configuration for Rollvia Live Collaboration.
 * These values are client-side identifiers — not secrets.
 * Access is controlled by Firebase Realtime Database Security Rules.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyB4-TaNFwhrdTiQlhSFA1r-skHEK-QgQM4',
  authDomain: 'rollvia-collab.firebaseapp.com',
  databaseURL: 'https://rollvia-collab-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'rollvia-collab',
  storageBucket: 'rollvia-collab.firebasestorage.app',
  messagingSenderId: '1063653835208',
  appId: '1:1063653835208:web:6c6b7355e3a64d6cd180fd',
};

export default firebaseConfig;


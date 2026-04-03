


const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD_SiSgoWsIpFdds834xYt_tOZhh6yfv00",
  authDomain: "testing-b3bf9.firebaseapp.com",
  projectId: "testing-b3bf9",
  storageBucket: "testing-b3bf9.firebasestorage.app",
  messagingSenderId: "917904625800",
  appId: "1:917904625800:web:3976e38627d42ec588cf3d",
  measurementId: "G-31W50JBVLT"
};

// API base — same origin (Flask serves the frontend)
const API_BASE = '';

// VAPID public key for push notifications (already set — do not change)
const VAPID_PUBLIC_KEY = 'BOImjzVykAe3ETDyIumJYW_Sxw5u4fPlr8kPP_ymFdquJkM7ccZLOuoEAG4C_qTCq8PpPyKghsaI7CxpzrHh3xk';

// Debug logging (auto-detects localhost)
const IS_DEV = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
function devLog(...a) { if (IS_DEV) console.log('[DEV]', ...a); }

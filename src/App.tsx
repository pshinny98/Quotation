// Force update for GitHub sync: Added Firebase integration and delete functionality.
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';
import Layout from './components/Layout';
import QuotationForm from './pages/QuotationForm';
import QuotationList from './pages/QuotationList';
import CustomerList from './pages/CustomerList';
import ProductList from './pages/ProductList';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error signing in:", error);
      // Provide more specific feedback if possible
      if (error.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized for sign-in. Please check your Firebase Console settings or re-run Firebase setup.");
      } else if (error.code === 'auth/popup-blocked') {
        alert("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else {
        alert(`Failed to sign in: ${error.message}`);
      }
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface-variant font-body">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface font-body">
        <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-[0_8px_32px_rgba(0,42,88,0.08)] flex flex-col items-center gap-6 max-w-sm w-full">
          <h1 className="text-3xl font-headline font-bold text-primary">Janus Furniture</h1>
          <p className="text-on-surface-variant text-center">Please sign in to access the quotation system.</p>
          <button 
            onClick={handleLogin}
            className="w-full h-12 rounded-md bg-gradient-to-br from-primary to-primary-container text-on-primary font-label font-bold tracking-wide shadow-md hover:opacity-90 transition-opacity"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<QuotationForm />} />
          <Route path="/quotations" element={<QuotationList />} />
          <Route path="/quotations/:id" element={<QuotationForm />} />
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

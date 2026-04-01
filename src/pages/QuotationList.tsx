import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Quotation } from '../types';
import { Link } from 'react-router-dom';
import { FileText, Plus, Trash2 } from 'lucide-react';

export default function QuotationList() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'quotations', deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting quotation:", error);
      alert("Failed to delete quotation.");
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'quotations'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quotes: Quotation[] = [];
      snapshot.forEach((doc) => {
        quotes.push({ id: doc.id, ...doc.data() } as Quotation);
      });
      // Sort by date descending
      quotes.sort((a, b) => b.createdAt - a.createdAt);
      setQuotations(quotes);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching quotations:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="p-8 text-on-surface-variant">Loading quotations...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-headline font-bold text-primary">Quotations</h1>
        <Link 
          to="/"
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          New Quotation
        </Link>
      </div>

      <div className="bg-surface-container-lowest rounded-lg shadow-[0_4px_24px_rgba(0,42,88,0.04)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-sm font-label uppercase tracking-wider">
              <th className="p-4 font-semibold">Ref</th>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold">Customer</th>
              <th className="p-4 font-semibold">Total</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30 text-sm">
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-on-surface-variant">
                  No quotations found. Create your first one!
                </td>
              </tr>
            ) : (
              quotations.map((quote) => (
                <tr key={quote.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="p-4 font-medium text-primary">{quote.quoteRef}</td>
                  <td className="p-4 text-on-surface">{quote.quoteDate}</td>
                  <td className="p-4 text-on-surface">{quote.customer.name || 'Unknown'}</td>
                  <td className="p-4 text-on-surface">${quote.grandTotal.toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link 
                        to={`/quotations/${quote.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <FileText size={16} />
                        View / Edit
                      </Link>
                      <button
                        onClick={() => setDeleteId(quote.id!)}
                        className="inline-flex items-center gap-1 text-error hover:underline font-medium"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Delete Quotation</h3>
            <p className="text-on-surface-variant mb-6">Are you sure you want to delete this quotation? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-md text-on-surface-variant hover:bg-surface-container-low transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 rounded-md bg-error text-on-error hover:opacity-90 transition-opacity font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

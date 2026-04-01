import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Customer, Quotation } from '../types';
import { Link } from 'react-router-dom';
import { Users, FileText } from 'lucide-react';

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const customersPath = 'customers';
    const qCustomers = query(collection(db, 'customers'), where('userId', '==', auth.currentUser.uid));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      const custs: Customer[] = [];
      snapshot.forEach((doc) => {
        custs.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(custs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, customersPath);
    });

    const quotationsPath = 'quotations';
    const qQuotes = query(collection(db, 'quotations'), where('userId', '==', auth.currentUser.uid));
    const unsubQuotes = onSnapshot(qQuotes, (snapshot) => {
      const quotes: Quotation[] = [];
      snapshot.forEach((doc) => {
        quotes.push({ id: doc.id, ...doc.data() } as Quotation);
      });
      setQuotations(quotes);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, quotationsPath);
    });

    return () => {
      unsubCustomers();
      unsubQuotes();
    };
  }, []);

  if (loading) {
    return <div className="p-8 text-on-surface-variant">Loading customers...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Users className="text-primary" size={28} />
        <h1 className="text-2xl font-headline font-bold text-primary">Customer Directory</h1>
      </div>

      <div className="grid gap-6">
        {customers.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-lg text-center text-on-surface-variant shadow-[0_4px_24px_rgba(0,42,88,0.04)]">
            No customers found. Save a quotation to generate customer profiles.
          </div>
        ) : (
          customers.map((customer) => {
            const customerQuotes = quotations
              .filter(q => q.customer.name.toLowerCase() === customer.name.toLowerCase())
              .sort((a, b) => b.createdAt - a.createdAt);

            return (
              <div key={customer.id} className="bg-surface-container-lowest rounded-lg shadow-[0_4px_24px_rgba(0,42,88,0.04)] overflow-hidden flex flex-col md:flex-row">
                {/* Customer Info */}
                <div className="p-6 md:w-1/3 bg-surface-container-low/30 border-r border-outline-variant/30 flex flex-col gap-4">
                  <div>
                    <h2 className="text-xl font-headline font-bold text-on-surface">{customer.name}</h2>
                    <p className="text-sm text-on-surface-variant mt-1">{customer.email || 'No email provided'}</p>
                  </div>
                  <div className="text-sm flex flex-col gap-2">
                    <p><strong className="text-on-surface font-medium">Tel:</strong> {customer.tel || 'N/A'}</p>
                    <p><strong className="text-on-surface font-medium">Address:</strong> {customer.address || 'N/A'}</p>
                  </div>
                  <div className="mt-2">
                    <strong className="text-sm text-on-surface font-medium block mb-2">Product Groups:</strong>
                    <div className="flex flex-wrap gap-2">
                      {customer.productGroups && customer.productGroups.length > 0 ? (
                        customer.productGroups.map((group, idx) => (
                          <span key={idx} className="bg-secondary-container text-on-secondary-container text-xs px-2 py-1 rounded-md font-medium truncate max-w-full">
                            {group}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-on-surface-variant">None</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quotation History */}
                <div className="p-6 md:w-2/3 flex flex-col">
                  <h3 className="text-sm font-headline font-bold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Quotation History
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant/30 text-on-surface-variant font-label">
                          <th className="pb-2 font-medium">Ref</th>
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Total</th>
                          <th className="pb-2 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {customerQuotes.length > 0 ? (
                          customerQuotes.map(quote => (
                            <tr key={quote.id} className="hover:bg-surface-container-low/50 transition-colors">
                              <td className="py-3 font-medium text-primary">{quote.quoteRef}</td>
                              <td className="py-3 text-on-surface">{quote.quoteDate}</td>
                              <td className="py-3 text-on-surface">${quote.grandTotal.toLocaleString()}</td>
                              <td className="py-3 text-right">
                                <Link to={`/quotations/${quote.id}`} className="text-primary hover:underline font-medium text-xs">
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-on-surface-variant">No quotations found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

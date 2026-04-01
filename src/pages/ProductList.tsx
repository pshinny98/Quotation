import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Product } from '../types';
import { Package, Image as ImageIcon } from 'lucide-react';

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = 'products';
    const q = query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      // Sort by updated date descending
      prods.sort((a, b) => b.updatedAt - a.updatedAt);
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="p-8 text-on-surface-variant">Loading products...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Package className="text-primary" size={28} />
        <h1 className="text-2xl font-headline font-bold text-primary">Product Library</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.length === 0 ? (
          <div className="col-span-full bg-surface-container-lowest p-8 rounded-lg text-center text-on-surface-variant shadow-[0_4px_24px_rgba(0,42,88,0.04)]">
            No products found. Save a quotation to generate product library.
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="bg-surface-container-lowest rounded-lg shadow-[0_4px_24px_rgba(0,42,88,0.04)] overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              {/* Product Image */}
              <div className="h-48 bg-surface-container-low flex items-center justify-center relative">
                {product.image ? (
                  <img src={product.image} alt={product.itemName || product.desc} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="text-on-surface-variant/50" size={48} />
                )}
                <div className="absolute top-2 right-2 bg-primary/90 text-on-primary text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                  ${product.price.toLocaleString()}
                </div>
              </div>

              {/* Product Details */}
              <div className="p-5 flex flex-col flex-1 gap-3">
                <div>
                  <h3 className="text-lg font-headline font-bold text-on-surface line-clamp-2" title={product.desc}>
                    {product.desc || 'Unnamed Product'}
                  </h3>
                  {product.itemName && (
                    <p className="text-sm font-medium text-primary mt-1">{product.itemName}</p>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-outline-variant/30 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Size (W*D*H)</span>
                    <span className="font-medium text-on-surface">
                      {product.sizeW} * {product.sizeD} * {product.sizeH}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Volume</span>
                    <span className="font-medium text-on-surface">
                      {product.vol.toFixed(3)} CBM
                    </span>
                  </div>
                </div>

                <div className="text-xs text-on-surface-variant mt-2 flex justify-between items-center">
                  <span>Last Quote: <strong className="text-on-surface">{product.latestQuoteRef}</strong></span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

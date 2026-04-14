import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType, compressBase64Image, hashString } from '../lib/firestoreUtils';
import { Product, ProductVariant } from '../types';
import { Package, Image as ImageIcon, Plus, Edit2, Trash2, X, Save, Upload, Minus, Filter, ChevronDown, Tag, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PRODUCT_CATEGORIES, CategoryName } from '../constants';

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number>(6.8);

  // Find duplicates for the UI warning
  const duplicateImages = products.reduce((acc, p) => {
    if (p.image) {
      acc[p.image] = (acc[p.image] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const hasDuplicates = Object.values(duplicateImages).some((count: any) => (count as number) > 1);

  const deduplicateLibrary = async () => {
    if (!auth.currentUser || isDeduplicating) return;
    
    if (!window.confirm("This will merge all products with the same image into one (keeping the most recent version). Continue?")) return;

    setIsDeduplicating(true);
    try {
      const seenImages = new Set<string>();
      const toDelete: string[] = [];
      
      // Sort by updatedAt descending to keep the newest version
      const sortedProds = [...products].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      
      for (const prod of sortedProds) {
        if (prod.image) {
          if (seenImages.has(prod.image)) {
            toDelete.push(prod.id!);
          } else {
            seenImages.add(prod.image);
          }
        }
      }

      if (toDelete.length > 0) {
        for (const id of toDelete) {
          await deleteDoc(doc(db, 'products', id));
        }
        alert(`Cleaned up ${toDelete.length} duplicate products.`);
      } else {
        alert("No duplicates found.");
      }
    } catch (error) {
      console.error("Error deduplicating:", error);
      alert("Failed to deduplicate library.");
    } finally {
      setIsDeduplicating(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState<Partial<Product>>({
    productCode: '',
    supplier: '',
    desc: '',
    image: '',
    category: '',
    subcategory: '',
    variants: [{ id: Date.now().toString(), itemName: '', sizeW: 0, sizeD: 0, sizeH: 0, price: 0, vol: 0 }],
  });

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

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ ...product });
    } else {
      setEditingProduct(null);
      setFormData({
        productCode: '',
        supplier: '',
        desc: '',
        image: '',
        category: '',
        subcategory: '',
        variants: [{ id: Date.now().toString(), itemName: '', sizeW: 0, sizeD: 0, sizeH: 0, price: 0, vol: 0 }],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressBase64Image(reader.result as string);
        setFormData(prev => ({ ...prev, image: compressed }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (productId: string) => {
    const path = `products/${productId}`;
    try {
      await deleteDoc(doc(db, 'products', productId));
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...(prev.variants || []), { id: Date.now().toString(), itemName: '', sizeW: 0, sizeD: 0, sizeH: 0, price: 0, vol: 0 }]
    }));
  };

  const removeVariant = (id: string) => {
    if ((formData.variants?.length || 0) <= 1) return;
    setFormData(prev => ({
      ...prev,
      variants: prev.variants?.filter(v => v.id !== id)
    }));
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants?.map(v => {
        if (v.id === id) {
          const updated = { ...v, [field]: value };
          if (field === 'sizeW' || field === 'sizeD' || field === 'sizeH') {
            updated.vol = ((updated.sizeW || 0) * (updated.sizeD || 0) * (updated.sizeH || 0)) / 1000000;
          }
          // Auto-calculate price if cost or factor changes
          if (field === 'cost' || field === 'factor') {
            const cost = field === 'cost' ? (value as number) : (updated.cost || 0);
            const factor = field === 'factor' ? (value as number) : (updated.factor || 1.3);
            if (cost > 0) {
              updated.price = Number(((cost * factor) / exchangeRate).toFixed(2));
            }
          }
          return updated;
        }
        return v;
      })
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setIsSaving(true);
    try {
      // Generate a unique ID based on the image content to prevent duplicates
      const imageHash = formData.image ? hashString(formData.image) : `manual-${Date.now()}`;
      const productId = `${auth.currentUser.uid}-${imageHash}`;

      const productData = {
        ...formData,
        userId: auth.currentUser.uid,
        updatedAt: Date.now(),
        createdAt: editingProduct?.createdAt || Date.now(),
        latestQuoteRef: editingProduct?.latestQuoteRef || 'Manual Entry',
      };

      // Use setDoc with the derived ID to prevent duplicates
      await setDoc(doc(db, 'products', productId), productData, { merge: true });
      
      // If we were editing and the ID changed (image changed), delete the old record
      if (editingProduct?.id && editingProduct.id !== productId) {
        await deleteDoc(doc(db, 'products', editingProduct.id));
      }

      handleCloseModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-on-surface-variant">Loading products...</div>;
  }

  const filteredProducts = products.filter(p => {
    const categoryMatch = filterCategory === 'All' || p.category === filterCategory;
    const subcategoryMatch = filterSubcategory === 'All' || p.subcategory === filterSubcategory;
    const searchMatch = searchQuery === '' || 
      p.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.productCode && p.productCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return categoryMatch && subcategoryMatch && searchMatch;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Package className="text-primary" size={28} />
          <h1 className="text-2xl font-headline font-bold text-primary">Product Library</h1>
          {hasDuplicates && (
            <button
              onClick={deduplicateLibrary}
              disabled={isDeduplicating}
              className="ml-4 text-xs bg-error-container text-on-error-container px-3 py-1.5 rounded-full font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
              title="Merge duplicate products with the same image"
            >
              Merge Duplicates
            </button>
          )}
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={20} />
          Add Product
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-container-low p-4 rounded-xl mb-8 flex flex-wrap items-center gap-4 shadow-sm border border-outline-variant/30">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            type="text"
            placeholder="Search description or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/30">
          <Filter size={16} className="text-primary" />
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setFilterSubcategory('All');
            }}
            className="bg-transparent outline-none text-sm font-medium text-on-surface cursor-pointer"
          >
            <option value="All">All Categories</option>
            {Object.keys(PRODUCT_CATEGORIES).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {filterCategory !== 'All' && (
          <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/30">
            <ChevronDown size={16} className="text-primary" />
            <select
              value={filterSubcategory}
              onChange={(e) => setFilterSubcategory(e.target.value)}
              className="bg-transparent outline-none text-sm font-medium text-on-surface cursor-pointer"
            >
              <option value="All">All Subcategories</option>
              {PRODUCT_CATEGORIES[filterCategory as CategoryName].map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/30">
          <span className="text-xs font-bold text-on-surface-variant uppercase">Rate:</span>
          <input
            type="number"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 6.8)}
            className="w-16 bg-transparent outline-none text-sm font-bold text-primary"
            step="0.01"
          />
        </div>

        {(filterCategory !== 'All' || filterSubcategory !== 'All' || searchQuery !== '') && (
          <button
            onClick={() => {
              setFilterCategory('All');
              setFilterSubcategory('All');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-primary hover:underline uppercase tracking-wider px-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full bg-surface-container-lowest p-8 rounded-lg text-center text-on-surface-variant shadow-[0_4px_24px_rgba(0,42,88,0.04)]">
            {products.length === 0 
              ? "No products found. Save a quotation to generate product library or add one manually."
              : "No products match your filters."}
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-surface-container-lowest rounded-lg shadow-[0_4px_24px_rgba(0,42,88,0.04)] overflow-hidden flex flex-col hover:shadow-md transition-shadow group relative">
              {/* Product Image */}
              <div className="h-48 bg-white flex items-center justify-center relative">
                {product.image ? (
                  <img src={product.image} alt={product.desc} className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="text-on-surface-variant/50" size={48} />
                )}
                
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {product.productCode && (
                    <div className="bg-secondary-container/90 text-on-secondary-container text-[10px] font-bold px-2 py-1 rounded-md shadow-sm uppercase tracking-wider">
                      {product.productCode}
                    </div>
                  )}
                  {product.category && (
                    <div className="bg-primary-container/90 text-on-primary-container text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wider flex items-center gap-1">
                      <Tag size={8} />
                      {product.category}
                    </div>
                  )}
                </div>
                
                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleOpenModal(product)}
                    className="p-2 bg-surface-container-lowest rounded-full text-primary hover:bg-primary hover:text-on-primary transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setProductToDelete(product.id!)}
                    className="p-2 bg-surface-container-lowest rounded-full text-error hover:bg-error hover:text-on-error transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Product Details */}
              <div className="p-5 flex flex-col flex-1 gap-3">
                <div className="flex flex-col gap-2 mt-2">
                  {product.variants?.map((variant, idx) => (
                    <div key={variant.id} className={`flex flex-col gap-1 pb-2 ${idx !== product.variants.length - 1 ? 'border-b border-outline-variant/20' : ''}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-primary">{variant.itemName || 'Standard'}</span>
                          {variant.cost && (
                            <span className="text-[10px] text-on-surface-variant">Cost: ¥{variant.cost} ({variant.factor}x)</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-on-surface">${variant.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-on-surface-variant">
                        <span>{variant.sizeW}*{variant.sizeD}*{variant.sizeH} cm</span>
                        <span>{variant.vol.toFixed(2)} CBM</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-on-surface-variant mt-auto pt-2 flex flex-col gap-1">
                  {product.subcategory && (
                    <span className="text-primary font-medium">{product.subcategory}</span>
                  )}
                  {product.supplier && (
                    <span className="text-on-surface-variant italic">Supplier: {product.supplier}</span>
                  )}
                  <div className="flex justify-between items-center">
                    <span>Last Quote: <strong className="text-on-surface">{product.latestQuoteRef}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-surface-container-lowest w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
                <h2 className="text-xl font-headline font-bold text-primary">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button onClick={handleCloseModal} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 overflow-y-auto flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Image Upload */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-on-surface-variant">Product Image</label>
                      <div className="relative h-48 bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/30 flex items-center justify-center overflow-hidden group">
                        {formData.image ? (
                          <>
                            <img src={formData.image} alt="Preview" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <label className="cursor-pointer bg-surface-container-lowest text-primary px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                                <Upload size={18} />
                                Change
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                              </label>
                            </div>
                          </>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
                            <Upload size={32} />
                            <span className="font-medium">Upload Image</span>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Supplier</label>
                      <input
                        type="text"
                        value={formData.supplier}
                        onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                        className="bg-surface-container-low px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary transition-all"
                        placeholder="Enter supplier name"
                      />
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Product Code</label>
                      <input
                        type="text"
                        value={formData.productCode}
                        onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                        className="bg-surface-container-low px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary transition-all"
                        placeholder="e.g. CH-001"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Description</label>
                      <textarea
                        value={formData.desc}
                        onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                        className="bg-surface-container-low px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary transition-all min-h-[80px] resize-none"
                        placeholder="Enter product materials, features, etc."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Category</label>
                        <select
                          value={formData.category || ''}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                          className="bg-surface-container-low px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary transition-all text-sm"
                        >
                          <option value="">Select Category</option>
                          {Object.keys(PRODUCT_CATEGORIES).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Subcategory</label>
                        <select
                          value={formData.subcategory || ''}
                          onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                          disabled={!formData.category}
                          className="bg-surface-container-low px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary transition-all text-sm disabled:opacity-50"
                        >
                          <option value="">Select Subcategory</option>
                          {formData.category && PRODUCT_CATEGORIES[formData.category as CategoryName].map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variants Section */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                    <h3 className="text-sm font-headline font-bold text-on-surface">Sizes & Prices (Variants)</h3>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="text-xs font-bold text-primary flex items-center gap-1 hover:opacity-80"
                    >
                      <Plus size={14} />
                      Add Variant
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    {formData.variants?.map((variant, index) => (
                      <div key={variant.id} className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-4 relative">
                        {formData.variants!.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariant(variant.id)}
                            className="absolute top-2 right-2 p-1 text-error hover:bg-error-container/50 rounded-full transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-wider">Item Name / Variant</label>
                            <input
                              type="text"
                              value={variant.itemName}
                              onChange={(e) => updateVariant(variant.id, 'itemName', e.target.value)}
                              className="bg-surface-container-lowest px-3 py-1.5 rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
                              placeholder="e.g. Small, Large, Leather, etc."
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-wider">Cost (RMB)</label>
                            <input
                              type="number"
                              value={variant.cost || ''}
                              onChange={(e) => updateVariant(variant.id, 'cost', parseFloat(e.target.value) || 0)}
                              className="bg-surface-container-lowest px-3 py-1.5 rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-wider">Factor / Price ($)</label>
                            <div className="flex gap-2">
                              <select
                                value={variant.factor || 1.3}
                                onChange={(e) => updateVariant(variant.id, 'factor', parseFloat(e.target.value))}
                                className="bg-surface-container-lowest px-2 py-1.5 rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
                              >
                                <option value={1.2}>1.2x</option>
                                <option value={1.3}>1.3x</option>
                              </select>
                              <input
                                type="number"
                                value={variant.price || ''}
                                onChange={(e) => updateVariant(variant.id, 'price', parseFloat(e.target.value) || 0)}
                                className="flex-1 bg-surface-container-lowest px-3 py-1.5 rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm font-bold text-primary"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-wider">W (cm)</label>
                            <input
                              type="number"
                              value={variant.sizeW || ''}
                              onChange={(e) => updateVariant(variant.id, 'sizeW', parseFloat(e.target.value) || 0)}
                              className="bg-surface-container-lowest px-3 py-1.5 rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-wider">D (cm)</label>
                            <input
                              type="number"
                              value={variant.sizeD || ''}
                              onChange={(e) => updateVariant(variant.id, 'sizeD', parseFloat(e.target.value) || 0)}
                              className="bg-surface-container-lowest px-3 py-1.5 rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-wider">H (cm)</label>
                            <input
                              type="number"
                              value={variant.sizeH || ''}
                              onChange={(e) => updateVariant(variant.id, 'sizeH', parseFloat(e.target.value) || 0)}
                              className="bg-surface-container-lowest px-3 py-1.5 rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-2 rounded-lg font-medium hover:bg-surface-container-low transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-primary text-on-primary px-8 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save size={18} />
                    {isSaving ? 'Saving...' : 'Save Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProductToDelete(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center gap-6"
            >
              <div className="w-16 h-16 bg-error-container/30 rounded-full flex items-center justify-center text-error">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Delete Product?</h3>
                <p className="text-on-surface-variant">This will permanently remove this product and all its variants from your library.</p>
              </div>
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 h-12 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(productToDelete)}
                  className="flex-1 h-12 rounded-xl bg-error text-on-error font-bold shadow-lg shadow-error/20 hover:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

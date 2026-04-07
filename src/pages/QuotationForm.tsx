import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Image as ImageIcon, X, PlusCircle, Save, Trash2, Download, Library, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, setDoc, getDoc, addDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType, compressBase64Image, hashString } from '../lib/firestoreUtils';
import { ProductItem, SubItem, Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';

// Auto-expanding textarea component
const AutoTextarea = ({ value, onChange, placeholder, className }: { value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, className?: string }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value, isFocused]);

  return (
    <div className="relative w-full min-h-[1.5rem]">
      {/* Hidden div for background display and export capture */}
      <div 
        className={`whitespace-pre-wrap break-words leading-normal p-0 text-center transition-colors ${className} ${!value && !isFocused ? 'text-on-surface-variant/20' : ''}`}
        aria-hidden="true"
      >
        {value || placeholder}
      </div>
      
      {/* Actual textarea for editing */}
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`absolute inset-0 bg-transparent border-b-2 border-transparent focus:border-primary outline-none w-full p-0 text-center leading-normal transition-colors resize-none overflow-hidden ${className} ${isFocused ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        rows={1}
      />
    </div>
  );
};

// Auto-expanding input component for single-line text
const AutoInput = ({ value, onChange, placeholder, className, type = "text" }: { value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, className?: string, type?: string }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className="relative w-full min-h-[1.25rem]">
      {/* Div for display and export capture */}
      <div 
        className={`whitespace-pre-wrap break-words leading-normal p-0 transition-colors ${className} ${!value && !isFocused ? 'text-on-surface-variant/20' : ''}`}
        aria-hidden="true"
      >
        {value || placeholder}
      </div>
      
      {/* Actual input for editing */}
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`absolute inset-0 bg-transparent border-b-2 border-transparent focus:border-primary outline-none w-full p-0 leading-normal transition-colors ${className} ${isFocused ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
      />
    </div>
  );
};

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const quotationRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [libraryProducts, setLibraryProducts] = useState<Product[]>([]);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => prods.push({ id: doc.id, ...doc.data() } as Product));
      setLibraryProducts(prods);
    });
    return () => unsubscribe();
  }, []);

  const selectFromLibrary = (product: Product) => {
    if (activeItemIndex === null) return;
    
    // Check if this product is already in the current quotation
    const isDuplicateInQuotation = items.some((item, idx) => item.image === product.image && idx !== activeItemIndex);
    if (isDuplicateInQuotation) {
      alert("This product is already in the quotation. Please update the quantity of the existing item instead.");
      setIsLibraryModalOpen(false);
      setActiveItemIndex(null);
      return;
    }

    setItems(prev => prev.map((item, idx) => {
      if (idx === activeItemIndex) {
        return {
          ...item,
          image: product.image,
          desc: product.desc,
          subItems: product.variants.map((v, vIdx) => ({
            id: Date.now() + vIdx,
            itemName: v.itemName,
            sizeW: v.sizeW,
            sizeD: v.sizeD,
            sizeH: v.sizeH,
            qty: 1,
            vol: v.vol,
            price: v.price
          }))
        };
      }
      return item;
    }));
    setIsLibraryModalOpen(false);
    setActiveItemIndex(null);
  };

  const matchFromLibrary = (base64: string, itemIndex: number) => {
    const match = libraryProducts.find(p => p.image === base64);
    if (match) {
      setItems(prev => prev.map((item, idx) => {
        if (idx === itemIndex) {
          return {
            ...item,
            desc: match.desc,
            subItems: match.variants.map((v, vIdx) => ({
              id: Date.now() + vIdx,
              itemName: v.itemName,
              sizeW: v.sizeW,
              sizeD: v.sizeD,
              sizeH: v.sizeH,
              qty: 1,
              vol: v.vol,
              price: v.price
            }))
          };
        }
        return item;
      }));
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    const path = `quotations/${id}`;
    try {
      await deleteDoc(doc(db, 'quotations', id));
      setShowDeleteModal(false);
      navigate('/quotations');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const [items, setItems] = useState<ProductItem[]>([
    { 
      id: 1, image: '', desc: 'Solid Wood Frame + High Density Sponge + Velvet/Fabric/Leather', 
      subItems: [{ id: 11, itemName: '', sizeW: 0, sizeD: 0, sizeH: 0, qty: 2, vol: 1.5, price: 850 }] 
    },
    { 
      id: 2, image: '', desc: 'Solid Oak Dining Table', 
      subItems: [{ id: 21, itemName: '', sizeW: 0, sizeD: 0, sizeH: 0, qty: 1, vol: 0.8, price: 600 }] 
    },
  ]);

  const [seaFreight, setSeaFreight] = useState<string>('450');
  const [seaFreightNote, setSeaFreightNote] = useState<string>('');
  const [footerNote, setFooterNote] = useState<string>('');
  
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    tel: '',
    address: ''
  });

  const [quoteDate, setQuoteDate] = useState('');
  const [quoteRef, setQuoteRef] = useState('');
  const [displaySettings, setDisplaySettings] = useState({
    showEmail: true,
    showTel: true,
    showAddress: true
  });

  useEffect(() => {
    if (id) {
      // Load existing quotation
      const loadQuotation = async () => {
        const path = `quotations/${id}`;
        try {
          const docRef = doc(db, 'quotations', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setItems(data.items || []);
            setCustomer(data.customer || { name: '', email: '', tel: '', address: '' });
            setSeaFreight(data.seaFreight || '0');
            setSeaFreightNote(data.seaFreightNote || '');
            setFooterNote(data.footerNote || '');
            setQuoteDate(data.quoteDate || '');
            setQuoteRef(data.quoteRef || '');
            setDisplaySettings(data.displaySettings || { showEmail: true, showTel: true, showAddress: true });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      };
      loadQuotation();
    } else {
      // New quotation
      const today = new Date();
      const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(today);
      setQuoteDate(formattedDate);

      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateString = `${yyyy}${mm}${dd}`;

      const storageKey = `quote_seq_${dateString}`;
      const currentSeq = parseInt(localStorage.getItem(storageKey) || '1', 10);

      setQuoteRef(`JF${dateString}${currentSeq}`);
    }
  }, [id]);

  const handleExportPDF = async () => {
    if (!quotationRef.current) return;
    
    setIsExportingPDF(true);
    try {
      // Small delay to ensure any pending renders are complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(quotationRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        width: 1024,
      });
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const fileName = `${customer.name || 'Customer'}-${quoteRef || 'Draft'}`;
      pdf.save(`${fileName}.pdf`);

      if (!id) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dateString = `${yyyy}${mm}${dd}`;
        
        const storageKey = `quote_seq_${dateString}`;
        const currentSeq = parseInt(localStorage.getItem(storageKey) || '1', 10);
        const nextSeq = currentSeq + 1;
        localStorage.setItem(storageKey, nextSeq.toString());
        
        setQuoteRef(`JF${dateString}${nextSeq}`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportImage = async () => {
    if (!quotationRef.current) return;
    
    setIsExporting(true);
    try {
      // Small delay to ensure any pending renders are complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(quotationRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        // Ensure we capture the full width/height
        width: 1024,
      });
      
      const link = document.createElement('a');
      const fileName = `${customer.name || 'Customer'}-${quoteRef || 'Draft'}`;
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Failed to export image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const subtotal = items.reduce((sum, product) => sum + product.subItems.reduce((subSum, sub) => subSum + (sub.qty * sub.price), 0), 0);
  const totalVolume = items.reduce((sum, product) => sum + product.subItems.reduce((subSum, sub) => {
    const vol = (sub.sizeW * sub.sizeD * sub.sizeH * sub.qty) / 1000000;
    return subSum + vol;
  }, 0), 0);
  const grandTotal = subtotal + (Number(seaFreight) || 0);

  const handleSave = async () => {
    if (!auth.currentUser) {
      alert("Please log in to save.");
      return;
    }
    
    if (!customer.name) {
      alert("Please enter a customer name.");
      return;
    }

    setIsSaving(true);
    try {
      // Compress all images in items before saving
      const compressedItems = await Promise.all(items.map(async (item) => ({
        ...item,
        image: await compressBase64Image(item.image)
      })));

      const quotationData = {
        quoteRef,
        quoteDate,
        customer,
        displaySettings,
        items: compressedItems,
        seaFreight,
        seaFreightNote,
        footerNote,
        subtotal,
        totalVolume,
        grandTotal,
        userId: auth.currentUser.uid,
        updatedAt: Date.now()
      };

      let quoteId = id;

      if (id) {
        const path = `quotations/${id}`;
        try {
          await setDoc(doc(db, 'quotations', id), quotationData, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      } else {
        const path = 'quotations';
        try {
          const newDoc = await addDoc(collection(db, 'quotations'), {
            ...quotationData,
            createdAt: Date.now()
          });
          quoteId = newDoc.id;
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      }

      // Update Customer Profile
      const customerId = `${auth.currentUser.uid}-${customer.name.toLowerCase().replace(/\s+/g, '-')}`;
      const customerPath = `customers/${customerId}`;
      const customerRef = doc(db, 'customers', customerId);
      let customerSnap;
      try {
        customerSnap = await getDoc(customerRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, customerPath);
      }
      
      // Extract unique product groups (descriptions) and images
      const productGroups = Array.from(new Set(items.map(i => i.desc).filter(Boolean)));
      const productImages = Array.from(new Set(items.map(i => i.image).filter(Boolean)));

      if (customerSnap.exists()) {
        const existingData = customerSnap.data();
        const updatedGroups = Array.from(new Set([...(existingData.productGroups || []), ...productGroups]));
        const updatedImages = Array.from(new Set([...(existingData.productImages || []), ...productImages]));
        try {
          await setDoc(customerRef, {
            ...customer,
            userId: auth.currentUser.uid,
            latestQuoteRef: quoteRef,
            latestQuoteDate: quoteDate,
            productGroups: updatedGroups,
            productImages: updatedImages,
            updatedAt: Date.now()
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, customerPath);
        }
      } else {
        try {
          await setDoc(customerRef, {
            ...customer,
            userId: auth.currentUser.uid,
            latestQuoteRef: quoteRef,
            latestQuoteDate: quoteDate,
            productGroups,
            productImages,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, customerPath);
        }
      }

      // Update Product Library (Grouped by image hash to prevent duplicates)
      for (const product of compressedItems) {
        if (product.desc && product.image) {
          const imageHash = hashString(product.image);
          const productKey = `${auth.currentUser.uid}-${imageHash}`;
          const productPath = `products/${productKey}`;
          const productRef = doc(db, 'products', productKey);
          
          const variants = product.subItems.map(subItem => ({
            id: subItem.id.toString(),
            itemName: subItem.itemName || '',
            sizeW: subItem.sizeW || 0,
            sizeD: subItem.sizeD || 0,
            sizeH: subItem.sizeH || 0,
            price: subItem.price || 0,
            vol: ((subItem.sizeW * subItem.sizeD * subItem.sizeH) / 1000000) || 0,
          }));

          try {
            // Check if product already exists to avoid updating it from quotation
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) {
              await setDoc(productRef, {
                image: product.image || '',
                desc: product.desc || '',
                variants: variants,
                userId: auth.currentUser.uid,
                latestQuoteRef: quoteRef,
                updatedAt: Date.now(),
                createdAt: Date.now()
              });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, productPath);
          }
        }
      }

      alert("Quotation saved successfully!");
      if (!id) {
        navigate(`/quotations/${quoteId}`);
      }
    } catch (error) {
      console.error("Error saving quotation:", error);
      if (!(error instanceof Error && error.message.startsWith('{'))) {
        alert("Failed to save quotation.");
      } else {
        throw error; // Let ErrorBoundary handle it
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateProduct = (id: number, field: string, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const updateSubItem = (productId: number, subItemId: number, field: string, value: string | number) => {
    setItems(items.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          subItems: p.subItems.map(s => {
            if (s.id === subItemId) {
              const updated = { ...s, [field]: value };
              // Recalculate volume if sizes or qty change
              if (['sizeW', 'sizeD', 'sizeH', 'qty'].includes(field)) {
                updated.vol = (updated.sizeW * updated.sizeD * updated.sizeH * updated.qty) / 1000000;
              }
              return updated;
            }
            return s;
          })
        };
      }
      return p;
    }));
  };

  const handleImageUpload = (id: number, e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressedDataUrl = await compressBase64Image(reader.result as string);
        
        // Check if this image is already in the current quotation
        const isDuplicateInQuotation = items.some((item, idx) => item.image === compressedDataUrl && idx !== index);
        if (isDuplicateInQuotation) {
          alert("This product is already in the quotation. Please update the quantity of the existing item instead.");
          // Reset the file input
          e.target.value = '';
          return;
        }

        updateProduct(id, 'image', compressedDataUrl);
        matchFromLibrary(compressedDataUrl, index);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProduct = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const removeSubItem = (productId: number, subItemId: number) => {
    setItems(items.map(p => {
      if (p.id === productId) {
        return { ...p, subItems: p.subItems.filter(s => s.id !== subItemId) };
      }
      return p;
    }).filter(p => p.subItems.length > 0));
  };

  const addProduct = () => {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id: newId, image: '', desc: '', subItems: [{ id: Date.now(), itemName: '', sizeW: 0, sizeD: 0, sizeH: 0, qty: 1, vol: 0, price: 0 }] }]);
  };

  const addSubItem = (productId: number) => {
    setItems(items.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          subItems: [...p.subItems, { id: Date.now(), itemName: '', sizeW: 0, sizeD: 0, sizeH: 0, qty: 1, vol: 0, price: 0 }]
        };
      }
      return p;
    }));
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body antialiased flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 sm:px-10 py-4 bg-surface-container-lowest/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,42,88,0.04)] print:hidden">
        <div className="flex items-center gap-4 text-on-surface">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="p-2 rounded-full hover:bg-surface-container-low transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-headline font-bold tracking-tight">Quotation Preview</h2>
        </div>
        <div className="flex items-center gap-4">
          {id && (
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="h-10 px-4 rounded-md text-error hover:bg-error-container/50 transition-colors flex items-center gap-2 font-medium"
            >
              <Trash2 size={18} />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-6 rounded-md bg-secondary-container text-on-secondary-container text-sm font-label font-bold tracking-wide shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={handleExportImage}
            disabled={isExporting}
            className="h-10 px-6 rounded-md bg-surface-container text-on-surface text-sm font-label font-bold tracking-wide shadow-sm hover:bg-surface-container-low transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            {isExporting ? 'Exporting...' : 'Export Image'}
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="h-10 px-6 rounded-md bg-gradient-to-br from-primary to-primary-container text-on-primary text-sm font-label font-bold tracking-wide shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {isExportingPDF ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center py-10 px-4 sm:px-8">
        <div 
          ref={quotationRef}
          className="w-full max-w-[1024px] bg-surface-container-lowest shadow-[0_4px_24px_rgba(0,42,88,0.04)] p-6 sm:p-12 flex flex-col gap-6 print-scale"
        >
          {/* Print Header Spacer */}
          <div className="hidden print:block h-16 w-full"></div>
          
          {/* Company Info */}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <h1 className="text-primary text-2xl sm:text-3xl font-headline font-bold tracking-tight mb-1">Shenzhen Janus Furniture Co., Ltd</h1>
                <p className="text-on-surface-variant font-label uppercase tracking-widest mt-2 font-bold text-lg">Quotation</p>
              </div>
              <div className="text-left sm:text-right flex flex-col gap-1 text-on-surface-variant text-sm">
                <p>Date: <span className="text-on-surface font-medium">{quoteDate}</span></p>
                <p>Quote Ref: <span className="text-on-surface font-medium">{quoteRef}</span></p>
              </div>
            </div>

            <div className="bg-surface-container-low p-6 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[200px_180px_150px_1fr] print:grid-cols-[200px_180px_150px_1fr] gap-x-12 gap-y-6">
              <div className="flex flex-col gap-1">
                <span className="text-on-surface-variant text-xs font-label tracking-wider">Website</span>
                <span className="text-on-surface text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">https://szjanus.en.alibaba.com</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-on-surface-variant text-xs font-label tracking-wider">Email</span>
                <span className="text-on-surface text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">info@janusfurniture.com</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-on-surface-variant text-xs font-label tracking-wider">Tel</span>
                <span className="text-on-surface text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">+86 17608467876</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-on-surface-variant text-xs font-label tracking-wider">Address</span>
                <span className="text-on-surface text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">Guangdong, China, 518100</span>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-primary-container pb-1">
              <h3 className="text-on-surface text-lg font-headline font-semibold max-w-max">
                Customer Information
              </h3>
              <div className={`flex flex-wrap items-center gap-4 px-2 py-1 bg-surface-container-low rounded-md print:hidden ${(isExporting || isExportingPDF) ? 'hidden' : ''}`}>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Display:</span>
                {[
                  { label: 'Email', key: 'showEmail' },
                  { label: 'Tel', key: 'showTel' },
                  { label: 'Address', key: 'showAddress' },
                ].map((toggle) => (
                  <label key={toggle.key} className="flex items-center gap-2 cursor-pointer group/toggle">
                    <input 
                      type="checkbox" 
                      checked={displaySettings[toggle.key as keyof typeof displaySettings]}
                      onChange={(e) => setDisplaySettings({...displaySettings, [toggle.key]: e.target.checked})}
                      className="w-3.5 h-3.5 rounded border-outline-variant text-primary focus:ring-primary/20 cursor-pointer"
                    />
                    <span className="text-xs text-on-surface-variant group-hover/toggle:text-primary transition-colors font-medium">{toggle.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="bg-surface-container-low p-6 rounded-lg flex flex-wrap gap-x-12 gap-y-6">
              {[
                { label: 'Name', key: 'name', type: 'text', placeholder: 'Enter name', width: 'w-[200px]' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'Enter email', showKey: 'showEmail', width: 'w-[180px]' },
                { label: 'Tel', key: 'tel', type: 'tel', placeholder: 'Enter phone number', showKey: 'showTel', width: 'w-[150px]' },
                { label: 'Address', key: 'address', type: 'text', placeholder: 'Enter address', showKey: 'showAddress', width: 'flex-1 min-w-[200px]' },
              ].map((field) => {
                const isVisible = !field.showKey || displaySettings[field.showKey as keyof typeof displaySettings];
                
                if (!isVisible) return null;

                return (
                  <div 
                    key={field.key} 
                    className={`flex flex-col gap-1 transition-all duration-300 ${field.width}`}
                  >
                    <span className="text-on-surface-variant text-xs font-label tracking-wider">{field.label}</span>
                    <AutoInput
                      type={field.type}
                      placeholder={field.placeholder}
                      value={customer[field.key as keyof typeof customer] || ''}
                      onChange={(e) => setCustomer({...customer, [field.key]: e.target.value})}
                      className="text-sm font-medium text-on-surface"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Product Table */}
          <div className="flex flex-col w-full overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-[100px_1fr_100px_40px_40px_40px_45px_55px_110px_110px_40px] print-grid gap-1 bg-secondary-container text-on-secondary-container px-2 py-3 text-xs font-label tracking-wider font-semibold text-center rounded-t-md">
                <div>Image</div>
                <div>Description</div>
                <div>Item</div>
                <div className="col-span-3">Size(W*D*H)</div>
                <div>Qty</div>
                <div>Volume</div>
                <div className="whitespace-nowrap text-center">Unit Price</div>
                <div className="whitespace-nowrap text-center">Total Price</div>
                <div className={`print:hidden ${(isExporting || isExportingPDF) ? 'hidden' : ''}`}></div>
              </div>

              <div className="flex flex-col text-xs font-body">
                {items.map((product) => (
                  <div key={product.id} className="flex border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors group min-h-[120px] px-2 py-2 gap-2 relative">
                    
                    <div className="w-[100px] shrink-0 flex flex-col items-center justify-center gap-2">
                      <div className="w-20 h-20 bg-secondary-container rounded flex items-center justify-center cursor-pointer hover:bg-primary-container transition-colors relative overflow-hidden group/upload">
                        {product.image ? (
                          <img src={product.image} alt="Product" className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon className="text-primary group-hover/upload:text-on-primary w-8 h-8" />
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleImageUpload(product.id, e, items.indexOf(product))}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Upload Image"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveItemIndex(items.indexOf(product));
                            setIsLibraryModalOpen(true);
                          }}
                          className="absolute bottom-0 right-0 p-1 bg-primary text-on-primary rounded-tl-md opacity-0 group-hover/upload:opacity-100 transition-opacity z-10"
                          title="Pick from Library"
                        >
                          <Library size={12} />
                        </button>
                      </div>
                      <button 
                        onClick={() => addSubItem(product.id)}
                        className={`text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 print:hidden opacity-0 group-hover:opacity-100 transition-opacity ${(isExporting || isExportingPDF) ? '!hidden' : ''}`}
                      >
                        <PlusCircle className="w-3 h-3" /> Add Variant
                      </button>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center">
                      <AutoTextarea 
                        value={product.desc} 
                        onChange={(e) => updateProduct(product.id, 'desc', e.target.value)}
                        placeholder="Enter description"
                        className="text-xs font-medium text-center w-full"
                      />
                    </div>

                    <div className="flex flex-col justify-center gap-2 shrink-0">
                      {product.subItems.map((subItem) => (
                        <div key={subItem.id} className="grid grid-cols-[100px_40px_40px_40px_45px_55px_110px_110px_40px] print-grid-subitem gap-1 items-center text-center group/sub">
                          
                          <div className="text-on-surface text-center">
                            <AutoTextarea 
                              value={subItem.itemName || ''} 
                              onChange={(e) => updateSubItem(product.id, subItem.id, 'itemName', e.target.value)}
                              placeholder="Enter item"
                              className="text-xs text-center"
                            />
                          </div>

                          <div className="flex justify-center">
                            <input 
                              type="number" 
                              value={subItem.sizeW || ''} 
                              onChange={(e) => updateSubItem(product.id, subItem.id, 'sizeW', parseFloat(e.target.value) || 0)}
                              className="bg-transparent border-b-2 border-transparent focus:border-primary outline-none w-full text-center p-0 text-on-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="W"
                            />
                          </div>
                          <div className="flex justify-center">
                            <input 
                              type="number" 
                              value={subItem.sizeD || ''} 
                              onChange={(e) => updateSubItem(product.id, subItem.id, 'sizeD', parseFloat(e.target.value) || 0)}
                              className="bg-transparent border-b-2 border-transparent focus:border-primary outline-none w-full text-center p-0 text-on-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="D"
                            />
                          </div>
                          <div className="flex justify-center">
                            <input 
                              type="number" 
                              value={subItem.sizeH || ''} 
                              onChange={(e) => updateSubItem(product.id, subItem.id, 'sizeH', parseFloat(e.target.value) || 0)}
                              className="bg-transparent border-b-2 border-transparent focus:border-primary outline-none w-full text-center p-0 text-on-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="H"
                            />
                          </div>

                          <div className="flex justify-center">
                            <input 
                              type="number" 
                              value={subItem.qty || ''} 
                              onChange={(e) => updateSubItem(product.id, subItem.id, 'qty', parseInt(e.target.value) || 0)}
                              className="bg-transparent border-b-2 border-transparent focus:border-primary outline-none w-full text-center p-0 text-on-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="flex justify-center items-center">
                            <span className="text-on-surface">
                              {((subItem.sizeW * subItem.sizeD * subItem.sizeH * subItem.qty) / 1000000).toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-center gap-0">
                            <div className="flex items-center gap-0">
                              <span className="text-on-surface">$</span>
                              {(isExporting || isExportingPDF) ? (
                                <span className="text-on-surface">{subItem.price || '0'}</span>
                              ) : (
                                <input 
                                  type="number" 
                                  value={subItem.price || ''} 
                                  onChange={(e) => updateSubItem(product.id, subItem.id, 'price', parseFloat(e.target.value) || 0)}
                                  style={{ width: `${Math.max(1, String(subItem.price || '').length) + 0.5}ch` }}
                                  className="bg-transparent border-b-2 border-transparent focus:border-primary outline-none text-left p-0 text-on-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-[1ch]"
                                  placeholder="0"
                                />
                              )}
                            </div>
                          </div>

                          <div className="text-on-surface whitespace-nowrap flex items-center justify-center gap-0">
                            <span>$</span>
                            <span>{formatNumber(subItem.qty * subItem.price)}</span>
                          </div>

                          <div className={`print:hidden ${(isExporting || isExportingPDF) ? 'hidden' : ''}`}>
                            <button 
                              onClick={() => removeSubItem(product.id, subItem.id)}
                              className="text-outline hover:text-error transition-colors p-1 rounded-full hover:bg-error-container/50 opacity-0 group-hover/sub:opacity-100 focus:opacity-100"
                              title="Remove Variant"
                            >
                              <X size={18} />
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-4 print:hidden ${(isExporting || isExportingPDF) ? 'hidden' : ''}`}>
              <button 
                onClick={addProduct}
                className="flex items-center gap-2 text-primary font-label font-bold text-sm hover:bg-primary-container/10 transition-colors py-2 px-3 rounded-md -ml-3"
              >
                <PlusCircle size={18} />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          <div className="mt-0 mb-2 px-4 flex flex-col justify-end min-h-[40px] relative">
            {/* Div for display and export capture */}
            <div className="whitespace-pre-wrap text-center text-sm leading-[1.1] py-0 min-h-[1.1em] break-words text-on-surface-variant">
              {footerNote || ' '}
            </div>
            {/* Textarea for editing */}
            <textarea 
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              placeholder="Add a note here..."
              className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-center text-sm text-on-surface-variant py-0 transition-colors placeholder:text-on-surface-variant/20 resize-none leading-[1.1] overflow-hidden opacity-0 focus:opacity-100 focus:z-10"
            />
          </div>

          <div className="flex justify-end pt-6 border-t border-outline-variant/30">
            <div className="w-fit min-w-[420px] flex flex-col gap-3">
              <div className="flex justify-between font-body text-on-surface-variant text-sm gap-8">
                <span>Subtotal (EXW)</span>
                <div className="flex items-center justify-end gap-0 font-medium text-on-surface min-w-[120px]">
                  <span>$</span>
                  <span>{formatNumber(subtotal)}</span>
                </div>
              </div>
              <div className="flex justify-between font-body text-on-surface-variant text-sm gap-8">
                <span>Total Volume</span>
                <div className="flex items-center justify-end gap-1 font-medium text-on-surface min-w-[120px]">
                  <span>{totalVolume.toFixed(2)}</span>
                  <span className="text-on-surface-variant text-xs ml-1">CBM</span>
                </div>
              </div>
              <div className="flex justify-between items-center font-body text-on-surface-variant text-sm gap-8">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="whitespace-nowrap">Sea Freight</span>
                  <AutoInput
                    placeholder="(Manual Entry)" 
                    value={seaFreightNote}
                    onChange={(e) => setSeaFreightNote(e.target.value)}
                    className="w-32 text-sm text-on-surface-variant"
                  />
                </div>
                <div className="flex items-center justify-end gap-0 shrink-0 min-w-[120px]">
                  <div className="flex items-center gap-0">
                    <span className="text-on-surface">$</span>
                    {(isExporting || isExportingPDF) ? (
                      <span className="font-medium text-on-surface">{seaFreight || '0'}</span>
                    ) : (
                      <input 
                        type="number" 
                        value={seaFreight}
                        onChange={(e) => setSeaFreight(e.target.value)}
                        style={{ width: `${Math.max(1, String(seaFreight || '').length) + 0.5}ch` }}
                        className="bg-transparent border-b-2 border-transparent focus:border-primary outline-none text-left p-0 font-medium text-on-surface transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-[1ch]"
                        placeholder="0"
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-between font-headline font-bold text-primary mt-3 pt-3 border-t-2 border-primary-container text-lg gap-8">
                <span>Grand Total</span>
                <div className="flex items-center justify-end gap-0 min-w-[120px]">
                  <span>$</span>
                  <span>{formatNumber(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-lg flex flex-col gap-4">
            <h4 className="text-on-surface text-sm font-headline font-semibold uppercase tracking-wider">Terms & Conditions</h4>
            <ul className="list-disc list-inside text-sm font-body text-on-surface-variant space-y-2 capitalize">
              <li><strong className="text-on-surface font-medium">Packing:</strong> Standard export carton packing.</li>
              <li><strong className="text-on-surface font-medium">Delivery Time:</strong> 20-35 days after receipt of deposit.</li>
              <li><strong className="text-on-surface font-medium">Payment Term:</strong> 50% T/T deposit in advance, 50% balance before shipment.</li>
              <li><strong className="text-on-surface font-medium">PI Valid Time:</strong> 30 days from the date of issue.</li>
            </ul>
          </div>

        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
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
                <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Delete Quotation?</h3>
                <p className="text-on-surface-variant">This action cannot be undone. All data for this quotation will be permanently removed.</p>
              </div>
              <div className="flex w-full gap-3">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 h-12 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 h-12 rounded-xl bg-error text-on-error font-bold shadow-lg shadow-error/20 hover:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Library Picker Modal */}
      <AnimatePresence>
        {isLibraryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLibraryModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-surface-container-lowest w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <Library className="text-primary" size={24} />
                  <h2 className="text-xl font-headline font-bold text-primary">Product Library</h2>
                </div>
                <div className="flex items-center gap-4 flex-1 max-w-md mx-8">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-surface-container-low pl-10 pr-4 py-2 rounded-full outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary transition-all text-sm"
                    />
                  </div>
                </div>
                <button onClick={() => setIsLibraryModalOpen(false)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {libraryProducts
                  .filter(p => p.desc.toLowerCase().includes(searchQuery.toLowerCase()) || p.productCode?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((product) => (
                    <div 
                      key={product.id} 
                      onClick={() => selectFromLibrary(product)}
                      className="bg-surface-container-low rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                    >
                      <div className="h-32 bg-surface-container-high relative">
                        {product.image ? (
                          <img src={product.image} alt={product.desc} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-on-surface-variant/30">
                            <ImageIcon size={32} />
                          </div>
                        )}
                        {product.productCode && (
                          <div className="absolute top-1 left-1 bg-primary/90 text-on-primary text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm uppercase">
                            {product.productCode}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-bold text-on-surface line-clamp-2 mb-1">{product.desc}</p>
                        <p className="text-[10px] text-on-surface-variant">{product.variants.length} variants</p>
                      </div>
                    </div>
                  ))}
                {libraryProducts.length === 0 && (
                  <div className="col-span-full py-12 text-center text-on-surface-variant">
                    Your product library is empty.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

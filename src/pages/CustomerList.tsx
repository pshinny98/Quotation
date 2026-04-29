import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Customer, Quotation } from '../types';
import { Link } from 'react-router-dom';
import { Users, FileText, Plus, Edit2, Trash2, X, Mail, Phone, MapPin, Camera, User, Globe, Linkedin, Facebook, MessageCircle, Flag, Filter, Calendar, Search, ShoppingBag, Copy, Check, Send } from 'lucide-react';

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    email2: '',
    tel: '',
    address: '',
    avatar: '',
    country: '',
    linkedin: '',
    facebook: '',
    whatsapp: '',
    alibaba: '',
    website: '',
    notes: ''
  });
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    if (copiedText) {
      const timer = setTimeout(() => setCopiedText(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedText]);

  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        companyName: customer.companyName || '',
        email: customer.email,
        email2: customer.email2 || '',
        tel: customer.tel,
        address: customer.address,
        avatar: customer.avatar || '',
        country: customer.country || '',
        linkedin: customer.linkedin || '',
        facebook: customer.facebook || '',
        whatsapp: customer.whatsapp || '',
        alibaba: customer.alibaba || '',
        website: customer.website || '',
        notes: customer.notes || ''
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        companyName: '',
        email: '',
        email2: '',
        tel: '',
        address: '',
        avatar: '',
        country: '',
        linkedin: '',
        facebook: '',
        whatsapp: '',
        alibaba: '',
        website: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData(prev => ({ ...prev, avatar: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      if (editingCustomer) {
        const customerRef = doc(db, 'customers', editingCustomer.id!);
        await updateDoc(customerRef, {
          ...formData,
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...formData,
          userId: auth.currentUser.uid,
          productGroups: [],
          productImages: [],
          latestQuoteRef: '',
          latestQuoteDate: '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      handleCloseModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'customers');
    }
  };

  // Extract unique countries and months for filters
  const countries: string[] = Array.from(new Set<string>(customers.map(c => c.country).filter(Boolean) as string[])).sort();
  const months: string[] = Array.from(new Set<string>(customers.map(c => {
    const date = new Date(c.updatedAt);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }))).sort().reverse();

  const formatMonth = (monthStr: string) => {
    if (monthStr === 'All') return 'All Months';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const countryMatch = selectedCountry === 'All' || customer.country === selectedCountry;
    
    const date = new Date(customer.updatedAt);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthMatch = selectedMonth === 'All' || monthStr === selectedMonth;
    
    const searchMatch = searchQuery === '' || 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.companyName && customer.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (customer.email2 && customer.email2.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (customer.tel && customer.tel.includes(searchQuery));

    return countryMatch && monthMatch && searchMatch;
  });

  // Group filtered customers by name
  const groupedCustomers = filteredCustomers.reduce((acc: { [key: string]: Customer[] }, customer) => {
    const name = customer.name.toLowerCase();
    if (!acc[name]) acc[name] = [];
    acc[name].push(customer);
    return acc;
  }, {});

  if (loading) {
    return <div className="p-8 text-on-surface-variant">Loading customers...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="text-primary" size={28} />
          <h1 className="text-2xl font-headline font-bold text-primary">Customer Directory</h1>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Add Customer
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-container-low p-4 rounded-xl mb-8 flex flex-wrap items-center gap-4 shadow-sm border border-outline-variant/30">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            type="text"
            placeholder="Search name, email or tel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest rounded-lg outline-none border border-transparent focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/30">
          <Filter size={16} className="text-primary" />
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-transparent outline-none text-sm font-medium text-on-surface cursor-pointer"
          >
            <option value="All">All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/30">
          <Calendar size={16} className="text-primary" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent outline-none text-sm font-medium text-on-surface cursor-pointer"
          >
            <option value="All">All Months</option>
            {months.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>

        {(selectedCountry !== 'All' || selectedMonth !== 'All' || searchQuery !== '') && (
          <button
            onClick={() => {
              setSelectedCountry('All');
              setSelectedMonth('All');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-primary hover:underline uppercase tracking-wider px-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.keys(groupedCustomers).length === 0 ? (
          <div className="col-span-full bg-surface-container-lowest p-8 rounded-lg text-center text-on-surface-variant shadow-sm">
            No customers found. Save a quotation or add a customer manually.
          </div>
        ) : (
          (Object.values(groupedCustomers) as Customer[][]).map((customerGroup) => {
            const customer = customerGroup[0];
            const customerQuotes = quotations
              .filter(q => q.customer.name.toLowerCase() === customer.name.toLowerCase())
              .sort((a, b) => b.createdAt - a.createdAt);

            const quoteImages = customerQuotes.flatMap(q => q.items.map(i => i.image)).filter(Boolean);
            const allProductImages = Array.from(new Set([
              ...customerGroup.flatMap(c => c.productImages || []),
              ...quoteImages
            ])).slice(0, 4); // Limit to 4 images in small view

            return (
              <div key={customer.id} className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 flex flex-col hover:shadow-md transition-shadow">
                {/* Compact Header */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container-high border border-primary/20 flex-shrink-0">
                        {customer.avatar ? (
                          <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary/30">
                            <User size={24} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-headline font-bold text-on-surface leading-none truncate" title={customer.name}>{customer.name}</h2>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          {customer.companyName && (
                            <p className="text-xs font-semibold text-primary truncate" title={customer.companyName}>{customer.companyName}</p>
                          )}
                          {customer.country && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">
                              <Flag size={10} className="text-primary" />
                              {customer.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenModal(customer)}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id!)}
                        className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-full transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Quick Contacts */}
                  <div className="space-y-1.5 border-b border-outline-variant/10 pb-3">
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant group/email">
                      <Mail size={12} className="flex-shrink-0 text-primary" />
                      <a href={`mailto:${customer.email}`} className="hover:text-primary transition-colors truncate font-medium">
                        {customer.email || 'No email'}
                      </a>
                      <div className="ml-auto flex items-center gap-1">
                        {customer.email && (
                          <>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(customer.email);
                                setCopiedText(customer.email);
                              }}
                              className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary"
                              title="Copy Email"
                            >
                              {copiedText === customer.email ? <Check size={10} className="text-success" /> : <Copy size={10} className="opacity-0 group-hover/email:opacity-100" />}
                            </button>
                            <a 
                              href={`mailto:${customer.email}`}
                              className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary"
                              title="Open in Local Mail Client (Zoho Desktop)"
                            >
                              <Send size={10} className="opacity-0 group-hover/email:opacity-100" />
                            </a>
                            <button 
                              onClick={() => window.open(`https://mail.zoho.com/zm/#mail/compose/${customer.email}`, '_blank')}
                              className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary"
                              title="Compose in Zoho Mail (Web)"
                            >
                              <span className="text-[8px] font-bold opacity-0 group-hover/email:opacity-100">Zoho</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {customer.email2 && (
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant group/email2">
                        <Mail size={12} className="flex-shrink-0 text-primary opacity-60" />
                        <a href={`mailto:${customer.email2}`} className="hover:text-primary transition-colors truncate italic">
                          {customer.email2}
                        </a>
                        <div className="ml-auto flex items-center gap-1">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(customer.email2!);
                              setCopiedText(customer.email2!);
                            }}
                            className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary"
                            title="Copy Secondary Email"
                          >
                            {copiedText === customer.email2 ? <Check size={10} className="text-success" /> : <Copy size={10} className="opacity-0 group-hover/email2:opacity-100" />}
                          </button>
                          <a 
                            href={`mailto:${customer.email2}`}
                            className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary"
                            title="Open in Local Mail Client"
                          >
                            <Send size={10} className="opacity-0 group-hover/email2:opacity-100" />
                          </a>
                          <button 
                            onClick={() => window.open(`https://mail.zoho.com/zm/#mail/compose/${customer.email2}`, '_blank')}
                            className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary"
                            title="Compose in Zoho Mail (Web)"
                          >
                            <span className="text-[8px] font-bold opacity-0 group-hover/email2:opacity-100">Zoho</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {customer.tel && (
                      <div className="flex items-center gap-2 text-xs text-on-surface font-medium">
                        <Phone size={12} className="flex-shrink-0 text-primary" />
                        <span>{customer.tel}</span>
                      </div>
                    )}
                  </div>

                  {/* Social/Web Links */}
                  <div className="flex flex-wrap gap-2 py-1 border-b border-outline-variant/10">
                    {customer.website && (
                      <a href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-surface-container-low rounded-md hover:text-primary hover:bg-primary/5 transition-all" title="Website">
                        <Globe size={14} />
                      </a>
                    )}
                    {customer.linkedin && (
                      <a href={customer.linkedin.startsWith('http') ? customer.linkedin : `https://${customer.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-surface-container-low rounded-md hover:text-primary hover:bg-primary/5 transition-all" title="LinkedIn">
                        <Linkedin size={14} />
                      </a>
                    )}
                    {customer.facebook && (
                      <a href={customer.facebook.startsWith('http') ? customer.facebook : `https://${customer.facebook}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-surface-container-low rounded-md hover:text-primary hover:bg-primary/5 transition-all" title="Facebook">
                        <Facebook size={14} />
                      </a>
                    )}
                    {customer.whatsapp && (
                      <a href={`https://wa.me/${customer.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-surface-container-low rounded-md hover:text-primary hover:bg-primary/5 transition-all" title="WhatsApp">
                        <MessageCircle size={14} />
                      </a>
                    )}
                    {customer.alibaba && (
                      <a href={customer.alibaba.startsWith('http') ? customer.alibaba : `https://${customer.alibaba}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-surface-container-low rounded-md hover:text-primary hover:bg-primary/5 transition-all" title="Alibaba">
                        <ShoppingBag size={14} />
                      </a>
                    )}
                  </div>

                  {/* Product Mini Gallery */}
                  {allProductImages.length > 0 && (
                    <div className="mt-1">
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Products</p>
                      <div className="flex gap-1.5 overflow-hidden">
                        {allProductImages.slice(0, 5).map((img, idx) => (
                          <div key={idx} className="w-12 h-12 rounded-lg border border-outline-variant/20 overflow-hidden flex-shrink-0 bg-white shadow-sm">
                            <img src={img} alt="" className="w-full h-full object-contain" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quotation Mini List */}
                <div className="bg-surface-container-low/40 p-3 mt-auto border-t border-outline-variant/30">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex justify-between">
                    <span>Recent Quotes</span>
                    <span className="text-primary">{customerQuotes.length} total</span>
                  </h3>
                  <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                    {customerQuotes.length > 0 ? (
                      customerQuotes.slice(0, 3).map(quote => (
                        <div key={quote.id} className="flex justify-between items-center text-[11px] bg-white/50 p-1.5 rounded border border-black/5 hover:border-primary/30 transition-colors">
                          <span className="font-medium text-primary">{quote.quoteRef}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-on-surface-variant font-mono">${Math.round(quote.grandTotal).toLocaleString()}</span>
                            <Link to={`/quotations/${quote.id}`} className="text-primary hover:underline font-bold px-1 py-0.5 bg-primary/5 rounded">View</Link>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-on-surface-variant italic py-1">No history yet</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
              <h2 className="text-xl font-headline font-bold text-primary">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="max-h-[70vh] overflow-y-auto p-6 flex flex-col gap-4">
                <div className="flex flex-col items-center mb-4">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-container-low border-2 border-dashed border-outline-variant group-hover:border-primary transition-colors flex items-center justify-center">
                      {formData.avatar ? (
                        <img src={formData.avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="text-on-surface-variant/30" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                      <Camera size={24} />
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-2 uppercase tracking-wider font-label">Click to upload avatar</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Customer Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Company Name</label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Email Address 1</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Email Address 2 (Backup)</label>
                    <input
                      type="email"
                      value={formData.email2}
                      onChange={(e) => setFormData({ ...formData, email2: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. j.doe@work.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. USA"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Telephone</label>
                    <input
                      type="tel"
                      value={formData.tel}
                      onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. +1 234 567 890"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Website</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. www.example.com"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Alibaba</label>
                    <input
                      type="text"
                      value={formData.alibaba}
                      onChange={(e) => setFormData({ ...formData, alibaba: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="Profile or Store URL"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">LinkedIn</label>
                    <input
                      type="text"
                      value={formData.linkedin}
                      onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="Profile URL"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Facebook</label>
                    <input
                      type="text"
                      value={formData.facebook}
                      onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="Profile URL"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">WhatsApp</label>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="Number or URL"
                    />
                  </div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all min-h-[80px]"
                    placeholder="e.g. 123 Main St, City, Country"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Notes / Remarks</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all min-h-[80px]"
                    placeholder="Add any internal notes about this customer..."
                  />
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
                    className="bg-primary text-on-primary px-8 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    {editingCustomer ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

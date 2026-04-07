import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Customer, Quotation } from '../types';
import { Link } from 'react-router-dom';
import { Users, FileText, Plus, Edit2, Trash2, X, Mail, Phone, MapPin, Camera, User, Globe, Linkedin, Facebook, MessageCircle, Flag, Filter, Calendar, Search, ShoppingBag } from 'lucide-react';

export default function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    tel: '',
    address: '',
    avatar: '',
    country: '',
    linkedin: '',
    facebook: '',
    whatsapp: '',
    website: ''
  });

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
        email: customer.email,
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
        email: '',
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
      (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
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

      <div className="grid gap-6">
        {Object.keys(groupedCustomers).length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-lg text-center text-on-surface-variant shadow-[0_4px_24px_rgba(0,42,88,0.04)]">
            No customers found. Save a quotation or add a customer manually.
          </div>
        ) : (
          (Object.values(groupedCustomers) as Customer[][]).map((customerGroup) => {
            // Use the first customer in the group as the primary display
            const customer = customerGroup[0];
            
            // Collect all quotations for all customers in this group (same name)
            const customerQuotes = quotations
              .filter(q => q.customer.name.toLowerCase() === customer.name.toLowerCase())
              .sort((a, b) => b.createdAt - a.createdAt);

            // Collect all product images from all customers in this group AND their quotations
            const quoteImages = customerQuotes.flatMap(q => q.items.map(i => i.image)).filter(Boolean);
            const allProductImages = Array.from(new Set([
              ...customerGroup.flatMap(c => c.productImages || []),
              ...quoteImages
            ]));

            return (
              <div key={customer.id} className="bg-surface-container-lowest rounded-lg shadow-[0_4px_24px_rgba(0,42,88,0.04)] overflow-hidden flex flex-col md:flex-row">
                {/* Customer Info */}
                <div className="p-6 md:w-1/3 bg-surface-container-low/30 border-r border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container-high border-2 border-primary/20 flex-shrink-0">
                        {customer.avatar ? (
                          <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary/30">
                            <User size={32} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-headline font-bold text-on-surface">{customer.name}</h2>
                        <p className="text-sm text-on-surface-variant mt-1 flex items-center gap-2">
                          <Mail size={14} />
                          {customer.email || 'No email'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenModal(customer)}
                        className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                        title="Edit Customer"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id!)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-full transition-colors"
                        title="Delete Customer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm flex flex-col gap-2">
                    {customer.country && (
                      <p className="flex items-center gap-2">
                        <Flag size={14} className="text-on-surface-variant" />
                        <strong className="text-on-surface font-medium">Country:</strong> {customer.country}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Phone size={14} className="text-on-surface-variant" />
                      <strong className="text-on-surface font-medium">Tel:</strong> {customer.tel || 'N/A'}
                    </p>
                    <p className="flex items-start gap-2">
                      <MapPin size={14} className="text-on-surface-variant mt-1" />
                      <span className="flex-1">
                        <strong className="text-on-surface font-medium">Address:</strong> {customer.address || 'N/A'}
                      </span>
                    </p>
                    {customer.notes && (
                      <div className="mt-2 p-2 bg-surface-container-lowest rounded border border-outline-variant/30 text-xs text-on-surface-variant italic">
                        <strong className="text-on-surface font-medium not-italic block mb-1">Notes:</strong>
                        {customer.notes}
                      </div>
                    )}
                    {customer.website && (
                      <p className="flex items-center gap-2">
                        <Globe size={14} className="text-on-surface-variant" />
                        <a href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                          {customer.website}
                        </a>
                      </p>
                    )}
                    <div className="flex gap-3 mt-1 items-center">
                      {customer.linkedin && (
                        <a href={customer.linkedin.startsWith('http') ? customer.linkedin : `https://${customer.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-primary transition-colors" title="LinkedIn">
                          <Linkedin size={18} />
                        </a>
                      )}
                      {customer.facebook && (
                        <a href={customer.facebook.startsWith('http') ? customer.facebook : `https://${customer.facebook}`} target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-primary transition-colors" title="Facebook">
                          <Facebook size={18} />
                        </a>
                      )}
                      {customer.whatsapp && (
                        <a href={`https://wa.me/${customer.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-primary transition-colors" title="WhatsApp">
                          <MessageCircle size={18} />
                        </a>
                      )}
                      {customer.alibaba && (
                        <a href={customer.alibaba.startsWith('http') ? customer.alibaba : `https://${customer.alibaba}`} target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-primary transition-colors" title="Alibaba">
                          <ShoppingBag size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    <strong className="text-sm text-on-surface font-medium block mb-3">Product Groups:</strong>
                    <div className="flex flex-wrap gap-2">
                      {allProductImages.length > 0 ? (
                        allProductImages.map((img, idx) => (
                          <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-high hover:border-primary transition-colors cursor-zoom-in group/img">
                            <img src={img} alt="" className="w-full h-full object-contain group-hover/img:scale-110 transition-transform duration-300" />
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-on-surface-variant italic">No images available</span>
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
                            <td colSpan={4} className="py-4 text-center text-on-surface-variant italic">No quotations found.</td>
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
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. USA"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. john@example.com"
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
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">WhatsApp</label>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="e.g. +1 234 567 890"
                    />
                  </div>
                  
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
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-wider">WhatsApp (Icon Link)</label>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="bg-surface-container-low px-4 py-2 rounded-lg outline-none border border-transparent focus:border-primary transition-all"
                      placeholder="Number or URL"
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

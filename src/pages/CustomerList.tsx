import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Customer, Quotation } from '../types';
import { Link } from 'react-router-dom';
import { Users, FileText, Plus, Edit2, Trash2, X, Mail, Phone, MapPin, Camera, User, Globe, Linkedin, Facebook, MessageCircle, Flag, Filter, Calendar, Search, ShoppingBag, Copy, Check, Send, Link2, FilePlus, FolderOpen, Package, Sparkles, Brain, Loader2 } from 'lucide-react';

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
    productLink: '',
    localPath: '',
    notes: ''
  });
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; code?: string; desc?: string } | null>(null);

  // Smart paste import states
  const [rawImportText, setRawImportText] = useState('');
  const [isParsingLocal, setIsParsingLocal] = useState(false);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);
  const [parseErrorMsg, setParseErrorMsg] = useState<string | null>(null);
  const [showSmartPaste, setShowSmartPaste] = useState(true);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

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
    // Reset paste states on opening the modal
    setRawImportText('');
    setParseSuccessMsg(null);
    setParseErrorMsg(null);

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
        productLink: customer.productLink || '',
        localPath: customer.localPath || '',
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
        productLink: '',
        localPath: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    // Clear paste states
    setRawImportText('');
    setParseSuccessMsg(null);
    setParseErrorMsg(null);
  };

  // Local Offline Smart Parser (Regular Expressions & Pattern Heuristics)
  const handleLocalParse = () => {
    if (!rawImportText.trim()) {
      setParseErrorMsg('请先在上方输入框复制粘贴客户原始文本信息。');
      return;
    }
    
    setIsParsingLocal(true);
    setParseErrorMsg(null);
    setParseSuccessMsg(null);

    try {
      const text = rawImportText;
      const result: any = {
        name: '',
        companyName: '',
        email: '',
        email2: '',
        tel: '',
        address: '',
        country: '',
        website: '',
        linkedin: '',
        facebook: '',
        whatsapp: '',
        alibaba: '',
        productLink: '',
        notes: ''
      };

      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

      // 1. Double check for typical email matches
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = text.match(emailRegex) || [];
      if (foundEmails.length > 0) {
        result.email = foundEmails[0].trim();
        if (foundEmails.length > 1) {
          result.email2 = foundEmails[1].trim();
        }
      }

      // 2. Extract telephone & whatsapp numbers
      const telRegex = /(?:\+|00)\d{1,4}[- ]?\d{3,4}[- ]?\d{4,12}|\b\d{3}[- ]?\d{3,4}[- ]?\d{4}\b/g;
      const foundTels = text.match(telRegex) || [];
      const validTels = foundTels.filter(t => t.replace(/[^0-9]/g, '').length >= 7);
      if (validTels.length > 0) {
        result.tel = validTels[0].trim();
        result.whatsapp = validTels[0].replace(/[^0-9+]/g, '');
      }

      // 3. Extract Links dynamically
      const urlRegex = /(https?:\/\/[^\s/$.?#].[^\s]*)/gi;
      const foundUrls = text.match(urlRegex) || [];
      foundUrls.forEach(url2 => {
        const url = url2.trim();
        const urlLower = url.toLowerCase();
        if (urlLower.includes('linkedin.com')) {
          result.linkedin = url;
        } else if (urlLower.includes('facebook.com') || urlLower.includes('fb.com')) {
          result.facebook = url;
        } else if (urlLower.includes('alibaba.com') || urlLower.includes('1688.com')) {
          result.alibaba = url;
        } else if (urlLower.includes('whatsapp.com') || urlLower.includes('wa.me')) {
          result.whatsapp = url;
        } else if (urlLower.includes('product') || urlLower.includes('item') || urlLower.includes('detail') || urlLower.includes('goods')) {
          result.productLink = url;
        } else if (!result.website && !urlLower.includes('mail')) {
          result.website = url;
        }
      });

      // Simple common countries list for offline dictionary-based matching
      const countriesList = [
        'usa', 'united states', 'america', '美国', '美',
        'uk', 'united kingdom', 'britain', '英国', '英',
        'germany', 'deutschland', '德国', '德',
        'france', '法国', '法',
        'spain', 'spanien', '西班牙',
        'italy', 'italia', '意大利',
        'canada', '加拿大',
        'australia', '澳大利亚', '澳洲',
        'japan', '日本',
        'korea', '韩国',
        'singapore', '新加坡',
        'india', '印度',
        'russia', '俄罗斯',
        'brazil', '巴西',
        'mexico', '墨西哥',
        'south africa', '南非',
        'vietnam', '越南',
        'thailand', '泰国',
        'malaysia', '马来西亚',
        'indonesia', '印尼', '印度尼西亚'
      ];

      // 4. Iterate lines to parse matching patterns
      for (const rawLine of lines) {
        const line = rawLine.trim();
        const lineLower = line.toLowerCase();

        // A. Specific key-value prefixes
        if (/(?:name|contact|contact person|联系人|姓名|客户姓名|客户|负责人|经办人)\s*[:：]\s*(.*)/i.test(line)) {
          const m = line.match(/(?:name|contact|contact person|联系人|姓名|客户姓名|客户|负责人|经办人)\s*[:：]\s*(.*)/i);
          if (m && m[1]) result.name = m[1].replace(/[,;"']/g, '').trim();
        }
        else if (/(?:company|company name|co\.|corp|corporation|firm|公司|公司名称|企业名称|商户|店铺|名)\s*[:：]\s*(.*)/i.test(line)) {
          const m = line.match(/(?:company|company name|co\.|corp|corporation|firm|公司|公司名称|企业名称|商户|店铺|名)\s*[:：]\s*(.*)/i);
          if (m && m[1]) result.companyName = m[1].replace(/[,;"']/g, '').trim();
        }
        else if (/(?:country|region|国家|国)\s*[:：]\s*(.*)/i.test(line)) {
          const m = line.match(/(?:country|region|国家|国)\s*[:：]\s*(.*)/i);
          if (m && m[1]) result.country = m[1].replace(/[,;"']/g, '').trim();
        }
        else if (/(?:address|add|location|地址|住址|收货地址|发货地址|厂址)\s*[:：]\s*(.*)/i.test(line)) {
          const m = line.match(/(?:address|add|location|地址|住址|收货地址|发货地址|厂址)\s*[:：]\s*(.*)/i);
          if (m && m[1]) result.address = m[1].trim();
        }
        else if (/(?:notes|note|remarks|remark|备注|说明|补充信息|谈判记录)\s*[:：]\s*(.*)/i.test(line)) {
          const m = line.match(/(?:notes|note|remarks|remark|备注|说明|补充信息|谈判记录)\s*[:：]\s*(.*)/i);
          if (m && m[1]) result.notes = m[1].trim();
        }

        // B. Non-prefix smart match strategies
        // Extract company ends
        if (!result.companyName && (
          lineLower.endsWith(' co., ltd.') || 
          lineLower.endsWith(' co.,ltd.') || 
          lineLower.endsWith(' corp.') || 
          lineLower.endsWith(' inc.') || 
          lineLower.endsWith(' llc') || 
          lineLower.endsWith(' limited') || 
          lineLower.endsWith(' group') || 
          line.endsWith('有限公司') || 
          line.endsWith('有限责任公司') || 
          line.endsWith('集团') || 
          line.endsWith('制品厂') || 
          line.endsWith('家居')
        )) {
          if (line.length < 50) {
            result.companyName = line;
          }
        }

        // Extract country from plain text
        if (!result.country) {
          for (const countryWord of countriesList) {
            if (lineLower.includes(countryWord)) {
              // Be careful not to match random substrings
              const wordIdx = lineLower.indexOf(countryWord);
              if (wordIdx !== -1) {
                // Return capitalized country or Chinese form
                result.country = countryWord.toUpperCase();
                break;
              }
            }
          }
        }

        // Extract potential address lines (contain street descriptors)
        if (!result.address) {
          if (/(?:street|st|road|rd|avenue|ave|drive|dr|building|bldg|floor|fl|room|rm|zone|district|city|province|state|地址|路|区|市|省|街)/i.test(lineLower)) {
            if (line.length > 10 && line.length < 100 && !line.includes('@') && !line.includes('http') && !line.includes(':') && !line.includes('：')) {
              result.address = line;
            }
          }
        }
      }

      // 5. Normal line 1 fallback for Guest Name or Company Name if completely empty
      if (!result.name && lines.length > 0) {
        for (const line of lines) {
          // If a line is short, doesn't contain links/emails or punctuation, grab it!
          if (!line.includes('@') && !line.includes(':') && !line.includes('：') && !line.includes('http') && line.length > 2 && line.length < 25) {
            // If it seems to be an English capitalized name e.g. "John Doe" or a simple Chinese name
            if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(line) || /^[\u4e00-\u9fa5]{2,4}$/.test(line)) {
              result.name = line;
              break;
            }
          }
        }
      }

      // 6. Last-resort fallback for Name
      if (!result.name && lines.length > 0) {
        const fallbackLine = lines[0];
        if (fallbackLine && fallbackLine.length < 32 && !fallbackLine.includes('@') && !fallbackLine.includes('http')) {
          result.name = fallbackLine;
        }
      }

      // Overlay on formData
      setFormData(prev => ({
        ...prev,
        name: result.name || prev.name || '未命名联系人',
        companyName: result.companyName || prev.companyName,
        email: result.email || prev.email,
        email2: result.email2 || prev.email2,
        tel: result.tel || prev.tel,
        address: result.address || prev.address,
        country: result.country || prev.country,
        linkedin: result.linkedin || prev.linkedin,
        facebook: result.facebook || prev.facebook,
        whatsapp: result.whatsapp || prev.whatsapp,
        alibaba: result.alibaba || prev.alibaba,
        website: result.website || prev.website,
        productLink: result.productLink || prev.productLink,
        notes: result.notes || prev.notes || `[本地识别 - 原文参考]:\n${text.slice(0, 150)}`
      }));

      setParseSuccessMsg('⚡ 本地极速智能识别成功！已匹配提取关键信息（名字/邮箱/电话/网址），请您核对确认。');
    } catch (err: any) {
      setParseErrorMsg(`本地解析发生错误: ${err.message || err}`);
    } finally {
      setIsParsingLocal(false);
    }
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

  const handleAvatarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAvatar(true);
  };

  const handleAvatarDragLeave = () => {
    setIsDraggingAvatar(false);
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAvatar(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

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
            className="text-xs font-bold text-primary hover:underline px-2"
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

            const allProductInfos: { url: string; code?: string; desc?: string }[] = [];
            
            // Add images from quotations with their codes/descriptions
            customerQuotes.forEach(q => {
              q.items.forEach(item => {
                if (item.image) {
                  // Avoid duplicates
                  if (!allProductInfos.find(info => info.url === item.image)) {
                    allProductInfos.push({
                      url: item.image,
                      code: item.productCode,
                      desc: item.desc
                    });
                  }
                }
              });
            });

            // Add images from customer profile if any (these might not be linked to specific products)
            customerGroup.forEach(c => {
              (c.productImages || []).forEach(img => {
                if (!allProductInfos.find(info => info.url === img)) {
                  allProductInfos.push({ url: img });
                }
              });
            });

            const displayedProducts = allProductInfos.slice(0, 5);

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
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">
                              <Flag size={10} className="text-primary" />
                              {customer.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        to={`/quotations/new?customerId=${customer.id}`}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                        title="Draft Quote"
                      >
                        <FilePlus size={14} />
                      </Link>
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
                            <a 
                              href={`https://mail.zoho.com.cn/zm/#mail/compose?to=${encodeURIComponent(customer.email)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary inline-flex items-center justify-center"
                              title="Compose in Zoho Mail (Web)"
                            >
                              <span className="text-[8px] font-bold opacity-0 group-hover/email:opacity-100">Zoho</span>
                            </a>
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
                          <a 
                            href={`https://mail.zoho.com.cn/zm/#mail/compose?to=${encodeURIComponent(customer.email2)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-primary/10 rounded transition-colors text-on-surface-variant hover:text-primary inline-flex items-center justify-center"
                            title="Compose in Zoho Mail (Web)"
                          >
                            <span className="text-[8px] font-bold opacity-0 group-hover/email2:opacity-100">Zoho</span>
                          </a>
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
                    {customer.productLink && (
                      <a href={customer.productLink.startsWith('http') ? customer.productLink : `https://${customer.productLink}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-surface-container-low rounded-md hover:text-primary hover:bg-primary/5 transition-all" title="Customer's Request Product">
                        <Link2 size={14} />
                      </a>
                    )}
                    {customer.localPath && (
                      <div className="relative group/path">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(customer.localPath!);
                            setCopiedText(customer.localPath!);
                          }}
                          className="p-1.5 bg-surface-container-low rounded-md hover:text-primary hover:bg-primary/5 transition-all"
                          title={`Click to copy path: ${customer.localPath}`}
                        >
                          <FolderOpen size={14} />
                        </button>
                        {copiedText === customer.localPath && (
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10 border border-outline-variant">
                            Path Copied! <br/>
                            Use Cmd+Shift+G in Finder
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Product Mini Gallery */}
                  {displayedProducts.length > 0 && (
                    <div className="mt-1">
                      <p className="text-[10px] font-bold text-on-surface-variant mb-1.5">Products</p>
                      <div className="flex gap-1.5 overflow-hidden">
                        {displayedProducts.map((pInfo, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => setPreviewImage(pInfo)}
                            className="w-12 h-12 rounded-lg border border-outline-variant/20 overflow-hidden flex-shrink-0 bg-white shadow-sm hover:border-primary transition-all hover:scale-105"
                          >
                            <img src={pInfo.url} alt="" className="w-full h-full object-contain" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quotation Mini List */}
                <div className="bg-surface-container-low/40 p-3 mt-auto border-t border-outline-variant/30">
                  <h3 className="text-xs font-bold text-on-surface-variant mb-2 flex justify-between">
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
          <div className={`bg-surface-container-lowest rounded-2xl w-full ${showSmartPaste ? 'max-w-4xl' : 'max-w-2xl'} shadow-2xl overflow-hidden transition-all duration-300`}>
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/30 bg-surface-container-low">
              <div className="flex items-center gap-2">
                <Users className="text-primary" size={24} />
                <h2 className="text-xl font-headline font-bold text-primary">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h2>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-surface-container-high rounded-full transition-colors font-bold cursor-pointer">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="max-h-[80vh] overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Smart Copy-Paste Parser */}
                  {showSmartPaste && (
                    <div className="lg:col-span-5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex flex-col gap-4 self-stretch">
                      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                        <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
                          <Brain size={16} className="text-primary animate-pulse" />
                          <span>极速智能粘贴导入</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSmartPaste(false)}
                          className="text-xs text-on-surface-variant hover:text-primary transition-colors hover:underline font-bold cursor-pointer"
                        >
                          隐藏面板
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        直接从邮件签名、微信聊天记录、WhatsApp 等来源复制客户信息并黏贴在此。系统将自动拆分并实时填入右侧表单：
                      </p>

                      <div className="flex flex-col gap-1.5">
                        <textarea
                          value={rawImportText}
                          onChange={(e) => setRawImportText(e.target.value)}
                          placeholder="例如粘贴：&#10;姓名: John Doe&#10;公司: Acme Corp&#10;邮箱: john@acme.com&#10;手机: +1 (555) 0199&#10;网址: www.acme.com&#10;国家: USA&#10;或者粘贴任何零散信息..."
                          className="w-full bg-surface-container-lowest p-3 rounded-lg outline-none border border-outline-variant/30 focus:border-primary transition-all text-xs h-[180px] font-sans resize-none placeholder-on-surface-variant/40"
                        />
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <button
                          type="button"
                          onClick={handleLocalParse}
                          disabled={isParsingLocal}
                          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-on-primary hover:opacity-95 py-3 rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer text-center"
                          title="在您的浏览器端秒级运行本地规则匹配，100% 本地安全免费，无需配置任何 API KEY 密钥！"
                        >
                          <Brain size={16} className="animate-pulse" />
                          <span>⚡ 极速本地识别导入 (100% 免费安全) ⚡</span>
                        </button>
                      </div>

                      {parseSuccessMsg && (
                        <div className="bg-success-container/15 text-success text-xs p-2.5 rounded-lg border border-success/20 font-medium">
                          {parseSuccessMsg}
                        </div>
                      )}

                      {parseErrorMsg && (
                        <div className="bg-error-container/15 text-error text-xs p-2.5 rounded-lg border border-error/20 font-medium">
                          {parseErrorMsg}
                        </div>
                      )}

                      <div className="text-[10px] text-on-surface-variant leading-tight bg-surface-container-lowest p-2.5 rounded border border-outline-variant/10">
                        <span className="font-bold">💡 导入解析说明：</span>
                        <ul className="list-disc list-inside mt-1 space-y-1 opacity-85">
                          <li><strong>100% 离线安全：</strong>所有内容均在浏览器本地分析提取，不发送到后端服务器，保护您的客户隐私。</li>
                          <li><strong>自动识别字段：</strong>支持自然分析提取客户姓名、邮箱、电话、公司名称、国家、网址和产品链接。</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Right Column: Original Modal Content Form */}
                  <div className={`${showSmartPaste ? 'lg:col-span-7' : 'lg:col-span-12'} flex flex-col gap-5 self-stretch`}>
                    {!showSmartPaste && (
                      <div className="flex justify-start mb-1">
                        <button
                          type="button"
                          onClick={() => setShowSmartPaste(true)}
                          className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Brain size={12} />
                          展开 ⚡极速智能粘贴导入 面板
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-4 mb-2 bg-surface-container-low/20 p-3 rounded-xl border border-outline-variant/10">
                      <div 
                        onDragOver={handleAvatarDragOver}
                        onDragLeave={handleAvatarDragLeave}
                        onDrop={handleAvatarDrop}
                        className={`relative group flex-shrink-0 rounded-full transition-all ${isDraggingAvatar ? 'ring-4 ring-primary scale-105' : ''}`}
                      >
                        <div className={`w-16 h-16 rounded-full overflow-hidden bg-surface-container-low border-2 ${isDraggingAvatar ? 'border-primary' : 'border-dashed border-outline-variant'} group-hover:border-primary transition-colors flex items-center justify-center`}>
                          {formData.avatar ? (
                            <img src={formData.avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                          ) : (
                            <User size={28} className="text-on-surface-variant/30" />
                          )}
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                          <Camera size={16} />
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">客户头像 (Avatar)</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">支持拖拽图片至选框内，或点击直接上传</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                          客户姓名 <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="例如 John Doe"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">公司名称</label>
                        <input
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="例如 Acme Corp"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">主要邮箱</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="john@example.com"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">备用邮箱</label>
                        <input
                          type="email"
                          value={formData.email2}
                          onChange={(e) => setFormData({ ...formData, email2: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="例如 backup@example.com"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">国别（国家）</label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="例如 USA, 德国"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">联系电话 (Tel)</label>
                        <input
                          type="tel"
                          value={formData.tel}
                          onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="+1 234 567 890"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">客户网址</label>
                        <input
                          type="text"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="www.example.com"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">Alibaba 地址</label>
                        <input
                          type="text"
                          value={formData.alibaba}
                          onChange={(e) => setFormData({ ...formData, alibaba: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="阿里巴巴旺铺链接"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">LinkedIn 链接</label>
                        <input
                          type="text"
                          value={formData.linkedin}
                          onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="领英主页"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">Facebook 链接</label>
                        <input
                          type="text"
                          value={formData.facebook}
                          onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="FB 个人或社媒主页"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">WhatsApp 账号 / 链接</label>
                        <input
                          type="text"
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="WhatsApp 号码"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-on-surface-variant">客户目标产品链接</label>
                        <input
                          type="text"
                          value={formData.productLink}
                          onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm"
                          placeholder="询盘商品页链接"
                        />
                      </div>

                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-xs font-bold text-on-surface-variant">本地资源文件夹文件夹路径</label>
                        <input
                          type="text"
                          value={formData.localPath}
                          onChange={(e) => setFormData({ ...formData, localPath: e.target.value })}
                          className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all text-sm w-full"
                          placeholder="/Users/Name/Documents/ClientA"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-on-surface-variant">详细收货/联系地址</label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all min-h-[50px] text-sm"
                        placeholder="公司实体办公或者收货地址"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-on-surface-variant">客户备注 & 谈判备忘 (Notes)</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="bg-surface-container-low px-3 py-1.5 rounded-lg outline-none border border-outline-variant/25 focus:border-primary transition-all min-h-[50px] text-sm"
                        placeholder="日常习惯、付款条件偏好等..."
                      />
                    </div>

                    <div className="flex justify-end gap-3 mt-2 border-t border-outline-variant/20 pt-4 bg-surface-container-low/20 p-3 rounded-xl">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-6 py-2 rounded-lg font-medium hover:bg-surface-container-high hover:text-on-surface text-on-surface-variant text-sm transition-colors cursor-pointer"
                      >
                        取消关闭
                      </button>
                      <button
                        type="submit"
                        className="bg-primary text-on-primary px-8 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm cursor-pointer"
                      >
                        {editingCustomer ? '更新记录' : '保存入库'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md cursor-zoom-out"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl w-full h-full flex flex-col items-center justify-center gap-4" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-4 -right-4 md:top-0 md:right-0 bg-white text-black p-2 rounded-full shadow-xl hover:bg-gray-200 transition-colors z-10"
            >
              <X size={24} />
            </button>
            <img 
              src={previewImage.url} 
              alt="Product Preview" 
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl scale-in-center"
            />
            
            {(previewImage.code || previewImage.desc) && (
              <Link 
                to={`/products?search=${encodeURIComponent(previewImage.code || previewImage.desc || '')}`}
                className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
              >
                <Package size={20} />
                View in Library
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

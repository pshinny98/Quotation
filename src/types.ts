export interface SubItem {
  id: number;
  itemName: string;
  sizeW: number;
  sizeD: number;
  sizeH: number;
  qty: number;
  vol: number;
  price: number;
}

export interface ProductItem {
  id: number;
  image: string;
  desc: string;
  subItems: SubItem[];
}

export interface CustomerInfo {
  name: string;
  email: string;
  tel: string;
  address: string;
}

export interface Quotation {
  id?: string;
  quoteRef: string;
  quoteDate: string;
  customer: CustomerInfo;
  items: ProductItem[];
  seaFreight: string;
  subtotal: number;
  totalVolume: number;
  grandTotal: number;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Customer {
  id?: string;
  name: string;
  email: string;
  tel: string;
  address: string;
  userId: string;
  latestQuoteRef: string;
  latestQuoteDate: string;
  productGroups: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProductVariant {
  id: string;
  itemName: string;
  sizeW: number;
  sizeD: number;
  sizeH: number;
  price: number;
  vol: number;
}

export interface Product {
  id?: string;
  productCode?: string;
  image: string;
  desc: string;
  variants: ProductVariant[];
  userId: string;
  latestQuoteRef: string;
  createdAt: number;
  updatedAt: number;
}

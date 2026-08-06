// Ek hi jagah pe saare fixed values. Naya status/type yahin add karna.

export const ROLES = {
  WHOLESALER: 'wholesaler',
  RETAILER: 'retailer',
};

export const PARTY_TYPES = {
  RETAILER: 'retailer',
  SUPPLIER: 'supplier',
};

export const PARTY_STATUS = {
  PENDING: 'pending',   // invite link se signup kiya, approval baaki
  ACTIVE: 'active',
  BLOCKED: 'blocked',
};

export const ORDER_STATUS = {
  PLACED: 'PLACED',
  PACKED: 'PACKED',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

// Aage kaunsa status allowed hai — Part 7 me status flow validate karne ke liye
export const ORDER_STATUS_FLOW = {
  PLACED: ['PACKED', 'CANCELLED'],
  PACKED: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const DOCUMENT_TYPES = {
  TAX_INVOICE: 'TAX_INVOICE',       // GST registered wholesaler
  BILL_OF_SUPPLY: 'BILL_OF_SUPPLY', // Non-GST wholesaler
};

export const TAX_TYPES = {
  CGST_SGST: 'CGST_SGST', // same state
  IGST: 'IGST',           // dusra state
  NONE: 'NONE',           // GST off
};

export const STOCK_MOVEMENT_TYPES = {
  OPENING: 'OPENING',
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  ADJUSTMENT: 'ADJUSTMENT',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  SALE_RETURN: 'SALE_RETURN',
};

export const LEDGER_TYPES = {
  OPENING: 'OPENING',
  INVOICE: 'INVOICE',
  PAYMENT_IN: 'PAYMENT_IN',
  PAYMENT_OUT: 'PAYMENT_OUT',
  PURCHASE: 'PURCHASE',
  ADJUSTMENT: 'ADJUSTMENT',
};

export const PAYMENT_MODES = {
  CASH: 'CASH',
  UPI: 'UPI',
  BANK: 'BANK',
  CHEQUE: 'CHEQUE',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
};

export const NOTIFICATION_TYPES = {
  NEW_ORDER: 'NEW_ORDER',
  ORDER_STATUS: 'ORDER_STATUS',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  LOW_STOCK: 'LOW_STOCK',
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
};

export const UNITS = [
  'PCS', 'BOX', 'PKT', 'SET', 'PAIR', 'DOZ',
  'KG', 'GM', 'LTR', 'ML', 'MTR', 'FT', 'BAG', 'BUNDLE',
];

// Counter keys — document numbering ke liye
export const COUNTER_KEYS = {
  INVOICE: 'invoice',
  ORDER: 'order',
  PURCHASE: 'purchase',
  PAYMENT: 'payment',
};

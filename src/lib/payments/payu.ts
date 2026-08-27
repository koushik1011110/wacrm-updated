import crypto from 'crypto';

interface CreatePayUParams {
  txnid: string;
  amount: number;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl?: string;
  furl?: string;
  merchantKey?: string;
  merchantSalt?: string;
  payuEnv?: string;
}

export interface PayUFormData {
  action: string;
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
}

/**
 * Get PayU API Gateway URL (Test or Production).
 */
export function getPayUBaseUrl(payuEnv?: string): string {
  const env = (payuEnv || process.env.PAYU_ENV || 'TEST').toUpperCase().trim();
  return env === 'PROD' || env === 'PRODUCTION'
    ? 'https://secure.payu.in/_payment'
    : 'https://test.payu.in/_payment';
}

function getSiteUrl(): string {
  let url = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!url || url.includes('example.com')) {
    return 'http://localhost:3000';
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

/**
 * Calculate SHA512 Payment Request Hash for PayU.
 * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
export function generatePayUHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  salt: string;
}): string {
  const hashString = `${params.key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|||||||||||${params.salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * Verify SHA512 Payment Response Hash from PayU callback.
 * Formula: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function verifyPayUResponseHash(params: {
  status: string;
  email: string;
  firstname: string;
  productinfo: string;
  amount: string;
  txnid: string;
  key: string;
  postedHash: string;
  salt: string;
}): boolean {
  const hashString = `${params.salt}|${params.status}|||||||||||${params.email}|${params.firstname}|${params.productinfo}|${params.amount}|${params.txnid}|${params.key}`;
  const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  return calculatedHash.toLowerCase() === params.postedHash.toLowerCase();
}

/**
 * Create PayU Checkout Form Payload and Hosted URL.
 */
export function createPayUPaymentDetails(params: CreatePayUParams): {
  txnid: string;
  paymentLink: string;
  formData: PayUFormData;
} {
  const key = (params.merchantKey || process.env.PAYU_MERCHANT_KEY || 'GTK32n').trim();
  const salt = (params.merchantSalt || process.env.PAYU_MERCHANT_SALT || 'eCwTWDSE').trim();
  const action = getPayUBaseUrl(params.payuEnv);
  const siteUrl = getSiteUrl();

  const amountStr = Math.round(params.amount).toFixed(2);
  const cleanPhone = params.phone.replace(/\D/g, '').slice(-10) || '9876543210';

  const surl = params.surl || `${siteUrl}/api/payments/payu/callback`;
  const furl = params.furl || `${siteUrl}/api/payments/payu/callback`;

  const hash = generatePayUHash({
    key,
    txnid: params.txnid,
    amount: amountStr,
    productinfo: params.productinfo,
    firstname: params.firstname || 'Customer',
    email: params.email || 'customer@gmail.com',
    salt,
  });

  const formData: PayUFormData = {
    action,
    key,
    txnid: params.txnid,
    amount: amountStr,
    productinfo: params.productinfo,
    firstname: params.firstname || 'Customer',
    email: params.email || 'customer@gmail.com',
    phone: cleanPhone,
    surl,
    furl,
    hash,
  };

  const queryParams = new URLSearchParams({
    txnid: params.txnid,
    amount: amountStr,
    firstname: params.firstname || 'Customer',
    productinfo: params.productinfo,
  });

  const paymentLink = `${siteUrl}/payu-checkout?${queryParams.toString()}`;

  return {
    txnid: params.txnid,
    paymentLink,
    formData,
  };
}

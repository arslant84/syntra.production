/**
 * Currency formatting utilities
 * Ensures consistent currency display across the application
 */

export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_CURRENCY_SYMBOL = '$';

/**
 * Format a number as currency with USD as default
 * @param amount - The amount to format
 * @param currency - Currency code (default: USD)
 * @param showCurrencyCode - Whether to show the currency code after the amount
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number | string | null | undefined, 
  currency: string = DEFAULT_CURRENCY,
  showCurrencyCode: boolean = true
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '$0.00 USD';
  }

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
    return '$0.00 USD';
  }

  const formattedAmount = numericAmount.toFixed(2);
  
  if (currency.toLowerCase() === 'usd' || currency === DEFAULT_CURRENCY) {
    return showCurrencyCode 
      ? `$${formattedAmount} USD`
      : `$${formattedAmount}`;
  }
  
  // For other currencies (fallback)
  return showCurrencyCode 
    ? `${formattedAmount} ${currency.toUpperCase()}`
    : formattedAmount;
}

/**
 * Format currency for display in tables
 * @param amount - The amount to format
 * @returns Formatted currency string for table display
 */
export function formatCurrencyForTable(amount: number | string | null | undefined): string {
  return formatCurrency(amount, DEFAULT_CURRENCY, true);
}

/**
 * Format currency for forms and inputs
 * @param amount - The amount to format
 * @returns Formatted currency string for form display
 */
export function formatCurrencyForForm(amount: number | string | null | undefined): string {
  return formatCurrency(amount, DEFAULT_CURRENCY, false);
}

/**
 * Parse currency string back to number
 * @param currencyString - Currency string to parse
 * @returns Numeric value
 */
export function parseCurrency(currencyString: string): number {
  if (!currencyString) return 0;
  
  // Remove currency symbols and text, keep only numbers and decimal point
  const numericString = currencyString.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(numericString);
  
  return isNaN(parsed) ? 0 : parsed;
}
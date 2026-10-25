export type DefaultCategoryName =
  | 'Food'
  | 'Groceries'
  | 'Transport'
  | 'Shopping'
  | 'Bills'
  | 'Health'
  | 'Entertainment'
  | 'Other';

export const BUILT_IN_MERCHANTS: ReadonlyArray<{
  merchant: string;
  category: DefaultCategoryName;
}> = [
  { merchant: 'swiggy', category: 'Food' },
  { merchant: 'zomato', category: 'Food' },
  { merchant: 'eatclub', category: 'Food' },
  { merchant: 'dominos', category: 'Food' },
  { merchant: 'mcdonalds', category: 'Food' },
  { merchant: 'kfc', category: 'Food' },
  { merchant: 'starbucks', category: 'Food' },
  { merchant: 'subway', category: 'Food' },
  { merchant: 'bigbasket', category: 'Groceries' },
  { merchant: 'blinkit', category: 'Groceries' },
  { merchant: 'zepto', category: 'Groceries' },
  { merchant: 'dmart', category: 'Groceries' },
  { merchant: 'jiomart', category: 'Groceries' },
  { merchant: 'instamart', category: 'Groceries' },
  { merchant: 'more supermarket', category: 'Groceries' },
  { merchant: 'uber', category: 'Transport' },
  { merchant: 'ola', category: 'Transport' },
  { merchant: 'rapido', category: 'Transport' },
  { merchant: 'irctc', category: 'Transport' },
  { merchant: 'redbus', category: 'Transport' },
  { merchant: 'metro', category: 'Transport' },
  { merchant: 'amazon', category: 'Shopping' },
  { merchant: 'flipkart', category: 'Shopping' },
  { merchant: 'myntra', category: 'Shopping' },
  { merchant: 'ajio', category: 'Shopping' },
  { merchant: 'meesho', category: 'Shopping' },
  { merchant: 'nykaa', category: 'Shopping' },
  { merchant: 'airtel', category: 'Bills' },
  { merchant: 'jio', category: 'Bills' },
  { merchant: 'vodafone', category: 'Bills' },
  { merchant: 'bescom', category: 'Bills' },
  { merchant: 'tataplay', category: 'Bills' },
  { merchant: 'act fibernet', category: 'Bills' },
  { merchant: 'apollo', category: 'Health' },
  { merchant: 'pharmeasy', category: 'Health' },
  { merchant: 'netmeds', category: 'Health' },
  { merchant: 'bookmyshow', category: 'Entertainment' },
  { merchant: 'netflix', category: 'Entertainment' },
  { merchant: 'spotify', category: 'Entertainment' },
  { merchant: 'hotstar', category: 'Entertainment' },
];

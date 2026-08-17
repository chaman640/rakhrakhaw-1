/**
 * DUKAAN KE KHARCH KI SHRENIYAN.
 *
 * Ye list "shuruaat" hai, "poori" nahi. Har dukaan ka kharch alag hota hai —
 * kisi ke yahan generator ka diesel hai, kisi ke yahan mandir ka chanda. Isliye
 * do baatein tay ki gayi hain:
 *
 *   1. Ye jaani-pehchani shreniyan chip ke roop me pehle se dikhti hain, taaki
 *      roz ka kharch ek tap me likha jaye.
 *   2. Naya naam likhne par wo bhi chal jata hai — aur agli baar wo bhi chip
 *      bankar aa jata hai (server pehle likhe hue naam yaad rakhta hai).
 *
 * Naam ko "slug" me badal kar rakhte hain (chhote akshar, bina space) — warna
 * "Petrol", "petrol" aur "PETROL" teen alag shreniyan ban jatin aur report me
 * ek hi cheez teen jagah dikhti.
 */

export const EXPENSE_CATEGORIES = [
  { value: 'chai-paani', label: 'Chai-paani', hint: 'Chai, nashta, mehmaan-nawazi' },
  { value: 'petrol', label: 'Petrol / diesel', hint: 'Gaadi ka tel' },
  { value: 'transport', label: 'Transport / bhada', hint: 'Maal laane-le jaane ka kiraya' },
  { value: 'salary', label: 'Tankhwah', hint: 'Staff ki pagaar aur bonus' },
  { value: 'rent', label: 'Kiraya', hint: 'Dukaan ya godown ka kiraya' },
  { value: 'bijli', label: 'Bijli / paani', hint: 'Bijli, paani, generator' },
  { value: 'phone', label: 'Phone / internet', hint: 'Recharge, broadband' },
  { value: 'packing', label: 'Packing', hint: 'Dibba, tape, bori' },
  { value: 'marammat', label: 'Marammat', hint: 'Dukaan, gaadi ya machine theek karana' },
  { value: 'tax-fees', label: 'Tax / fees', hint: 'CA fees, licence, sarkari fees' },
  { value: 'other', label: 'Aur kuch', hint: 'Jo upar kisi me na aaye' },
];

export const CATEGORY_LABEL = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
);

/** "Generator ka Diesel" -> "generator-ka-diesel" */
export function slugifyCategory(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\wऀ-ॿ]+/g, '-')     // Devanagari bhi chalega
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Slug ko dikhane layak naam me — jaani-pehchani ho to uska apna naam */
export function categoryLabel(slug) {
  if (CATEGORY_LABEL[slug]) return CATEGORY_LABEL[slug];
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Aur kuch';
}

/** Kharch kaise diya */
export const EXPENSE_MODES = ['CASH', 'UPI', 'BANK', 'CHEQUE'];

export const MODE_LABEL = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK: 'Bank',
  CHEQUE: 'Cheque',
};

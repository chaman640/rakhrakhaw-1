import { ROLES } from '../config/constants.js';

/**
 * "KHAREEDNE WALA KAUN HAI" — is sawal ka ek hi jawab, ek hi jagah.
 *
 * Membership do tarah ke kharidaar jaanti hai (Membership.js me poori wajah):
 *
 *   retailer   → uska apna login          → { userId }
 *   wholesaler → uski poori DUKAAN        → { buyerBusinessId }
 *
 * Doosra wala aadmi se nahi, dukaan se juda hai — taaki godown incharge jo
 * dukaan jode wo malik ko bhi dikhe, aur dono ek hi cart me daalein.
 *
 * Ye faisla har jagah dohrana sabse aasan galti hai: ek jagah `userId` se
 * dhoondha jayega aur doosri jagah `buyerBusinessId` se, aur phir "jodi to thi,
 * dikh nahi rahi" wali shikayat aayegi jiska koi sira nahi milta. Isliye poore
 * project me Membership dhoondhne ka rasta sirf yahi function hai.
 */
export function buyerFilter(user) {
  if (!user) return null;
  if (user.role === ROLES.WHOLESALER) {
    return user.businessId ? { buyerBusinessId: user.businessId } : null;
  }
  return user._id ? { userId: user._id } : null;
}

/** Nayi Membership banate waqt wahi do khaane — jo lagu na ho wo `null` */
export function buyerFields(user) {
  const filter = buyerFilter(user);
  return {
    userId: filter?.userId || null,
    buyerBusinessId: filter?.buyerBusinessId || null,
  };
}

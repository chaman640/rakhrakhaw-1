import { Purchase, User, Membership } from '../models/index.js';
import {
  ROLES,
} from './constants.js';
import {
  STAFF_ROLES, SCOPES, expandLegacyPermissions, hasLegacyPermission,
  scopeForRole, limitsForRole,
} from './permissions.js';

/**
 * Purane data me chhoote hue field bhar dena.
 *
 * Kabhi kabhi schema me naya field jud jata hai, lekin jo document pehle se
 * database me pade hain unme wo field hota hi nahi. Naya code un purane
 * document ko padhta hai to 0 (ya undefined) milta hai aur report jhooth bolne
 * lagti hai. Isliye startup pe ek baar purane document theek kar dete hain.
 *
 * `syncIndexes()` ki tarah — ye kabhi startup nahi rokta. Kuch bhi gadbad ho to
 * sirf log karke aage badh jata hai.
 */
export async function runBackfills() {
  const done = [];
  const problems = [];

  // ---- Purchase.taxableTotal ----
  //
  // Ye field pehle model me tha hi nahi. GST report ka "input credit" wala
  // hissa `$sum: '$taxableTotal'` karta hai, isliye har purani kharid ka
  // taxable 0 dikhta tha (tax theek dikhta tha — bas taxable 0). Har line ka
  // `taxableValue` pehle se save hai, isliye jod kar bhar dete hain.
  try {
    const result = await Purchase.updateMany(
      { taxableTotal: { $exists: false } },
      [{ $set: { taxableTotal: { $round: [{ $sum: '$items.taxableValue' }, 2] } } }]
    );
    if (result.modifiedCount) {
      done.push(`${result.modifiedCount} purani kharid ka taxable jod diya (GST report ab sahi input credit dikhayegi)`);
    }
  } catch (err) {
    problems.push(`Purchase.taxableTotal: ${err.message}`);
  }

  // ---- Purani staff permission ko naye roop me ----
  //
  // Pehle ijazat sirf module ki hoti thi (`invoices`), ab kaam ke saath hoti
  // hai (`invoices:create`). Purane staff ki list waise ki waise rehti to
  // agli subah munshi bill nahi bana pata aur kisi ko samajh nahi aata kyun.
  //
  // Purane `invoices` ka matlab tha "is module me sab kuch" — isliye use uske
  // saare kaam me khol dete hain. Ijazat chupchaap KAM karna sabse bura hota:
  // kaam ruk jata hai aur wajah kahin likhi nahi hoti.
  try {
    const legacy = await User.find({
      role: ROLES.WHOLESALER,
      staffRole: { $ne: STAFF_ROLES.OWNER },
      permissions: { $exists: true, $ne: [] },
    }).select('permissions staffRole scope limits');

    let changed = 0;
    for (const user of legacy) {
      if (!hasLegacyPermission(user.permissions)) continue;
      user.permissions = expandLegacyPermissions(user.permissions);
      // Ye do field pehle the hi nahi — role ke hisaab se bhar dete hain
      if (!user.scope) user.scope = scopeForRole(user.staffRole) || SCOPES.ALL;
      if (!user.limits || user.limits.canSellOnCredit === undefined) {
        user.limits = limitsForRole(user.staffRole);
      }
      await user.save();
      changed += 1;
    }
    if (changed) {
      done.push(`${changed} purane staff ki ijazat naye roop me badal di (kisi ka haq kam nahi hua)`);
    }
  } catch (err) {
    problems.push(`User.permissions: ${err.message}`);
  }

  // ---- Purane retailer ki Membership ----
  //
  // Ab "kaun kis dukaan se kharidta hai" ka jawab Membership me rehta hai
  // (Membership.js me poori wajah). Purane retailer ke paas wo entry hai hi
  // nahi — uska rishta abhi bhi `User.businessId` me pada hai.
  //
  // Bina is backfill ke bhi wo chalta rahega: `withBuyerTenant` header na aane
  // par purane khaane se hi kaam chala leta hai. Par ye entry ban jane se wo
  // NAYE raste pe bhi aa jata hai — yaani wahi purana retailer bina kuch kiye
  // apni dukaan ke saath saath aur dukaanein bhi jod sakta hai, aur uski purani
  // dukaan search wali list me pehle se dikhti hai.
  //
  // Idempotent hai — `upsert` hai, isliye har startup pe dobara chalne se kuch
  // nahi bigadta.
  try {
    const retailers = await User.find({
      role: ROLES.RETAILER,
      businessId: { $ne: null },
      partyId: { $ne: null },
    }).select('businessId partyId').lean();

    if (retailers.length) {
      const existing = await Membership.find({ userId: { $in: retailers.map((r) => r._id) } })
        .select('userId businessId').lean();
      const have = new Set(existing.map((m) => `${m.userId}|${m.businessId}`));
      const missing = retailers.filter((r) => !have.has(`${r._id}|${r.businessId}`));

      if (missing.length) {
        const now = new Date();
        const result = await Membership.bulkWrite(
          missing.map((r) => ({
            updateOne: {
              filter: { userId: r._id, businessId: r.businessId },
              update: {
                $setOnInsert: {
                  userId: r._id,
                  buyerBusinessId: null,
                  businessId: r.businessId,
                  partyId: r.partyId,
                  isSaved: true,
                  isPrimary: true,        // yahi wo dukaan hai jiske link se account bana tha
                  lastUsedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        );
        if (result.upsertedCount) {
          done.push(`${result.upsertedCount} purane retailer ki dukaan naye tarike se jod di (ab wo aur dukaanein bhi jod sakte hain)`);
        }
      }
    }
  } catch (err) {
    problems.push(`Membership backfill: ${err.message}`);
  }

  if (done.length) {
    console.log('[db] Purana data theek kiya:');
    for (const line of done) console.log(`     • ${line}`);
  }
  if (problems.length) {
    console.warn('[db] Kuch purana data theek nahi ho paya (app phir bhi chalega):');
    for (const line of problems) console.warn(`     • ${line}`);
  }

  return { done, problems };
}

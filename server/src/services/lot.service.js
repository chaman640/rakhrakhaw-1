import mongoose from 'mongoose';
import { StockLot, Item } from '../models/index.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * LAGAT KA EK HI DARWAZA — "ye maal aapko kitne ka pada tha".
 *
 * StockLot model me poori wajah likhi hai; yahan bas teen kaam hain:
 *
 *   khepBanao()   — maal aaya, uski lagat ke saath ek khep bani
 *   khepNikalo()  — maal gaya, purani khep se pehle (FIFO), aur SACHI lagat mili
 *   khepWapas()   — wahi maal wapas aaya, usi khep me wapas chala gaya
 *
 * Teeno ke naam Hinglish me hain kyunki poore project me isi zubaan me baat
 * hoti hai, par export angrezi me bhi hain taaki service se padhne me line
 * saaf rahe.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * "Khep khatam ho jaye to?"
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Aisa hona nahi chahiye — stock ki jaanch pehle hi ho chuki hoti hai. Par
 * do halat me ho sakta hai: purane data me (jo is feature se pehle ka hai,
 * uski koi khep hai hi nahi) aur jahan stock jaan-boojh kar minus me jaane
 * diya gaya ho.
 *
 * Aise me hum CHUP-CHAAP 0 lagat nahi maante — wo poora munafa jhootha bana
 * deta. Item ka aaj ka `purchasePrice` fallback banta hai, aur us hisse ki
 * `lotId` khali (`null`) rehti hai — yani nishaan reh jata hai ki ye lagat
 * kisi khep se nahi, andaze se aayi thi.
 */

const oid = (v) => new mongoose.Types.ObjectId(String(v));

/* ───────────────────────────── maal aaya ───────────────────────────── */

/**
 * Ek nayi khep. `unitCost` ek piece ki lagat hai (GST ke bina, discount ke baad).
 */
export async function khepBanao({
  businessId, itemId, qty, unitCost,
  source = 'PURCHASE', refType = null, refId = null, refNo = '',
  date = null, userId = null,
}) {
  const q = round2(qty);
  if (!(q > 0)) return null;

  return StockLot.create({
    businessId,
    itemId,
    unitCost: round2(Math.max(0, unitCost || 0)),
    qty: q,
    remaining: q,
    source,
    refType,
    refId,
    refNo,
    date: date || new Date(),
    createdBy: userId,
  });
}

/* ───────────────────────────── maal gaya ───────────────────────────── */

/**
 * FIFO se `qty` nikalo aur batao ki wo kitne ka pada tha.
 *
 * Wapasi:
 *   {
 *     cost:      poori lagat (rupaye me)
 *     unitCost:  ek piece ki ausat lagat — bill ki line pe yahi jamti hai
 *     pieces:    [{ lotId, qty, unitCost }] — wapas dalne ke liye zaroori
 *   }
 *
 * Har khep se nikalna ATOMIC hai (`remaining: { $gte: take }`). Do bill ek
 * saath ban rahe hon to dono ek hi khep ko do baar nahi kha sakte — jo hara
 * wo agli khep pe chala jata hai.
 */
export async function khepNikalo({ businessId, itemId, qty, fallbackCost = 0 }) {
  let bacha = round2(qty);
  if (!(bacha > 0)) return { cost: 0, unitCost: 0, pieces: [] };

  const pieces = [];
  let cost = 0;

  // Ek hi query me poori list — har chakkar me dobara dhoondhna mehnga hai
  const lots = await StockLot.find({ businessId, itemId, remaining: { $gt: 0 } })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  for (const lot of lots) {
    if (bacha <= 0) break;
    const chahiye = round2(Math.min(bacha, lot.remaining));

    // Beech me koi aur bill isi khep ko kha gaya ho to ye update fail hoga —
    // aur wahi sahi hai. Aage badho, agli khep se lo.
    const liya = await StockLot.findOneAndUpdate(
      { _id: lot._id, remaining: { $gte: chahiye } },
      { $inc: { remaining: -chahiye } },
      { new: true },
    );
    if (!liya) continue;

    pieces.push({ lotId: lot._id, qty: chahiye, unitCost: lot.unitCost });
    cost = round2(cost + chahiye * lot.unitCost);
    bacha = round2(bacha - chahiye);
  }

  /*
    Khep kam pad gayi — upar wali tippani me wajah likhi hai. Ye hissa
    `lotId: null` ke saath jata hai taaki baad me pehchana ja sake.
  */
  if (bacha > 0) {
    let rate = fallbackCost;
    if (!(rate > 0)) {
      const item = await Item.findOne({ _id: itemId, businessId }).select('purchasePrice').lean();
      rate = item?.purchasePrice || 0;
    }
    pieces.push({ lotId: null, qty: bacha, unitCost: round2(rate) });
    cost = round2(cost + bacha * rate);
  }

  const kul = round2(qty);
  return { cost, unitCost: kul > 0 ? round2(cost / kul) : 0, pieces };
}

/* ─────────────────────────── maal wapas aaya ─────────────────────────── */

/**
 * Jo khep se nikla tha, wahin wapas.
 *
 * Ye seedha `khepBanao` se behtar hai: naya lot banane par wapas aaya maal
 * KATAAR ME SABSE PEECHHE chala jata (kyunki uski tareekh aaj ki hoti), aur
 * agli bikri naye mehnge maal ko pehle kha jati. Purani khep me wapas dalne
 * se kram wahi rehta hai jo asal me tha.
 *
 * `pieces` me jinki `lotId` khali hai (yani jo andaze wali lagat pe gaye
 * the), unke liye ek nayi khep banti hai — usi lagat pe.
 */
export async function khepWapas({ businessId, itemId, pieces = [], date = null, refNo = '' }) {
  for (const piece of pieces) {
    const q = round2(piece.qty);
    if (!(q > 0)) continue;

    if (piece.lotId) {
      /*
        `findOneAndUpdate` jaan-boojh kar — `updateOne` ka jawab girna aasan
        hai (`matchedCount` bhool jao, ya driver alag ho, to `undefined` chup
        chaap "nahi mila" ban jata aur har wapasi ek nayi khep bana deti).
        Yahan wapasi me poora document aata hai: mila ya nahi, is me shak ki
        gunjaish hi nahi.
      */
      const hit = await StockLot.findOneAndUpdate(
        { _id: piece.lotId, businessId },
        { $inc: { remaining: q } },
        { new: true },
      );
      // Khep hi mit gayi ho (purchase delete ho gaya) to maal ko ghar chahiye
      if (hit) continue;
    }

    await khepBanao({
      businessId, itemId, qty: q, unitCost: piece.unitCost,
      source: 'SALE_RETURN', refNo, date,
    });
  }
}

/* ─────────────────────── document mit gaya ─────────────────────── */

/**
 * Kisi document ki banayi hui khep hatao (kharid delete/edit hui).
 *
 * Ek pech hai: us khep ka maal aage bik chuka ho sakta hai. Aise me khep ko
 * chup-chaap mita dena galat hoga — jo bill us lagat pe ban chuke hain unka
 * hisaab to ho hi chuka hai, par godown ka bacha hua maal bina ghar ke reh
 * jata. Isliye jitna BACHA hai utna hatate hain, aur khep tabhi mitti hai
 * jab usme se kuch bika hi na ho.
 *
 * Wapasi me batate hain ki kitna maal aisa tha jo pehle hi bik chuka tha —
 * bulane wala chahe to us par rok laga sakta hai.
 */
export async function khepHatao({ businessId, refType, refId }) {
  const lots = await StockLot.find({ businessId, refType, refId }).lean();
  let bikChuka = 0;

  for (const lot of lots) {
    bikChuka = round2(bikChuka + round2(lot.qty - lot.remaining));
    await StockLot.deleteOne({ _id: lot._id });
  }

  return { lots: lots.length, bikChuka };
}

/* ───────────────────────────── dekhne ke liye ───────────────────────────── */

/** Ek item ki khuli khep — Item detail pe "kaunsa maal kitne ka pada hai" */
export async function khepList(businessId, itemId) {
  const lots = await StockLot.find({ businessId, itemId, remaining: { $gt: 0 } })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const qty = round2(lots.reduce((s, l) => s + l.remaining, 0));
  const value = round2(lots.reduce((s, l) => s + l.remaining * l.unitCost, 0));

  return {
    lots: lots.map((l) => ({
      _id: l._id,
      qty: round2(l.remaining),
      unitCost: round2(l.unitCost),
      value: round2(l.remaining * l.unitCost),
      source: l.source,
      refNo: l.refNo,
      date: l.date,
    })),
    qty,
    value,
    // Ausat lagat — "aaj ka stock kitne ka pada hai" ka seedha jawab
    avgCost: qty > 0 ? round2(value / qty) : 0,
  };
}

/**
 * Kai item ki khuli khep ek saath — stock report ke liye.
 *
 * Report me har item pe alag query bahut mehngi hai (500 item = 500 query).
 * Ek hi group me sab nikal lete hain.
 */
export async function khepValueMap(businessId, itemIds = null) {
  const match = { businessId: oid(businessId), remaining: { $gt: 0 } };
  if (itemIds?.length) match.itemId = { $in: itemIds.map(oid) };

  const rows = await StockLot.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$itemId',
        qty: { $sum: '$remaining' },
        value: { $sum: { $multiply: ['$remaining', '$unitCost'] } },
      },
    },
  ]);

  return Object.fromEntries(rows.map((r) => [String(r._id), {
    qty: round2(r.qty),
    value: round2(r.value),
    avgCost: r.qty > 0 ? round2(r.value / r.qty) : 0,
  }]));
}

// Angrezi naam bhi — service files me line saaf padhne ke liye
export {
  khepBanao as addLot,
  khepNikalo as consumeLots,
  khepWapas as releaseLots,
  khepHatao as removeLotsFor,
};

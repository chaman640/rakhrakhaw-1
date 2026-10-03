import ApiError from './ApiError.js';

// Beech me server ruk gaya to taala itni der baad apne aap khul jata hai
const STALE_MS = 2 * 60 * 1000;

/**
 * Ek document pe ek waqt me ek hi kaam.
 *
 * Do tap ya net ka retry ek hi bill do baar cancel kar deta tha — stock dugna
 * wapas aata. Ye `busyAt` ka taala ek hi jhatke me lagata hai; doosri request
 * ko 409 milta hai. Kaam ke andar document dobara padhna zaroori hai (taala
 * milne tak pehla kaam poora ho chuka ho sakta hai).
 */
export async function holdDoc(Model, filter, notFoundMsg) {
  const now = new Date();
  const doc = await Model.findOneAndUpdate(
    { $and: [filter, { $or: [{ busyAt: null }, { busyAt: { $lt: new Date(now.getTime() - STALE_MS) } }] }] },
    { $set: { busyAt: now } },
    { new: true, projection: { _id: 1 } },
  ).lean();
  if (!doc) {
    if (!(await Model.exists(filter))) throw ApiError.notFound(notFoundMsg);
    throw ApiError.conflict('Ye kaam abhi chal raha hai — thodi der me dobara dekhein');
  }
  return () => Model.updateOne({ _id: doc._id, busyAt: now }, { $unset: { busyAt: 1 } }).catch(() => {});
}

/** `fn` ko taale ke andar chalao — kaam ho ya galti, taala khulta hai */
export async function withHold(Model, filter, notFoundMsg, fn) {
  const release = await holdDoc(Model, filter, notFoundMsg);
  try {
    return await fn();
  } finally {
    await release();
  }
}

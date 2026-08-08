import { Purchase } from '../models/index.js';

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

import * as models from '../models/index.js';

/**
 * Database ke index schema se milaa dena.
 *
 * Zarurat kyun padi:
 * Agar aapka MONGO_URI kisi aisi database pe point kare jisme pehle se koi
 * purana project chal chuka hai (aksar `test` ya same naam wali database),
 * to us project ke chhode hue index wahin pade reh jate hain.
 *
 * Asli case: purane project ke `users` collection pe `email` ka unique index tha.
 * Hamare User me email hai hi nahi — matlab har naya user email = null ke saath
 * jata hai. Pehla user chal jata hai, doosre pe Mongo kehta hai "email duplicate"
 * aur signup 409 de deta hai. Screen pe "Ye email pehle se maujud hai" dikhta hai
 * jabki poore app me email ka naam-o-nishaan nahi.
 *
 * `syncIndexes()` schema se bahar wale index hata deta hai aur schema wale bana
 * deta hai — yahi is dikkat ka pakka ilaaj hai.
 *
 * Kabhi bhi startup ko rokta nahi: kuch bhi gadbad ho to sirf log karke aage badh
 * jata hai (app tab bhi chalta hai, bas purana index pada reh jayega).
 */
export async function syncIndexes() {
  const removed = [];
  const problems = [];

  for (const [name, Model] of Object.entries(models)) {
    if (!Model?.syncIndexes) continue;
    try {
      const dropped = await Model.syncIndexes();
      if (Array.isArray(dropped) && dropped.length) {
        removed.push(`${Model.collection.name}: ${dropped.join(', ')}`);
      }
    } catch (err) {
      problems.push({ name, collection: Model.collection?.name, message: err.message });
    }
  }

  if (removed.length) {
    console.log('[db] Purane index hata diye (kisi aur project ke bache hue the):');
    for (const line of removed) console.log(`     • ${line}`);
  }

  if (problems.length) {
    console.warn('[db] Kuch index set nahi ho paye:');
    for (const p of problems) console.warn(`     • ${p.collection || p.name} — ${p.message}`);
    console.warn('     Aksar iska matlab ye hai ki is database me kisi purane project ka');
    console.warn('     data pada hai. Sabse aasan hal: MONGO_URI me database ka naam badal');
    console.warn('     dein (jaise .net/rakhrakhav2) — bilkul saaf database mil jayegi.');
  }

  return { removed, problems };
}

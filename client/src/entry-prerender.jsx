import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import Landing from '@/pages/public/Landing';

/*
  GHAR KA PAGE PEHLE SE HTML ME BANA KAR RAKHNA.

  Ye app ek SPA hai — matlab server sirf ek khali dabba bhejta hai
  (<div id="root"></div>) aur poora page browser me JavaScript chala kar
  banta hai. Aadmi ke liye ye theek hai. Google ke liye nahi.

  Google JavaScript chala to leta hai, par wo DOOSRI baari me hota hai —
  pehle wo saada HTML padhta hai, aur JS wala kaam katar me lag jata hai.
  Nayi site pe wo katar hafton lambi hoti hai. Us dauran Google ke paas
  hamare page pe ek bhi shabd nahi hota — na "Rakh Rakhav", na ye ki cheez
  kya hai. Jis page pe kuch likha hi na ho, wo kisi bhi khoj me upar nahi
  aata.

  Isliye build ke waqt ye file ghar ka page ek baar chala kar uska asli HTML
  nikal leti hai, aur wo HTML seedha index.html me chipak jata hai. Ab Google
  ko pehli hi baari me poora page mil jata hai.

  Aadmi ko farq nahi padta: React chalte hi wahi page dobara bana deta hai.
  Jo Google padhta hai aur jo aadmi dekhta hai — dono bilkul ek hi hain.
*/
export function render() {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <Landing />
    </StaticRouter>,
  );
}

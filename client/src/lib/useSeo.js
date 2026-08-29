import { useEffect } from 'react';

/*
  HAR PAGE KA APNA TITLE.

  Ye ek SPA hai — matlab poore app me sirf EK index.html hai. Bina iske har
  page ka title wahi ek rehta tha, aur Google ke paas har page ko alag pehchanne
  ka koi tareeka nahi tha. WhatsApp pe link bhejne pe bhi sab jagah ek hi naam
  jata tha.

  Ye sirf public page pe lagta hai. Andar ke page (bill, khata) Google ko
  dikhte hi nahi — wo login ke peeche hain.
*/

const SITE = 'https://rakhrakhav.in';

function meta(attr, key, value) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function link(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export default function useSeo({ title, description, path = '/' }) {
  useEffect(() => {
    const url = `${SITE}${path === '/' ? '/' : path}`;

    if (title) {
      document.title = title;
      meta('property', 'og:title', title);
    }
    if (description) {
      meta('name', 'description', description);
      meta('property', 'og:description', description);
    }
    meta('property', 'og:url', url);
    link('canonical', url);
  }, [title, description, path]);
}

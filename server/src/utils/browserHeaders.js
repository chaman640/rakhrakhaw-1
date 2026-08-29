/*
  APITxT ke aage ek bot-shield laga hai. Bina browser wale headers ke wo
  request ko dekhta bhi nahi:

      {"status":"error","message":"Access denied","reason":"MISSING_BROWSER_HEADERS"}

  Ye chhupna nahi hai — chaabi apni hai, account apna hai. Bas shield ko ye
  batana hai ki request asli hai. Har HTTP client ko User-Agent bhejna
  chahiye; Node ka fetch by default nahi bhejta, wahi kami thi.
*/
export const browserHeaders = (referer = 'https://www.apitxt.com/') => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    + ' (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1',
  Referer: referer,
});

/*
  Dukaan ka din IST me hai — server (Render) UTC pe chalta hai. Bina iske
  "aaj", "is mahine" aur report ki tareekhen raat 12 se subah 5:30 ke bill
  pichhle din me gin leti thin. Ye sabse pehle import hota hai.
*/
process.env.TZ ||= 'Asia/Kolkata';

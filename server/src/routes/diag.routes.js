import { Router } from 'express';
import { env } from '../config/env.js';
import { fullProbe } from '../services/smsProbe.service.js';

/*
  SMS ki jaanch browser se — Render pe shell kholne ki zarurat nahi.

      /api/diag/sms?key=<DIAG_KEY>&phone=98765xxxxx

  DIAG_KEY na ho to ye darwaza hai hi nahi (404). Isliye ise chalu karne ke
  liye Render me DIAG_KEY dalna padta hai, aur kaam ke baad hata dena.
*/

const router = Router();

router.get('/sms', async (req, res) => {
  const chaabi = (env.diagKey || '').trim();
  if (!chaabi || String(req.query.key || '') !== chaabi) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  const phone = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) {
    return res.status(400).json({ success: false, message: 'phone= me poora 10 ank ka number dein' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const message = env.sms.apitxtTemplate.replace(/\{otp\}/g, code);

  // Panel se mile sender / template ko bina redeploy ke aajmane ke liye
  const data = await fullProbe(phone, message, {
    sender: req.query.sender !== undefined ? String(req.query.sender) : undefined,
    templateId: req.query.tid !== undefined ? String(req.query.tid) : undefined,
  });
  return res.json({ success: true, bhejaGayaCode: code, ...data });
});

export default router;

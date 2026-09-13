/**
 * LOGO — ek hi jagah (Part 30).
 *
 * Yahi nishaan favicon, PWA icon (public/icon-*.png), aur poori app me jahan
 * bhi "apna" logo dikhana ho, sab jagah hai — alag-alag jagah alag chinh
 * hone ki shikayat isi se theek hui.
 *
 * Rang `var(--color-brand-700)`/`var(--color-brand-300)` se aata hai, hex
 * seedha nahi likha — isliye agar kabhi phir brand color badle
 * (`index.css`), ye khud-ba-khud naye rang me badal jayega, kahin haath
 * lagane ki zarurat nahi padegi.
 */
export default function Logo({ size = 32, className = '', rounded = true }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Rakh Rakhav"
    >
      <rect width="32" height="32" rx={rounded ? 7 : 0} fill="var(--color-brand-700)" />
      <path d="M8 12h16v2H8zm0 5h16v2H8zm0 5h11v2H8z" fill="#fff" />
      <circle cx="23" cy="23" r="3" fill="var(--color-brand-300)" />
    </svg>
  );
}

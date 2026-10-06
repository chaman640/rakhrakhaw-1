/**
 * Card/list pe dikhne wali photo. Cover na lagi ho to pehli "aur photos"
 * wali — warna seller ne sirf gallery me photo daali ho to catalog me khaali
 * dabba dikhta tha, jabki detail page pe photo aati thi.
 */
export const coverUrl = (item) => item?.imageUrl || item?.images?.[0]?.url || '';

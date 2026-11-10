// Sejf IPB: wszystkie dane użytkownika szyfrowane jego hasłem (docs/SPEC.md, sekcja 11a).
// Losowy klucz danych (DEK) szyfruje dane; DEK jest opakowany dwa razy: hasłem i kodem odzyskiwania.
const Sejf = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (u8) => { let t = ''; for (let i = 0; i < u8.length; i += 8192) t += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(t); };  // kawałkami: plan bywa duży
  const ub64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const los = (n) => crypto.getRandomValues(new Uint8Array(n));
  const ARGON = { alg: 'argon2id', m: 65536, t: 3, p: 1 };
  const PBKDF = { alg: 'pbkdf2-sha256', iter: 600000 };

  async function wyprowadz(sekret, kdf) {
    const salt = ub64(kdf.salt);
    if (kdf.alg === 'argon2id') {
      return hashwasm.argon2id({ password: sekret.normalize('NFKC'), salt, parallelism: kdf.p, iterations: kdf.t,
        memorySize: kdf.m, hashLength: 32, outputType: 'binary' });
    }
    const k = await crypto.subtle.importKey('raw', enc.encode(sekret.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: kdf.iter }, k, 256));
  }

  // Argon2id, a gdy WebAssembly jest niedostępne – PBKDF2. Użyty algorytm trafia do koperty.
  async function nowyKlucz(sekret) {
    for (const wzor of [ARGON, PBKDF]) {
      const kdf = { ...wzor, salt: b64(los(16)) };
      try { return { kdf, klucz: await wyprowadz(sekret, kdf) }; } catch (e) { if (wzor === PBKDF) throw e; }
    }
  }

  const aes = (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function szyfruj(raw, bajty) {
    const iv = los(12);
    return { iv: b64(iv), ct: b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(raw), bajty))) };
  }
  async function odszyfruj(raw, pole) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(pole.iv) }, await aes(raw), ub64(pole.ct)));
  }
  async function opakuj(sekret, dek) {
    const { kdf, klucz } = await nowyKlucz(sekret);
    return { kdf, ...(await szyfruj(klucz, dek)) };
  }

  // 32 znaki z 30-znakowego alfabetu (ok. 157 bitów), bez znaków łatwych do pomylenia
  function nowyKod() {
    const A = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
    return Array.from(los(32), (b, i) => A[b % A.length] + (i % 4 === 3 && i < 31 ? '-' : '')).join('');
  }
  const czystyKod = (k) => k.toUpperCase().replace(/[^A-Z0-9]/g, '');

  async function utworz(haslo, dane) {
    const dek = los(32), kod = nowyKod();
    const koperta = { app: 'ipb', v: 1, haslo: await opakuj(haslo, dek), kod: await opakuj(czystyKod(kod), dek),
      dane: await szyfruj(dek, enc.encode(JSON.stringify(dane))) };
    return { koperta, dek, kod };
  }

  // czym: 'haslo' albo 'kod'. Zły sekret → wyjątek (AES-GCM sprawdza integralność).
  async function otworz(koperta, sekret, czym = 'haslo') {
    if (!koperta || koperta.app !== 'ipb' || koperta.v !== 1) throw new Error('To nie jest sejf IPB w wersji 1');
    const w = koperta[czym];
    const dek = await odszyfruj(await wyprowadz(czym === 'kod' ? czystyKod(sekret) : sekret, w.kdf), w);
    return { dek, dane: JSON.parse(dec.decode(await odszyfruj(dek, koperta.dane))) };
  }

  async function zapisz(koperta, dek, dane) {
    return { ...koperta, dane: await szyfruj(dek, enc.encode(JSON.stringify(dane))) };
  }
  async function zmienHaslo(koperta, dek, noweHaslo) {
    return { ...koperta, haslo: await opakuj(noweHaslo, dek) };
  }
  return { utworz, otworz, zapisz, zmienHaslo };
})();

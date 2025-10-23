//hex/buffer
export function bufToHex(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let hex = "0x";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
export function hexToBuf(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const len = h.length / 2;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = parseInt(h.substr(i * 2, 2), 16);
  return u8.buffer;
}

// SHA-256 
export async function sha256Hex(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return bufToHex(hash);
}

//  AES-GCM (256)
export async function genAesKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt","decrypt"]);
}
export function genIv() {
  return crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
}
export async function aesEncrypt(aesKey, plainBuffer, iv) {
  return crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, plainBuffer);
}
export async function aesDecrypt(aesKey, cipherBuffer, iv) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, cipherBuffer);
}

// RSA-OAEP (SHA-256)
export async function genRsaKeypair() {
  return crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 4096, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" },
    true, ["encrypt","decrypt"]
  );
}
export async function exportPublicKeyPEM(publicKey) {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  return `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;
}
export async function exportPrivateKeyPKCS8(privateKey) {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----`;
}
export async function importPublicKeyPEM(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", der.buffer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}
export async function importPrivateKeyPKCS8(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der.buffer, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}
export async function wrapAesKeyFor(publicKey, aesKey) {
  const raw = await crypto.subtle.exportKey("raw", aesKey);
  return crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, raw);
}
export async function unwrapAesKey(privateKey, wrappedBuffer) {
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrappedBuffer);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt","decrypt"]);
}

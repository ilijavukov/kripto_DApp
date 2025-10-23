
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContract } from "./web3/contract";
import {
  sha256Hex, genAesKey, genIv, aesEncrypt, aesDecrypt,
  genRsaKeypair, exportPublicKeyPEM, exportPrivateKeyPKCS8,
  importPublicKeyPEM, importPrivateKeyPKCS8,
  wrapAesKeyFor, unwrapAesKey, bufToHex, hexToBuf
} from "./crypto/crypto";

// IPFS helper: Pinata
import { uploadBytes, downloadToArrayBuffer } from "./ipfs/pinata";

import "./style.css";
export default function App() {
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState("");
  const [docId, setDocId] = useState(null);

  // --- za deljenje ---
  const [myPubPEM, setMyPubPEM] = useState("");
  const [recipientAddr, setRecipientAddr] = useState("");
  const [recipientPubPEM, setRecipientPubPEM] = useState("");

  const keyNames = (addr) => ({
    pub: `rsaPubPEM:${addr?.toLowerCase()}`,
    priv: `rsaPrivPEM:${addr?.toLowerCase()}`,
  });

  useEffect(() => {
    (async () => {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== 11155111) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
        } catch {}
      }
    })();
  }, []);

  async function connect() {
    if (!window.ethereum) return alert("Install MetaMask");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    setAccount(await signer.getAddress());
  }

  // učitava RSA par za TRENUTNI nalog (čuva u localStorage)
  async function ensureMyKeys() {
    if (!account) throw new Error("Connect MetaMask first");
    const names = keyNames(account);

    const spub = localStorage.getItem(names.pub);
    const spriv = localStorage.getItem(names.priv);
    if (spub && spriv) {
      setMyPubPEM(spub);
      return {
        pub: await importPublicKeyPEM(spub),
        priv: await importPrivateKeyPKCS8(spriv),
        pubPEM: spub,
      };
    }
    const { publicKey, privateKey } = await genRsaKeypair();
    const pubPEM = await exportPublicKeyPEM(publicKey);
    const privPEM = await exportPrivateKeyPKCS8(privateKey);
    localStorage.setItem(names.pub, pubPEM);
    localStorage.setItem(names.priv, privPEM);
    setMyPubPEM(pubPEM);
    return { pub: publicKey, priv: privateKey, pubPEM };
  }

  async function handleUploadRegister(e) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!account) await connect();

      setStatus("Preparing my RSA keys…");
      const { pub } = await ensureMyKeys();

      setStatus("Encrypting (AES-GCM) …");
      const plain = await file.arrayBuffer();
      const aesKey = await genAesKey();
      const iv = genIv();
      const cipher = await aesEncrypt(aesKey, plain, iv);

      // spakuj IV + ciphertext
      const packed = new Uint8Array(iv.length + cipher.byteLength);
      packed.set(iv, 0);
      packed.set(new Uint8Array(cipher), iv.length);

      setStatus("Uploading to IPFS …");
      const cid = await uploadBytes(packed, file.name + ".enc");

      setStatus("Hashing (SHA-256 cipher-bytes) …");
      const hashHex = await sha256Hex(packed.buffer);

      setStatus("Wrapping AES for ME (RSA-OAEP) …");
      const wrapped = await wrapAesKeyFor(pub, aesKey);
      const wrappedHex = bufToHex(wrapped);

      setStatus("Registering on-chain …");
      const contract = await getContract();
      const tx = await contract.registerDocument(cid, hashHex, wrappedHex);
      await tx.wait();

      const id = Number(await contract.nextId());
      setDocId(id);
      // originalno ime 
      localStorage.setItem(`origName:${id}`, file.name);

      setStatus(`Registered! docId=${id}, CID=${cid}`);
    } catch (err) {
      console.error(err);
      setStatus(String(err.message || err));
    }
  }

  async function downloadAndDecrypt() {
    try {
      if (!account) await connect();
      if (!docId) return alert("Prvo registruj (docId je prazan).");

      const contract = await getContract();

      setStatus("Loading metadata…");
      const [owner, cid, docHash] = await contract.getMetadata(docId);

      setStatus("Ensuring my RSA keys…");
      const { priv } = await ensureMyKeys();

      setStatus("Fetching MY wrapped key …");
      const wrappedHex = await contract.getEncryptedKey(docId, account);
      if (!wrappedHex || wrappedHex === "0x") return alert("Ovaj nalog nema dodeljen ključ za ovaj dokument.");

      setStatus("Unwrapping AES …");
      const aesKey = await unwrapAesKey(priv, hexToBuf(wrappedHex));

      setStatus("Downloading from IPFS …");
      const packed = await downloadToArrayBuffer(cid);

      setStatus("Verifying hash …");
      const calc = await sha256Hex(packed);
      if (calc.toLowerCase() !== docHash.toLowerCase()) {
        return alert("HASH MISMATCH – integritet narušen.");
      }

      const bytes = new Uint8Array(packed);
      const iv = bytes.slice(0, 12);
      const cipher = bytes.slice(12).buffer;

      setStatus("Decrypting …");
      const plain = await aesDecrypt(aesKey, cipher, iv);

      const blob = new Blob([plain], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const origName = localStorage.getItem(`origName:${docId}`) || "decrypted.bin";
      a.href = url; a.download = origName;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Decrypted and downloaded.");
    } catch (err) {
      console.error(err);
      setStatus(String(err.message || err));
    }
  }

  // GRANT ACCESS 
  async function grantAccess() {
    try {
      if (!account) await connect();
      if (!docId) return alert("docId je prazan. Prvo registruj dokument.");
      if (!recipientAddr || !recipientPubPEM) return alert("Unesi adresu primaoca i njegov PUBLIC KEY (PEM).");

      const contract = await getContract();

      setStatus("Ensuring my RSA keys…");
      const { priv } = await ensureMyKeys();

      setStatus("Fetching MY wrapped key …");
      const myWrappedHex = await contract.getEncryptedKey(docId, account);
      if (!myWrappedHex || myWrappedHex === "0x") {
        return alert("Owner wrapped key nije zapisan (ponovi upload/register).");
      }

      setStatus("Unwrapping AES (owner private key) …");
      const aesKey = await unwrapAesKey(priv, hexToBuf(myWrappedHex));

      setStatus("Importing recipient PUBLIC key …");
      const recipPub = await importPublicKeyPEM(recipientPubPEM);

      setStatus("Wrapping AES for recipient …");
      const recipWrapped = await wrapAesKeyFor(recipPub, aesKey);
      const recipWrappedHex = bufToHex(recipWrapped);

      setStatus("Calling grantAccess …");
      const tx = await contract.grantAccess(docId, recipientAddr, recipWrappedHex);
      await tx.wait();

      setStatus("Access granted!");
    } catch (err) {
      console.error(err);
      setStatus(String(err.message || err));
    }
  }

  async function showMyPublicKey() {
    try {
      const { pubPEM } = await ensureMyKeys();
      setMyPubPEM(pubPEM);
    } catch (e) {
      setStatus(String(e.message || e));
    }
  }

  return (
  <div className="container">
    <div className="header">
      <div>
        <h1 className="title">Kripto_DApp [Sepolia + IPFS(pinata)]</h1>
        <p className="subtitle">AES-GCM enkripcija • IPFS pinning • on-chain integritet i pristup</p>
      </div>
      <button className="btn btn-primary" onClick={connect}>
        {account ? `Connected: ${account.slice(0,6)}…${account.slice(-4)}` : "Connect MetaMask"}
      </button>
    </div>

    <section className="section">
      <h3>1) Upload & Register (owner-wrapped key)</h3>
      <label className="label">Izaberi fajl (bilo koji tip)</label>
      <input className="file" type="file" onChange={handleUploadRegister}/>
      <div className="kv">doc Id: <span className="mono">{docId ?? "-"}</span></div>
    </section>

    <section className="section">
      <h3>2) Download & Decrypt (current account)</h3>
      <button className="btn btn-primary" onClick={downloadAndDecrypt}>Download & Decrypt</button>
    </section>

    <section className="section">
      <h3>3) My RSA Public Key (share this with the owner)</h3>
      <div className="grid">
       <button className="btn btn-primary" onClick={showMyPublicKey}>
          Generate/Show My Public Key
      </button>
        <textarea className="textarea mono" value={myPubPEM} readOnly placeholder="Your PUBLIC KEY (PEM) will appear here"/>
      </div>
    </section>

    <section className="section">
      <h3>4) Grant Access to someone</h3>
      <div className="grid">
        <div>
          <label className="label">Recipient Ethereum address (0x…)</label>
          <input className="input mono" placeholder="0x..." value={recipientAddr} onChange={(e)=>setRecipientAddr(e.target.value)}/>
        </div>
        <div>
          <label className="label">Recipient PUBLIC KEY (PEM)</label>
          <textarea className="textarea mono" placeholder="-----BEGIN PUBLIC KEY-----" value={recipientPubPEM} onChange={(e)=>setRecipientPubPEM(e.target.value)}/>
        </div>
        <button className="btn btn-primary btn-block" onClick={grantAccess}>Grant access</button>
      </div>
    </section>

  </div>
);
}


function getJwt() {
  const t = (import.meta.env.VITE_PINATA_JWT || "").trim();
  if (!t) throw new Error("Missing VITE_PINATA_JWT");
  return t;
}

// Upload enkriptovanih bajtova kao datoteka 
export async function uploadBytes(bytes, name = "encrypted.bin") {
  const jwt = getJwt();

  const form = new FormData();
  const file = new File([bytes], name, { type: "application/octet-stream" });
  form.append("file", file);
    form.append(
    "pinataMetadata",
    JSON.stringify({ name, keyvalues: { app: "securedocs" } })
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`pinFileToIPFS failed: ${res.status} ${res.statusText} ${text}`);
  }

  
  const cid = json?.IpfsHash || json?.cid || json?.value?.cid;
  if (!cid) throw new Error(`pinFileToIPFS response missing CID: ${text}`);
  return cid;
}

// Download sa više gateway-a (prvi koji radi)
export async function downloadToArrayBuffer(cid) {
  const urls = [
    `https://${cid}.ipfs.dweb.link`,          // subdomain gateway 
    `https://ipfs.io/ipfs/${cid}`,
    `https://w3s.link/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`, 
  ];
  const errors = [];
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store", mode: "cors" });
      if (res.ok) return await res.arrayBuffer();
      errors.push(`${u} -> ${res.status} ${res.statusText}`);
    } catch (e) {
      errors.push(`${u} -> ${e.message || e}`);
    }
  }
  throw new Error("IPFS fetch failed on all gateways:\n" + errors.join("\n"));
}

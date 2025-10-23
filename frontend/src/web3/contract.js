
import { ethers } from "ethers";

export const CONTRACT_ADDRESS = "0x62bf358023c9C5A38be83177EC0237d0F7c9A04E"; 

export const CONTRACT_ABI = [
  {
    "inputs":[
      {"internalType":"string","name":"ipfsCid","type":"string"},
      {"internalType":"bytes32","name":"docHash","type":"bytes32"},
      {"internalType":"bytes","name":"ownerWrappedKey","type":"bytes"}
    ],
    "name":"registerDocument","outputs":[{"internalType":"uint256","name":"docId","type":"uint256"}],
    "stateMutability":"nonpayable","type":"function"
  },
  {
    "inputs":[
      {"internalType":"uint256","name":"docId","type":"uint256"},
      {"internalType":"address","name":"to","type":"address"},
      {"internalType":"bytes","name":"wrappedKey","type":"bytes"}
    ],
    "name":"grantAccess","outputs":[],"stateMutability":"nonpayable","type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"docId","type":"uint256"},{"internalType":"address","name":"user","type":"address"}],
    "name":"getEncryptedKey","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],
    "stateMutability":"view","type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"docId","type":"uint256"}],
    "name":"getMetadata",
    "outputs":[
      {"internalType":"address","name":"owner","type":"address"},
      {"internalType":"string","name":"ipfsCid","type":"string"},
      {"internalType":"bytes32","name":"docHash","type":"bytes32"},
      {"internalType":"uint256","name":"createdAt","type":"uint256"}],
    "stateMutability":"view","type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"docId","type":"uint256"}],
    "name":"getSharedWith","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],
    "stateMutability":"view","type":"function"
  },
  {
    "inputs":[{"internalType":"uint256","name":"docId","type":"uint256"},{"internalType":"bytes32","name":"providedHash","type":"bytes32"}],
    "name":"checkIntegrity","outputs":[{"internalType":"bool","name":"ok","type":"bool"}],
    "stateMutability":"nonpayable","type":"function"
  },
  {"inputs":[],"name":"nextId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

export async function getContract() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

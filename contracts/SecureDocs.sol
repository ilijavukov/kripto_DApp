// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SecureDocs {
    struct Document {
        address owner;
        string ipfsCid;
        bytes32 docHash;       // SHA-256(ciphertext)
        uint256 createdAt;
        mapping(address => bool) canAccess;
        mapping(address => bytes) encKeys; // wrapped AES key per user
        address[] sharedWith;
    }

    uint256 public nextId;
    mapping(uint256 => Document) private docs;
    mapping(address => uint256[]) private ownedDocs;

    event DocumentRegistered(uint256 indexed docId, address indexed owner, string ipfsCid, bytes32 docHash, uint256 timestamp);
    event AccessGranted(uint256 indexed docId, address indexed to, bytes encKey);
    event AccessRevoked(uint256 indexed docId, address indexed from);
    event IntegrityChecked(uint256 indexed docId, address indexed caller, bool ok, bytes32 providedHash, uint256 timestamp);

    modifier onlyDocOwner(uint256 docId) {
        require(docs[docId].owner == msg.sender, "Not document owner");
        _;
    }

    function registerDocument(
        string calldata ipfsCid,
        bytes32 docHash,
        bytes calldata ownerWrappedKey
    ) external returns (uint256 docId) {
        docId = ++nextId;
        Document storage d = docs[docId];
        d.owner = msg.sender;
        d.ipfsCid = ipfsCid;
        d.docHash = docHash;
        d.createdAt = block.timestamp;

        d.canAccess[msg.sender] = true;
        if (ownerWrappedKey.length > 0) {
            d.encKeys[msg.sender] = ownerWrappedKey;
            d.sharedWith.push(msg.sender);
        }

        ownedDocs[msg.sender].push(docId);
        emit DocumentRegistered(docId, msg.sender, ipfsCid, docHash, block.timestamp);
    }

    function grantAccess(uint256 docId, address to, bytes calldata wrappedKey)
        external
        onlyDocOwner(docId)
    {
        require(to != address(0), "Bad address");
        Document storage d = docs[docId];
        if (!d.canAccess[to]) {
            d.sharedWith.push(to);
        }
        d.canAccess[to] = true;
        d.encKeys[to] = wrappedKey;
        emit AccessGranted(docId, to, wrappedKey);
    }

    function revokeAccess(uint256 docId, address from) external onlyDocOwner(docId) {
        Document storage d = docs[docId];
        require(d.canAccess[from], "No access");
        d.canAccess[from] = false;
        delete d.encKeys[from];
        emit AccessRevoked(docId, from);
    }

    function hasAccess(uint256 docId, address user) public view returns (bool) {
        return docs[docId].canAccess[user];
    }

    function getEncryptedKey(uint256 docId, address user) external view returns (bytes memory) {
        Document storage d = docs[docId];
        require(msg.sender == d.owner || msg.sender == user, "Not allowed");
        require(d.canAccess[user], "User has no access");
        return d.encKeys[user];
    }

    function getMetadata(uint256 docId)
        external
        view
        returns (address owner, string memory ipfsCid, bytes32 docHash, uint256 createdAt)
    {
        Document storage d = docs[docId];
        owner = d.owner;
        ipfsCid = d.ipfsCid;
        docHash = d.docHash;
        createdAt = d.createdAt;
    }

    function getSharedWith(uint256 docId) external view returns (address[] memory) {
        return docs[docId].sharedWith;
    }

    function listOwnedDocs(address user) external view returns (uint256[] memory) {
        return ownedDocs[user];
    }

    function checkIntegrity(uint256 docId, bytes32 providedHash) external returns (bool ok) {
        ok = (docs[docId].docHash == providedHash);
        emit IntegrityChecked(docId, msg.sender, ok, providedHash, block.timestamp);
    }
}

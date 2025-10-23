const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SecureDocs", function () {
  let sd, owner, alice, bob;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory("SecureDocs");
    sd = await F.deploy();
    await sd.waitForDeployment();
  });

  it("registers document and sets owner access", async () => {
    const ipfsCid = "bafyTEST";
    const hash = "0x" + "11".repeat(32);

    const tx = await sd.registerDocument(ipfsCid, hash, "0x");
    await tx.wait();

    const docId = Number(await sd.nextId());
    const [ownerAddr, cid2, docHash] = await sd.getMetadata(docId);

    expect(ownerAddr).to.equal(owner.address);
    expect(cid2).to.equal(ipfsCid);
    expect(docHash.toLowerCase()).to.equal(hash.toLowerCase());
    expect(await sd.hasAccess(docId, owner.address)).to.equal(true);
  });

  it("owner can grant and revoke", async () => {
    const hash = "0x" + "22".repeat(32);
    await (await sd.registerDocument("cid2", hash, "0x")).wait();
    const docId = Number(await sd.nextId());

    await (await sd.grantAccess(docId, alice.address, "0x1234")).wait();
    expect(await sd.hasAccess(docId, alice.address)).to.equal(true);

    const wrapped = await sd.getEncryptedKey(docId, alice.address);
    expect(wrapped).to.equal("0x1234");

    await (await sd.revokeAccess(docId, alice.address)).wait();
    expect(await sd.hasAccess(docId, alice.address)).to.equal(false);
  });

  it("non-owner cannot grant", async () => {
    await (await sd.registerDocument("cid3", "0x" + "33".repeat(32), "0x")).wait();
    const docId = Number(await sd.nextId());

    await expect(
      sd.connect(alice).grantAccess(docId, alice.address, "0x1234")
    ).to.be.revertedWith("Not document owner");
  });

  it("integrity check static call", async () => {
    const good = "0x" + "44".repeat(32);
    await (await sd.registerDocument("cid4", good, "0x")).wait();
    const docId = Number(await sd.nextId());

    const ok = await sd.checkIntegrity.staticCall(docId, good);
    expect(ok).to.equal(true);

    const bad = "0x" + "55".repeat(32);
    const ok2 = await sd.checkIntegrity.staticCall(docId, bad);
    expect(ok2).to.equal(false);
  });
});

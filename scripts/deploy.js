const hre = require("hardhat");

async function main() {
  const Factory = await hre.ethers.getContractFactory("SecureDocs");
  const sd = await Factory.deploy();
  await sd.waitForDeployment();
  console.log("SecureDocs deployed to:", await sd.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import * as hre from 'hardhat';
import {
  IBlast__factory,
  IDOPool__factory,
  LockedStakingPools__factory,
  YieldToken__factory,
} from '../typechain';

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const { deployments, ethers } = hre;
  const { get } = deployments;
  const pool = await get('IDOPool');
  const poolContract = IDOPool__factory.connect(pool.address, deployer);

  const fyETH = await get('fyETH');
  const ethContract = YieldToken__factory.connect(fyETH.address, deployer);

  const stakePool = await get('LockedStakingPools');
  const stakeContract = LockedStakingPools__factory.connect(
    stakePool.address,
    deployer
  );

  const blast = IBlast__factory.connect(
    '0x4300000000000000000000000000000000000002',
    deployer,
  );

  // console.log("treasury", await stakeContract.treasury());

  const claimable = await blast.readClaimableYield(stakePool.address);
  console.log("claimable:", claimable)
  const initBal = await ethers.provider.getBalance(deployer.address);
  const tx = await stakeContract.claimNativeYield();
  const receipt = await tx.wait();
  if (!receipt) return;
  const fee = receipt?.gasPrice * receipt?.gasUsed;
  // console.log(await blast.readClaimableYield(stakePool.address));
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("balance change:", balance - initBal);
  console.log("fee used:", fee);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

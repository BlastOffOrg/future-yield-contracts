import * as hre from 'hardhat';
import {
  IBlast__factory,
  LockedStakingPools__factory,
  NonLockStakingPools__factory,
  RoleControl__factory,
  YieldToken__factory,
} from '../typechain';

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const { deployments, ethers } = hre;
  const { get } = deployments;

  const fyETH = await get('fyETH');
  const fyUSD = await get('fyUSD');
  const role = await get('RoleControl');

  const roleContract = RoleControl__factory.connect(role.address, deployer);

  const ethContract = YieldToken__factory.connect(fyETH.address, deployer);

  const fyETHCont = YieldToken__factory.connect(fyETH.address, deployer);
  const fyUSDCont = YieldToken__factory.connect(fyUSD.address, deployer);

  const stakePool = await get('LockedStakingPools');
  const stakeContract = LockedStakingPools__factory.connect(
    stakePool.address,
    deployer
  );

  const nonlock = await get('NonLockStakingPools');
  const nonlockContract = NonLockStakingPools__factory.connect(
    nonlock.address,
    deployer
  );

  // const blast = IBlast__factory.connect(
  //   '0x4300000000000000000000000000000000000002',
  //   deployer
  // );

  // // await stakeContract.setUSDBRebasing(
  // //   '0x4200000000000000000000000000000000000022'
  // // );

  // // await stakeContract.addSupportYieldTokens(
  // //   '0x4200000000000000000000000000000000000022',
  // //   fyUSD.address
  // // );

  // await stakeContract.addLockedPools(
  //   15552000,
  //   5000,
  //   '0x4200000000000000000000000000000000000022'
  // );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

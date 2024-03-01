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

  const blast = IBlast__factory.connect(
    '0x4300000000000000000000000000000000000002',
    deployer
  );

  await nonlockContract.setBlast(blast.address);
  await nonlockContract.setUSDBRebasing(
    '0x4300000000000000000000000000000000000003'
  );
  await nonlockContract.configurePointsOperator(
    deployer.address,
    '0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800'
  );
  await nonlockContract.addSupportYieldTokens(
    ethers.constants.AddressZero,
    fyETH.address
  );
  await nonlockContract.addSupportYieldTokens(
    '0x4300000000000000000000000000000000000003',
    fyUSD.address
  );
  await nonlockContract.addPool(
    4000,
    ethers.constants.AddressZero,
  )

  // await stakeContract.setUSDBRebasing(
  //   '0x4300000000000000000000000000000000000003'
  // );
  // await stakeContract.configurePointsOperator(
  //   deployer.address,
  //   '0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800'
  // );
  // await stakeContract.addSupportYieldTokens(
  //   ethers.constants.AddressZero,
  //   fyETH.address
  // );
  // await stakeContract.addSupportYieldTokens(
  //   '0x4300000000000000000000000000000000000003',
  //   fyUSD.address
  // );
  // await stakeContract.addLockedPools(
  //   157680000,
  //   4000,
  //   ethers.constants.AddressZero
  // );

  // await stakeContract.addLockedPools(
  //   BigNumber.from('157680000'),
  //   4000,
  //   fyETH.address
  // );
  // const poolAdmin = await stakeContract.POOL_ADMIN_ROLE();
  // console.log(await roleContract.hasRole(poolAdmin, deployer.address));

  // await fyETHCont.whitelistAddress(deployer.address);

  // await fyETHCont.setEnableWhitelist(false);

  // console.log(await stakeContract.yieldTokens(ethers.constants.AddressZero));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

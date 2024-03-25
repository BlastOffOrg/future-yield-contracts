import * as hre from 'hardhat';
import {
  IBlast__factory,
  IERC20Rebasing__factory,
  LockedStakingPools__factory,
  NonLockStakingPools__factory,
  RoleControl__factory,
  YieldToken__factory,
} from '../typechain';
import { config } from '../config';

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const { deployments, ethers, network } = hre;
  const { get } = deployments;

  let conf = config[network.name];
  if (!conf) {
    conf = config['default'];
  }
  console.log(conf);

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

  await stakeContract.setBlast(conf.blast);
  await nonlockContract.setBlast(conf.blast);

  await stakeContract.setUSDBRebasing(conf.usdb);
  await nonlockContract.setUSDBRebasing(conf.usdb);
  await stakeContract.addSupportYieldTokens(
    ethers.constants.AddressZero,
    fyETH.address
  );
  await stakeContract.addSupportYieldTokens(conf.usdb, fyUSD.address);
  await nonlockContract.addSupportYieldTokens(
    ethers.constants.AddressZero,
    fyETH.address
  );
  await nonlockContract.addSupportYieldTokens(conf.usdb, fyUSD.address);

  await stakeContract.setTreasury(deployer.address);
  await nonlockContract.setTreasury(deployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import * as hre from 'hardhat';
import {
  IBlast__factory,
  LockedStakingPools__factory,
  YieldToken__factory,
} from '../typechain';
import { Contract } from 'ethers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const { deployments, ethers } = hre;
  const { get } = deployments;

  const fyETH = await get('fyETH');
  const ethContract = YieldToken__factory.connect(fyETH.address, deployer);

  const stakePool = await get('LockedStakingPools');
  const stakeContract = LockedStakingPools__factory.connect(
    stakePool.address,
    deployer
  );

  const blast = IBlast__factory.connect(
    '0x4300000000000000000000000000000000000002',
    deployer
  );

  // console.log("treasury", await stakeContract.treasury());

  await ethContract.approve(stakePool.address, ethers.utils.parseEther('1000'));

  console.log(await stakeContract.repayWithYieldToken(0, 0));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

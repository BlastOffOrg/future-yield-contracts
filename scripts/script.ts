import * as hre from 'hardhat';
import {
  IBlast__factory,
  IERC20Rebasing__factory,
  LockedStakingPools__factory,
  NonLockStakingPools__factory,
  RoleControl__factory,
  YieldToken__factory,
} from '../typechain';
import address from './address.json';
import { BigNumber } from 'ethers';
import { createWriteStream, readFileSync } from 'fs';
import { appendFile } from 'fs/promises';

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

  console.log(address.length);

  for (const addr of address) {
    try {
      const eth = await nonlockContract.getUserStakePosition(0, addr);
      const usd = await nonlockContract.getUserStakePosition(1, addr);
      const eth_amount = eth.amount.div(BigNumber.from(10n ** 12n)).toString();
      const usd_amount = usd.amount.div(BigNumber.from(10n ** 12n)).toString();
      if (eth.amount.toString() !== '0' || usd.amount.toString() !== '0') {
        const sql = `update blast_points set staking_eth = ${eth_amount}, staking_usd = ${usd_amount} where address = lower("${addr}");\n`;
        console.log(sql);
        await appendFile('./scripts/script.sql', sql);
      }
    } catch (err) {
      console.error('error at', addr);
      break
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

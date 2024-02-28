import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  LockedStakingPools__factory,
  RoleControl__factory,
  YieldToken__factory,
} from '../typechain';

module.exports = async ({ ethers, deployments }: HardhatRuntimeEnvironment) => {
  // const [deployer] = await ethers.getSigners();
  // console.log('deployed by:', deployer.address);

  // const { deploy, get } = deployments;

  // const roleControl = await get('RoleControl');
  // const fyEth = await get('fyETH');

  // const pool = await deploy('NonLockStakingPools', {
  //   from: deployer.address,
  //   log: true,
  //   proxy: {
  //     execute: {
  //       init: {
  //         methodName: 'init',
  //         args: [roleControl.address, ethers.constants.AddressZero],
  //       },
  //     },
  //   },
  // });

  // const roleContract = RoleControl__factory.connect(
  //   roleControl.address,
  //   deployer
  // );
  // const fyEthContract = YieldToken__factory.connect(fyEth.address, deployer);
  // const poolContract = LockedStakingPools__factory.connect(
  //   pool.address,
  //   deployer
  // );
  // const mintRole = await fyEthContract.MINTING_ROLE();
  // const poolAdminRole = await poolContract.POOL_ADMIN_ROLE();

  // if (!(await roleContract.hasRole(poolAdminRole, deployer.address))) {
  //   console.log('Grant admin role to deployer...');
  //   const tx = await roleContract.grantRole(poolAdminRole, deployer.address);
  //   const rec = await tx.wait();
  //   console.log(
  //     `tx ${rec?.transactionHash} completed using ${rec?.gasUsed} wei`
  //   );
  // }
  // if (!(await roleContract.hasRole(mintRole, pool.address))) {
  //   console.log('Grant mint role to staking pools...');
  //   const tx = await roleContract.grantRole(mintRole, pool.address);
  //   const rec = await tx.wait();
  //   console.log(
  //     `tx ${rec?.transactionHash} completed using ${rec?.gasUsed} wei`
  //   );
  // }
};

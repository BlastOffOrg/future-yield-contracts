import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  LockedStakingPools__factory,
  RoleControl__factory,
  YieldToken__factory,
} from '../typechain';

module.exports = async ({ ethers, deployments }: HardhatRuntimeEnvironment) => {
  const [deployer] = await ethers.getSigners();
  console.log('deployed by:', deployer.address);

  const { deploy, get, execute } = deployments;

  const fyEth = await get('fyETH');
  const fyUSD = await get('fyUSD');

  const usdPool = await deploy('USDIDOPool', {
    from: deployer.address,
    log: true,
  });
  const ethPool = await deploy('ETHIDOPool', {
    from: deployer.address,
    log: true,
  });
  // await execute(
  //   'USDIDOPool',
  //   {
  //     log: true,
  //     from: deployer.address,
  //   },
  //   'init',
  //   '0x4200000000000000000000000000000000000022',
  //   fyUSD.address,
  //   ethers.constants.AddressZero,
  //   18,
  //   deployer.address
  // );
  // await execute(
  //   'ETHIDOPool',
  //   {
  //     log: true,
  //     from: deployer.address,
  //   },
  //   'init',
  //   fyEth.address,
  //   ethers.constants.AddressZero,
  //   18,
  //   deployer.address,
  //   false
  // );
};

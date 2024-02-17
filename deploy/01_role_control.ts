import { HardhatRuntimeEnvironment } from 'hardhat/types';

module.exports = async ({ ethers, deployments }: HardhatRuntimeEnvironment) => {
  const [deployer] = await ethers.getSigners();
  console.log('deployed by:', deployer.address);

  const { deploy } = deployments;

  // await deploy('RoleControl', {
  //   from: deployer.address,
  //   log: true,
  //   proxy: {
  //     proxyContract: 'OpenZeppelinTransparentProxy',
  //     execute: {
  //       init: {
  //         methodName: 'init',
  //         args: [],
  //       },
  //     },
  //   },
  // });
};

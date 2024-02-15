import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { RoleControl__factory, YieldToken__factory } from '../typechain';

module.exports = async ({ ethers, deployments }: HardhatRuntimeEnvironment) => {
  const [deployer] = await ethers.getSigners();
  console.log('deployed by:', deployer.address);

  const { deploy, get } = deployments;
  const roleControl = await get('RoleControl');

  const eth = await deploy('fyETH', {
    from: deployer.address,
    args: ['future yield ETH', 'fyETH', roleControl.address],
    contract: 'YieldToken',
    log: true,
  });

  const usdb = await deploy('fyUSDB', {
    from: deployer.address,
    args: ['future yield USDB', 'USDB', roleControl.address],
    contract: 'YieldToken',
    log: true,
  });

  const fyETHContract = YieldToken__factory.connect(eth.address, deployer);
  const roleContract = RoleControl__factory.connect(roleControl.address, deployer);

  const whitelistRole = await fyETHContract.WHITELIST_ADMIN();

  if (!(await roleContract.hasRole(whitelistRole, deployer.address))) {
    console.log('grant whitelist admin role for deployer...')
    const tx = await roleContract.grantRole(whitelistRole, deployer.address);
    const rec = await tx.wait();
    console.log(`tx ${rec?.hash} completed using ${rec?.gasUsed} wei`);
  }
  
};

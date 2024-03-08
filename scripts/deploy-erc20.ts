import { ethers, deployments } from 'hardhat';
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { Contract } from 'ethers';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('deployed by:', deployer.address);

  const factory = await ethers.getContractFactory('MockERC20', deployer);
  const token = await factory.deploy();
  console.log('MockERC20 deployed to:', token.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

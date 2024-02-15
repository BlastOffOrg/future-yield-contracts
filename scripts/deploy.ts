import {ethers} from 'hardhat';
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { Contract } from 'ethers';

async function main() {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory('PriceOracle', deployer);

  const pool = await factory.deploy(false);
  const contract = new Contract(pool.address, pool.interface, deployer)

  console.log('deployed: ', pool.address);
  const wrappedContract = WrapperBuilder.wrap(contract).usingDataService({
    dataFeeds: ['ETH'],
  });
  const price = await wrappedContract.getETHPrice();
  console.log('price', price);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

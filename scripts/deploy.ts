import { ethers, deployments } from 'hardhat';
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { Contract } from 'ethers';

const USDB = '0x4200000000000000000000000000000000000022';
const START_DATE = 0;
const END_DATE = 0;
const MIN_FUNDING = 0;
const IDO_PRICE = 4n * 10n ** 17n;
const IDO_TOKEN = '0xe83838a5B3776e728C8Ce4CAD994703402cFE13E';

async function main() {
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
  await execute(
    'USDIDOPool',
    {
      log: true,
      from: deployer.address,
    },
    'init',
    USDB,
    fyUSD.address,
    IDO_TOKEN,
    18,
    deployer.address,
    START_DATE,
    END_DATE,
    MIN_FUNDING,
    IDO_PRICE
  );
  await execute(
    'ETHIDOPool',
    {
      log: true,
      from: deployer.address,
    },
    'init',
    fyEth.address,
    IDO_TOKEN,
    18,
    deployer.address,
    false,
    START_DATE,
    END_DATE,
    MIN_FUNDING,
    IDO_PRICE
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

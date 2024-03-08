import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { ethers, deployments } from 'hardhat';
import {
  BlastMock,
  ETHIDOPool,
  LockedStakingPools,
  MockERC20,
  MockRebaseERC20,
  NonLockStakingPools,
  RoleControl,
  USDIDOPool,
  YieldToken,
} from '../../typechain';

const { deploy } = deployments;

const deployWithProxy = async (
  deployer: SignerWithAddress,
  contractName: string,
  args: any[]
) => {
  const factory = await ethers.getContractFactory(contractName, deployer);
  const proxyFact = await ethers.getContractFactory('TestProxy', deployer);
  const impl = await factory.deploy();
  const proxy = await proxyFact.deploy(
    impl.address,
    factory.interface.encodeFunctionData('init', args)
  );
  return factory.attach(proxy.address);
};

export const deployRole = async (
  deployer: SignerWithAddress
): Promise<RoleControl> => {
  const role = (await deployWithProxy(
    deployer,
    'RoleControl',
    []
  )) as RoleControl;

  return role;
};

export const deployYield = async (
  deployer: SignerWithAddress,
  name: string,
  symbol: string,
  role: RoleControl
): Promise<YieldToken> => {
  const factory = await ethers.getContractFactory('YieldToken', deployer);

  const token = await factory.deploy(name, symbol, role.address);
  const whitelistRole = await token.WHITELIST_ADMIN();

  await role.grantRole(whitelistRole, deployer.address);

  return token;
};

export const deployMockBlast = async (
  deployer: SignerWithAddress
): Promise<BlastMock> => {
  const factory = await ethers.getContractFactory('BlastMock', deployer);

  return factory.deploy();
};

export const deployMockUSDB = async (
  deployer: SignerWithAddress
): Promise<MockRebaseERC20> => {
  const factory = await ethers.getContractFactory('MockRebaseERC20', deployer);

  return factory.deploy();
};

export const deployLockedStaking = async (
  deployer: SignerWithAddress,
  role: RoleControl,
  treasury: string
): Promise<LockedStakingPools> => {
  const staking = (await deployWithProxy(deployer, 'LockedStakingPools', [
    role.address,
    treasury,
  ])) as LockedStakingPools;

  const adminRole = await staking.POOL_ADMIN_ROLE();
  await role.connect(deployer).grantRole(adminRole, deployer.address);

  return staking;
};

export const setupLockedStaking = async (
  deployer: SignerWithAddress,
  role: RoleControl,
  staking: LockedStakingPools,
  stakingToken: string,
  yieldToken: YieldToken
) => {
  const mintRole = await yieldToken.MINTING_ROLE();
  await role.connect(deployer).grantRole(mintRole, staking.address);
  await yieldToken.whitelistAddress(staking.address);
  await staking
    .connect(deployer)
    .addSupportYieldTokens(stakingToken, yieldToken.address);
};

export const deployNonLockStaking = async (
  deployer: SignerWithAddress,
  role: RoleControl,
  treasury: string
): Promise<NonLockStakingPools> => {
  const staking = (await deployWithProxy(deployer, 'NonLockStakingPools', [
    role.address,
    treasury,
  ])) as NonLockStakingPools;

  const adminRole = await staking.POOL_ADMIN_ROLE();
  await role.connect(deployer).grantRole(adminRole, deployer.address);

  return staking;
};

export const setupNonLockStaking = async (
  deployer: SignerWithAddress,
  role: RoleControl,
  staking: NonLockStakingPools,
  stakingToken: string,
  yieldToken: YieldToken
) => {
  const mintRole = await yieldToken.MINTING_ROLE();
  await role.connect(deployer).grantRole(mintRole, staking.address);
  await yieldToken.whitelistAddress(staking.address);
  await staking
    .connect(deployer)
    .addSupportYieldTokens(stakingToken, yieldToken.address);
};

export const deployETHIDOPool = async (
  deployer: SignerWithAddress,
  fyETH: string,
  idoToken: string,
  idoDecimals: BigNumberish,
  treasury: string,
  idoStart: number,
  idoEnd: number,
  minimuFund: BigNumberish,
  price: BigNumberish
): Promise<ETHIDOPool> => {
  const factory = await ethers.getContractFactory('ETHIDOPool', deployer);
  const idoPool = await factory.deploy();
  await idoPool.init(
    fyETH,
    idoToken,
    idoDecimals,
    treasury,
    true,
    idoStart,
    idoEnd,
    minimuFund,
    price
  );
  return idoPool;
};

export const deployUSDIDOPool = async (
  deployer: SignerWithAddress,
  usdb: string,
  fyUSD: string,
  idoToken: string,
  idoDecimals: BigNumberish,
  treasury: string,
  idoStart: number,
  idoEnd: number,
  minimuFund: BigNumberish,
  price: BigNumberish
): Promise<USDIDOPool> => {
  const factory = await ethers.getContractFactory('USDIDOPool', deployer);
  const idoPool = await factory.deploy();
  await idoPool.init(
    usdb,
    fyUSD,
    idoToken,
    idoDecimals,
    treasury,
    idoStart,
    idoEnd,
    minimuFund,
    price
  );
  return idoPool;
};

export const deployMockERC20 = async (
  deployer: SignerWithAddress
): Promise<MockERC20> => {
  const factory = await ethers.getContractFactory('MockERC20', deployer);
  return factory.deploy();
};

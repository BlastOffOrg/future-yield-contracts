import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
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

export const deployRole = async (
  deployer: SignerWithAddress
): Promise<RoleControl> => {
  const factory = await ethers.getContractFactory('RoleControl', deployer);

  const role = await factory.deploy();
  await role.init();

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
  const factory = await ethers.getContractFactory(
    'LockedStakingPools',
    deployer
  );

  const staking = await factory.deploy();
  await staking.init(await role.address, treasury);

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
  const factory = await ethers.getContractFactory(
    'NonLockStakingPools',
    deployer
  );

  const staking = await factory.deploy();
  await staking.init(role.address, treasury);

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
  treasury: string
): Promise<ETHIDOPool> => {
  const factory = await ethers.getContractFactory('ETHIDOPool', deployer);
  const idoPool = await factory.deploy();
  await idoPool.init(fyETH, idoToken, idoDecimals, treasury, true);
  return idoPool;
};

export const deployUSDIDOPool = async (
  deployer: SignerWithAddress,
  usdb: string,
  fyUSD: string,
  idoToken: string,
  idoDecimals: BigNumberish,
  treasury: string
): Promise<USDIDOPool> => {
  const factory = await ethers.getContractFactory('USDIDOPool', deployer);
  const idoPool = await factory.deploy();
  await idoPool.init(usdb, fyUSD, idoToken, idoDecimals, treasury);
  return idoPool;
};

export const deployMockERC20 = async (
  deployer: SignerWithAddress
): Promise<MockERC20> => {
  const factory = await ethers.getContractFactory('MockERC20', deployer);
  return factory.deploy();
};

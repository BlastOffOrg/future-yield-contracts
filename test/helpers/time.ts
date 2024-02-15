import { ethers } from 'hardhat';

export const DAY = 86400;
export const MONTH = DAY * 30;
export const YEAR = DAY * 365;

export const getCurrentTs = async () => {
  return (await ethers.provider.getBlock('latest'))?.timestamp;
};

export const setTs = async (t: number) => {
  return ethers.provider.send('evm_setNextBlockTimestamp', [t]);
};

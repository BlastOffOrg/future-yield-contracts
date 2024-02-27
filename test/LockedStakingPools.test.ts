import { fail } from 'assert';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'hardhat';
import {
  BlastMock,
  LockedStakingPools,
  MockRebaseERC20,
  RoleControl,
  YieldToken,
} from '../typechain';
import {
  deployLockedStaking,
  deployMockBlast,
  deployMockUSDB,
  deployRole,
  deployYield,
  setupLockedStaking,
} from './helpers/deploy';
import { DAY, YEAR, getCurrentTs, setTs } from './helpers/time';
import { BigNumber, BigNumberish } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Sign } from 'crypto';
use(chaiAsPromised);

let DECIMAL = BigNumber.from(10n ** 18n);

describe('LockedStakingPools test - ETH', () => {
  let role: RoleControl;
  let deployer: SignerWithAddress,
    fund: SignerWithAddress,
    treasury: SignerWithAddress,
    stakers: SignerWithAddress[];
  let fyEthtoken: YieldToken;
  let pools: LockedStakingPools;
  let blast: BlastMock;
  let usdb: MockRebaseERC20;

  beforeEach(async () => {
    [deployer, fund, treasury, ...stakers] = await ethers.getSigners();

    role = await deployRole(deployer);
    fyEthtoken = await deployYield(deployer, 'yield ETH token', 'fyETH', role);

    pools = await deployLockedStaking(
      deployer,
      role,
      ethers.constants.AddressZero
    );
    blast = await deployMockBlast(deployer);
    usdb = await deployMockUSDB(deployer);

    await pools.setTreasury(treasury.address);
    await fyEthtoken.whitelistAddress(treasury.address);
    pools.setBlast(blast.address);
    pools.setUSDBRebasing(usdb.address);
  });

  it('can setup pools', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );
  });

  it('only admin can create new pools', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
  });

  it('cannot stake using usdb token', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL);

    const ts = (await getCurrentTs()) ?? 0;

  });

  it('staking return yield token', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    const ts = (await getCurrentTs()) ?? 0;

    const yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    const stakeInfo = await pools.getStakeInfo(0, 0);

    expect(stakeInfo.unlockTime).deep.eq(BigNumber.from(ts + YEAR));
  });

  it('cannot withdraw stake before timelock', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    const now = (await getCurrentTs()) ?? 0;
    await setTs(now + YEAR - 10);

    const tx = pools.connect(stakers[0]).unstake(0, 0);

    await expect(tx).rejectedWith(`Locked(${now + YEAR})`);

    await setTs(now + YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
  });

  it('cannot unstake by others', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    const now = (await getCurrentTs()) ?? 0;
    await setTs(now + YEAR + 10);

    const tx = pools.connect(stakers[1]).unstake(0, 0);

    await expect(tx).rejectedWith(`NotStaker("${stakers[1].address}")`);

    await pools.connect(stakers[0]).unstake(0, 0);
  });

  it('mulitple staking return correct yield token', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    let yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    const ts = (await getCurrentTs()) ?? 0;
    await setTs(ts + DAY);

    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(2));
  });

  it('mulitple staking return correct stake times', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    let stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).deep.eq(1n);

    const ts = (await getCurrentTs()) ?? 0;
    await setTs(ts + DAY);

    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).eq(2n);

    await setTs(ts + YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
    stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).eq(1n);

    await setTs(ts + YEAR + DAY);
    await pools.connect(stakers[0]).unstake(0, 1);
    stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).eq(0n);
  });

  it('return correct number of staked users', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    let stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(1n);

    const ts = (await getCurrentTs()) ?? 0;
    await setTs(ts + DAY);

    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(2n);

    await setTs(ts + YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
    stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(1n);

    await setTs(ts + YEAR + DAY);
    await pools.connect(stakers[1]).unstake(0, 1);
    stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(0n);
  });

  it('can repay with stake token', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    await blast
      .connect(fund)
      .setClaimableYield(pools.address, DECIMAL.sub(1000), {
        value: DECIMAL.sub(1000),
      });

    const initBal = await ethers.provider.getBalance(stakers[0].address);
    const tx = await pools
      .connect(stakers[0])
      .repayWithStakeToken(0, 0, { value: 2000 });
    const txRec = await tx.wait();
    if (!txRec) fail('tx failed');
    const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
    const bal = await ethers.provider.getBalance(stakers[0].address);
    const expectedBal = initBal.sub(fee).add(DECIMAL).sub(1000);

    expect(bal).deep.eq(expectedBal);
  });

  it('repay with stake token amount is correct', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    const initBal = await ethers.provider.getBalance(stakers[0].address);
    const tx = await pools
      .connect(stakers[0])
      .repayWithStakeToken(0, 0, { value: DECIMAL.div(4).add(1) });
    const txRec = await tx.wait();
    if (!txRec) fail('tx failed');
    const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
    const expectedBal = initBal.sub(fee).sub(DECIMAL.div(4)).add(DECIMAL);
    const bal = await ethers.provider.getBalance(stakers[0].address);

    expect(bal).deep.eq(expectedBal);
  });

  it('repay with stake token amount is correct', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    const initBal = await ethers.provider.getBalance(stakers[0].address);
    const tx = await pools
      .connect(stakers[0])
      .repayWithStakeToken(0, 0, { value: DECIMAL.div(4).add(1) });
    const txRec = await tx.wait();
    if (!txRec) fail('tx failed');
    const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
    const expectedBal = initBal.sub(fee).sub(DECIMAL.div(4)).add(DECIMAL);
    const bal = await ethers.provider.getBalance(stakers[0].address);

    expect(bal).deep.eq(expectedBal);
  });

  it('repay in multiple pools with stake token amount is correct', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);

    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await pools
      .connect(stakers[0])
      .stake(1, DECIMAL.mul(2), { value: DECIMAL.mul(2) });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL, {
      value: DECIMAL,
    });

    {
      const initBal = await ethers.provider.getBalance(stakers[0].address);
      const tx = await pools
        .connect(stakers[0])
        .repayWithStakeToken(0, 0, { value: 0 });
      const txRec = await tx.wait();
      if (!txRec) fail('tx failed');
      const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
      const expectedBal = initBal.sub(fee).add(DECIMAL);
      const bal = await ethers.provider.getBalance(stakers[0].address);
      expect(bal).deep.eq(expectedBal);
    }
    {
      const initBal = await ethers.provider.getBalance(stakers[0].address);
      const tx = await pools
        .connect(stakers[0])
        .repayWithStakeToken(1, 0, { value: DECIMAL.mul(3).div(2).add(1) });
      const txRec = await tx.wait();
      if (!txRec) fail('tx failed');
      const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
      const expectedBal = initBal.sub(fee).add(DECIMAL.div(2));
      const bal = await ethers.provider.getBalance(stakers[0].address);
      expect(bal).deep.eq(expectedBal);
    }
  });

  it('can repay with yield token', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    await blast
      .connect(fund)
      .setClaimableYield(pools.address, DECIMAL.sub(1000), {
        value: DECIMAL.sub(1000),
      });

    await fyEthtoken.connect(stakers[0]).approve(pools.address, 2000n);

    const initBal = await ethers.provider.getBalance(stakers[0].address);
    const tx = await pools.connect(stakers[0]).repayWithYieldToken(0, 0);
    const txRec = await tx.wait();
    if (!txRec) fail('tx failed');
    const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
    const bal = await ethers.provider.getBalance(stakers[0].address);
    const expectedBal = initBal.sub(fee).add(DECIMAL);
    expect(bal).deep.eq(expectedBal);
    expect(await fyEthtoken.balanceOf(stakers[0].address)).deep.eq(
      DECIMAL.sub(1000)
    );
  });

  it('repay with yield token amount is correct', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await fyEthtoken.connect(stakers[0]).approve(pools.address, DECIMAL.div(2));
    const initBal = await ethers.provider.getBalance(stakers[0].address);
    const tx = await pools.connect(stakers[0]).repayWithYieldToken(0, 0);
    const txRec = await tx.wait();
    if (!txRec) fail('tx failed');
    const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
    const expectedBal = initBal.sub(fee).add(DECIMAL);
    const bal = await ethers.provider.getBalance(stakers[0].address);
    expect(bal).deep.eq(expectedBal);
    expect(await fyEthtoken.balanceOf(stakers[0].address)).deep.eq(
      DECIMAL.mul(3).div(4)
    );
  });

  it('repay in multiple pools with yield token amount is correct', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);

    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL.div(2), {
      value: DECIMAL.div(2),
    });

    await pools
      .connect(stakers[0])
      .stake(1, DECIMAL.mul(2), { value: DECIMAL.mul(2) });
    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL, {
      value: DECIMAL,
    });
    await fyEthtoken.connect(stakers[0]).approve(pools.address, 0);
    const initBal = await ethers.provider.getBalance(stakers[0].address);
    const tx = await pools.connect(stakers[0]).repayWithYieldToken(0, 0);
    const txRec = await tx.wait();
    if (!txRec) fail('tx failed');
    const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
    const expectedBal = initBal.sub(fee).add(DECIMAL);
    const bal = await ethers.provider.getBalance(stakers[0].address);
    expect(bal).deep.eq(expectedBal);
    expect(await fyEthtoken.balanceOf(stakers[0].address)).deep.eq(
      DECIMAL.mul(3)
    );
  });

  it('can extend duration', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    let yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    const ts = (await getCurrentTs()) ?? 0;

    await setTs(ts + DAY);
    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    yieldBal = await fyEthtoken.balanceOf(stakers[1].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(1));

    await setTs(ts + 2 * DAY);
    await pools.connect(stakers[0]).extendsPosition(0, 0, YEAR);
    yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(2));

    await setTs(ts + 2 * DAY + YEAR);
    const tx = pools.connect(stakers[0]).unstake(0, 0);
    await expect(tx).rejectedWith(`Locked(${ts + YEAR * 2})`);

    await setTs(ts + 2 * YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
  });

  it('cannot extend duration more than 10 years', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    let yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    console.log(YEAR);

    const tx = pools.connect(stakers[0]).extendsPosition(0, 0, YEAR * 9 + 1);
    expect(tx).rejectedWith('ExceedMaxDuration()');
  });

  it('repay after extend duration requires correct amount', async () => {
    await setupLockedStaking(
      deployer,
      role,
      pools,
      ethers.constants.AddressZero,
      fyEthtoken
    );

    await pools.addLockedPools(YEAR, 100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });
    let yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    const ts = (await getCurrentTs()) ?? 0;

    await blast.connect(fund).setClaimableYield(pools.address, 1000, {
      value: 1000,
    });
    await setTs(ts + DAY);
    await pools.connect(stakers[1]).stake(0, DECIMAL, { value: DECIMAL });
    yieldBal = await fyEthtoken.balanceOf(stakers[1].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(1));

    await blast.connect(fund).setClaimableYield(pools.address, 1000, {
      value: 1000,
    });
    await setTs(ts + 2 * DAY);
    await pools.connect(stakers[0]).extendsPosition(0, 0, YEAR);
    yieldBal = await fyEthtoken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(2));

    await blast.connect(fund).setClaimableYield(pools.address, DECIMAL, {
      value: DECIMAL,
    });
    {
      const initBal = await ethers.provider.getBalance(stakers[0].address);
      const tx = await pools.connect(stakers[0]).repayWithStakeToken(0, 0, {
        value: DECIMAL.mul(3).div(2).sub(1500).add(100000),
      });
      const txRec = await tx.wait();
      if (!txRec) fail('tx failed');
      const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
      const expectedBal = initBal
        .sub(fee)
        .sub(DECIMAL.div(2).mul(3).sub(1500))
        .add(DECIMAL);
      const bal = await ethers.provider.getBalance(stakers[0].address);
      expect(bal.toBigInt()).eq(expectedBal.toBigInt());
    }
    {
      const initBal = await ethers.provider.getBalance(stakers[1].address);
      const tx = await pools
        .connect(stakers[1])
        .repayWithStakeToken(0, 1, { value: DECIMAL.div(2).add(100000) });
      const txRec = await tx.wait();
      if (!txRec) fail('tx failed');
      const fee = txRec.gasUsed.mul(txRec.effectiveGasPrice);
      const expectedBal = initBal
        .sub(fee)
        .add(DECIMAL)
        .sub(DECIMAL.div(2).sub(500));
      const bal = await ethers.provider.getBalance(stakers[1].address);
      expect(bal.toBigInt()).eq(expectedBal.toBigInt());
    }
  });
});

describe('LockedStakingPools test - USDB', () => {
  let role: RoleControl;
  let deployer: SignerWithAddress,
    fund: SignerWithAddress,
    treasury: SignerWithAddress,
    stakers: SignerWithAddress[];
  let yieldToken: YieldToken;
  let pools: LockedStakingPools;
  let blast: BlastMock;
  let usdb: MockRebaseERC20;

  let usdbStake = async (
    user: SignerWithAddress,
    poolId: number,
    amount: BigNumberish,
    stakeTime: number
  ) => {
    await usdb.mint(user.address, amount);
    await usdb.connect(user).approve(pools.address, amount);
    if (stakeTime > 0) await setTs(stakeTime);
    await pools.connect(user).stake(poolId, amount);
  };

  beforeEach(async () => {
    [deployer, fund, treasury, ...stakers] = await ethers.getSigners();

    role = await deployRole(deployer);
    yieldToken = await deployYield(deployer, 'yield USD token', 'fyUSD', role);

    pools = await deployLockedStaking(
      deployer,
      role,
      ethers.constants.AddressZero
    );
    blast = await deployMockBlast(deployer);
    usdb = await deployMockUSDB(deployer);

    await pools.setTreasury(treasury.address);
    await yieldToken.whitelistAddress(treasury.address);
    pools.setBlast(blast.address);
    pools.setUSDBRebasing(usdb.address);
  });

  it('can setup pools', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);
  });

  it('only admin can create new pools', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
  });

  it('staking return yield token', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);

    const ts = (await getCurrentTs()) ?? 0;

    const yieldBal = await yieldToken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    const stakeInfo = await pools.getStakeInfo(0, 0);

    expect(stakeInfo.unlockTime).deep.eq(BigNumber.from(ts + YEAR));
  });

  it('cannot withdraw stake before timelock', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);

    const now = (await getCurrentTs()) ?? 0;
    await setTs(now + YEAR - 10);

    const tx = pools.connect(stakers[0]).unstake(0, 0);

    await expect(tx).rejectedWith(`Locked(${now + YEAR})`);

    await setTs(now + YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
  });

  it('cannot unstake by others', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);

    const now = (await getCurrentTs()) ?? 0;
    await setTs(now + YEAR + 10);

    const tx = pools.connect(stakers[1]).unstake(0, 0);

    await expect(tx).rejectedWith(`NotStaker("${stakers[1].address}")`);

    await pools.connect(stakers[0]).unstake(0, 0);
  });

  it('mulitple staking return correct yield token', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);
    let yieldBal = await yieldToken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    const ts = (await getCurrentTs()) ?? 0;

    await usdbStake(stakers[0], 0, DECIMAL, ts + DAY);
    yieldBal = await yieldToken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(2));
  });

  it('mulitple staking return correct stake times', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);
    let stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).deep.eq(1n);

    const ts = (await getCurrentTs()) ?? 0;

    await usdbStake(stakers[0], 0, DECIMAL, ts + DAY);
    stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).eq(2n);

    await setTs(ts + YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
    stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).eq(1n);

    await setTs(ts + YEAR + DAY);
    await pools.connect(stakers[0]).unstake(0, 1);
    stakeTime = await pools.stakeTimes(0, stakers[0].address);
    expect(stakeTime.toBigInt()).eq(0n);
  });

  it('return correct number of staked users', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);
    let stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(1n);

    const ts = (await getCurrentTs()) ?? 0;

    await usdbStake(stakers[1], 0, DECIMAL, ts + DAY);
    stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(2n);

    await setTs(ts + YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
    stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(1n);

    await setTs(ts + YEAR + DAY);
    await pools.connect(stakers[1]).unstake(0, 1);
    stakeUsers = await pools.noUsersStaked(0);
    expect(stakeUsers.toBigInt()).eq(0n);
  });

  it('can repay with stake token', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);

    await usdb.setClaimableAmount(pools.address, DECIMAL.sub(1000));

    const initBal = await usdb.balanceOf(stakers[0].address);

    await usdb.mint(stakers[0].address, 1000);
    await usdb.connect(stakers[0]).approve(pools.address, 1000);
    await pools.connect(stakers[0]).repayWithStakeToken(0, 0);
    const bal = await usdb.balanceOf(stakers[0].address);
    const expectedBal = initBal.add(DECIMAL).toBigInt();

    expect(bal.toBigInt()).deep.eq(expectedBal);
  });

  it('repay with stake token amount is correct', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    await usdbStake(stakers[1], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    const initBal = await usdb.balanceOf(stakers[0].address);
    await usdb.mint(stakers[0].address, DECIMAL.div(4));
    await usdb.connect(stakers[0]).approve(pools.address, DECIMAL.div(4));
    await pools.connect(stakers[0]).repayWithStakeToken(0, 0);
    const expectedBal = initBal.add(DECIMAL);
    const bal = await usdb.balanceOf(stakers[0].address);

    expect(bal.toBigInt()).deep.eq(expectedBal.toBigInt());
  });

  it('repay in multiple pools with stake token amount is correct', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await pools.addLockedPools(YEAR, 100000, usdb.address);

    await usdbStake(stakers[0], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    await usdbStake(stakers[1], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    await usdbStake(stakers[0], 1, DECIMAL.mul(2), 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL);

    {
      const initBal = await usdb.balanceOf(stakers[0].address);
      await pools.connect(stakers[0]).repayWithStakeToken(0, 0);
      const expectedBal = initBal.add(DECIMAL);
      const bal = await usdb.balanceOf(stakers[0].address);
      expect(bal).deep.eq(expectedBal);
    }
    {
      await usdb.mint(stakers[0].address, DECIMAL.mul(3).div(2).add(1));
      await usdb
        .connect(stakers[0])
        .approve(pools.address, DECIMAL.mul(3).div(2).add(1));
      const initBal = await usdb.balanceOf(stakers[0].address);
      await pools.connect(stakers[0]).repayWithStakeToken(1, 0);
      const expectedBal = initBal.add(DECIMAL.div(2)).toBigInt();
      const bal = (await usdb.balanceOf(stakers[0].address)).toBigInt();
      expect(bal).deep.eq(expectedBal);
    }
  });

  it('can repay with yield token', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);

    await usdb.setClaimableAmount(pools.address, DECIMAL.sub(1000));

    await yieldToken.connect(stakers[0]).approve(pools.address, 2000n);

    const initBal = await usdb.balanceOf(stakers[0].address);
    await pools.connect(stakers[0]).repayWithYieldToken(0, 0);
    const bal = await usdb.balanceOf(stakers[0].address);
    const expectedBal = initBal.add(DECIMAL);
    expect(bal).deep.eq(expectedBal);
    expect(await yieldToken.balanceOf(stakers[0].address)).deep.eq(
      DECIMAL.sub(1000)
    );
  });

  it('repay with yield token amount is correct', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    await usdbStake(stakers[1], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    await yieldToken.connect(stakers[0]).approve(pools.address, DECIMAL.div(2));
    const initBal = await usdb.balanceOf(stakers[0].address);
    await pools.connect(stakers[0]).repayWithYieldToken(0, 0);
    const expectedBal = initBal.add(DECIMAL);
    const bal = await usdb.balanceOf(stakers[0].address);
    expect(bal.toBigInt()).deep.eq(expectedBal.toBigInt());
    expect(await yieldToken.balanceOf(stakers[0].address)).deep.eq(
      DECIMAL.mul(3).div(4)
    );
  });

  it('repay in multiple pools with yield token amount is correct', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await pools.addLockedPools(YEAR, 100000, usdb.address);

    await usdbStake(stakers[0], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    await usdbStake(stakers[1], 0, DECIMAL, 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL.div(2));

    await usdbStake(stakers[0], 1, DECIMAL.mul(2), 0);
    await usdb.setClaimableAmount(pools.address, DECIMAL);

    await yieldToken.connect(stakers[0]).approve(pools.address, 0);
    const initBal = await usdb.balanceOf(stakers[0].address);
    await pools.connect(stakers[0]).repayWithYieldToken(0, 0);
    const expectedBal = initBal.add(DECIMAL);
    const bal = await usdb.balanceOf(stakers[0].address);
    expect(bal.toBigInt()).deep.eq(expectedBal.toBigInt());
    expect(await yieldToken.balanceOf(stakers[0].address)).deep.eq(
      DECIMAL.mul(3)
    );
  });

  it('can extend duration', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);
    let yieldBal = await yieldToken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL);

    const ts = (await getCurrentTs()) ?? 0;

    await usdbStake(stakers[1], 0, DECIMAL, ts + DAY);
    yieldBal = await yieldToken.balanceOf(stakers[1].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(1));

    await setTs(ts + 2 * DAY);
    await pools.connect(stakers[0]).extendsPosition(0, 0, YEAR);
    yieldBal = await yieldToken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(2));

    await setTs(ts + 2 * DAY + YEAR);
    const tx = pools.connect(stakers[0]).unstake(0, 0);
    await expect(tx).rejectedWith(`Locked(${ts + YEAR * 2})`);

    await setTs(ts + 2 * YEAR);
    await pools.connect(stakers[0]).unstake(0, 0);
  });

  it('repay after extend duration requires correct amount', async () => {
    await setupLockedStaking(deployer, role, pools, usdb.address, yieldToken);

    await pools.addLockedPools(YEAR, 100000, usdb.address);
    await usdbStake(stakers[0], 0, DECIMAL, 0);
    let yieldBal = await yieldToken.balanceOf(stakers[0].address);
    expect(yieldBal.toBigInt()).deep.equal(DECIMAL.toBigInt());

    const ts = (await getCurrentTs()) ?? 0;

    await usdb.setClaimableAmount(pools.address, 1000);
    await usdbStake(stakers[1], 0, DECIMAL, ts + DAY);
    yieldBal = await yieldToken.balanceOf(stakers[1].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(1));

    await usdb.setClaimableAmount(pools.address, 1000);
    await setTs(ts + 2 * DAY);
    await pools.connect(stakers[0]).extendsPosition(0, 0, YEAR);
    yieldBal = await yieldToken.balanceOf(stakers[0].address);
    expect(yieldBal).deep.equal(DECIMAL.mul(2));

    await usdb.setClaimableAmount(pools.address, DECIMAL);
    {
      await usdb.mint(stakers[0].address, DECIMAL.mul(1000));
      const initBal = await usdb.balanceOf(stakers[0].address);
      await usdb
        .connect(stakers[0])
        .approve(pools.address, DECIMAL.mul(3).div(2).sub(1500).add(100000));
      await pools.connect(stakers[0]).repayWithStakeToken(0, 0);
      const expectedBal = initBal
        .sub(DECIMAL.div(2).mul(3).sub(1500))
        .add(DECIMAL);
      const bal = await usdb.balanceOf(stakers[0].address);
      expect(bal.toBigInt()).eq(expectedBal.toBigInt());
    }
    {
      await usdb.mint(stakers[1].address, DECIMAL.mul(1000));
      const initBal = await usdb.balanceOf(stakers[1].address);
      await usdb
        .connect(stakers[1])
        .approve(pools.address, DECIMAL.div(2).add(100000));
      await pools.connect(stakers[1]).repayWithStakeToken(0, 1);
      const expectedBal = initBal.add(DECIMAL).sub(DECIMAL.div(2).sub(500));
      const bal = await usdb.balanceOf(stakers[1].address);
      expect(bal.toBigInt()).eq(expectedBal.toBigInt());
    }
  });
});

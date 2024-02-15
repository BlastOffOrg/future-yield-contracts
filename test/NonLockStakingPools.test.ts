import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'hardhat';
import { NonLockStakingPools, RoleControl, YieldToken } from '../typechain';
import {
  deployNonLockStaking,
  deployRole,
  deployYield,
  setupNonLockStaking,
} from './helpers/deploy';
import { YEAR, getCurrentTs, setTs } from './helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
use(chaiAsPromised);

let DECIMAL = 10n ** 18n;

describe('NonLockedStakingPools test', () => {
  let role: RoleControl;
  let deployer: SignerWithAddress, stakers: SignerWithAddress[];
  let token: YieldToken;
  let pools: NonLockStakingPools;

  beforeEach(async () => {
    [deployer, ...stakers] = await ethers.getSigners();

    role = await deployRole(deployer);
    token = await deployYield(deployer, 'yield token', 'fyT', role);
    pools = await deployNonLockStaking(deployer, role, ethers.constants.AddressZero);
  });

  it('can setup pools', async () => {
    await setupNonLockStaking(deployer, role, pools, ethers.constants.AddressZero, token);
  });

  it('only admin can create new pools', async () => {
    await setupNonLockStaking(deployer, role, pools, ethers.constants.AddressZero, token);

    await pools.addPool(100000, ethers.constants.AddressZero);
  });

  it('staking increase amount', async () => {
    await setupNonLockStaking(deployer, role, pools, ethers.constants.AddressZero, token);

    await pools.addPool(100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    const stakeInfo = await pools.getUserStakePosition(
      0,
      stakers[0].getAddress()
    );
    expect(stakeInfo.amount.toBigInt()).deep.eq(DECIMAL);
  });

  it('unstake return correct amount', async () => {
    await setupNonLockStaking(deployer, role, pools, ethers.constants.AddressZero, token);

    await pools.addPool(100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    const start = (await getCurrentTs()) ?? 0;

    await setTs(start + YEAR);

    await pools.connect(stakers[0]).unstake(0);

    const yieldBal = await token.balanceOf(stakers[0].getAddress());
    expect(yieldBal.toBigInt()).deep.eq(DECIMAL);
  });

  it('cannot claim more after unstake', async () => {
    await setupNonLockStaking(deployer, role, pools, ethers.constants.AddressZero, token);

    await pools.addPool(100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    const start = (await getCurrentTs()) ?? 0;

    await setTs(start + YEAR);
    await pools.connect(stakers[0]).unstake(0);
    let yieldBal = await token.balanceOf(stakers[0].getAddress());
    expect(yieldBal.toBigInt()).eq(DECIMAL);

    await setTs(2 * YEAR + start);
    const tx = pools.connect(stakers[0]).claimPendingReward(0);
    await expect(tx).rejectedWith('NoStaking()');
  });

  it('can unstake after claim reward', async () => {
    await setupNonLockStaking(deployer, role, pools, ethers.constants.AddressZero, token);

    await pools.addPool(100000, ethers.constants.AddressZero);
    await pools.connect(stakers[0]).stake(0, DECIMAL, { value: DECIMAL });

    const start = (await getCurrentTs()) ?? 0;

    await setTs(start + YEAR);
    await pools.connect(stakers[0]).claimPendingReward(0);
    let yieldBal = await token.balanceOf(stakers[0].getAddress());
    expect(yieldBal.toBigInt()).eq(DECIMAL);

    await setTs(2 * YEAR + start);
    await pools.connect(stakers[0]).unstake(0);
    yieldBal = await token.balanceOf(stakers[0].getAddress());
    expect(yieldBal.toBigInt()).eq(2n * DECIMAL);
  });
});

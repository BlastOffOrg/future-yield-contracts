// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILockedStaking {
  error NotPoolAdmin(address user);
  error InvalidArguments();
  error TooManyStake();
  error PoolClosed(uint256 id);
  error PoolNotExisted(uint256 id);
  error NoStaking();
  error Locked(uint256 until);
  error NotStaker(address user);
  error InsufficientAmount(uint256 required);
  error ExceededMaxDuration();

  struct LockedPoolInfo {
    uint256 timelock;
    uint256 yieldAPY;
    address yieldToken;
    address stakeToken;
    uint256 totalStaked;
    uint256 nextStakeId;
    bool enabled;
  }

  struct StakingInfo {
    address user;
    uint256 amount;
    uint256 stakeTime;
    uint256 unlockTime;
    uint256 yieldAmount;
    uint256 yieldDebt; // used for calculate generated yield
  }

  event PoolCreated(
    uint256 id,
    uint256 timelock,
    uint256 yieldAPY,
    address yieldToken,
    address stakeToken
  );

  event Stake(
    uint256 poolId,
    uint256 stakeId,
    uint256 timelock,
    uint256 yield,
    address yieldToken,
    address stakeToken,
    uint256 amount
  );

  event Unstake(
    uint256 poolId,
    uint256 stakeId,
    address stakeToken,
    uint256 totalAmount
  );

  event Extend(uint256 poolId, uint256 stakeId, uint256 duration);

  event Repay(
    uint256 poolId,
    uint256 stakeId,
    address token,
    uint256 totalStaked,
    uint256 repayAmount
  );

  event ClosePool(uint256 id);

  event TreasuryChange(address newTreasury);

  event PoolYieldChange(uint256 poolId, uint256 yieldAPY);

  function stake(uint256 poolId, uint256 amount) external payable;

  function unstake(uint256 poolId, uint256 stakeId) external;

  function getGeneratedYield(
    uint256 poolId,
    uint256 stakeId
  ) external view returns (uint256);

  function repayWithStakeToken(
    uint256 poolId,
    uint256 stakeId
  ) external payable;

  function repayWithYieldToken(uint256 poolId, uint256 stakeId) external;
}

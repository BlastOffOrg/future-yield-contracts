// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INonLockStaking {
  error NotPoolAdmin(address user);
  error InvalidArguments();
  error PoolClosed(uint256 id);
  error PoolNotExisted(uint256 id);
  error NoStaking();

  struct StakePosition {
    uint256 amount;
    uint256 lastCalcTs; // last reward calculated timestamp
    uint256 pendingReward;
  }

  struct PoolInfo {
    uint256 yieldAPY;
    address yieldToken;
    address stakeToken;
    uint256 totalStaked;
    bool enabled;
  }

  event PoolCreated(
    uint256 id,
    uint256 yieldAPY,
    address yieldToken,
    address stakeToken
  );

  event Stake(
    uint256 poolId,
    uint256 yield,
    address yieldToken,
    address stakeToken,
    uint256 amount
  );

  event Unstake(
    uint256 poolId,
    address stakeToken,
    uint256 totalAmount,
    uint256 rewardAmount
  );

  event RewardClaim(
    uint256 poolId,
    address stakeToken,
    uint256 rewardAmount
  );

  event ClosePool(uint256 id);

  event TreasuryChange(address newTreasury);

  event PoolYieldChange(uint256 poolId, uint256 yieldAPY);

  function stake(uint256 poolId, uint256 amount) external payable;

  function unstake(uint256 poolId) external;

  function claimPendingReward(uint256 poolId) external;
}

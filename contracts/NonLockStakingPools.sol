// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interface/IERC20Mintable.sol";
import "./interface/IERC20Rebasing.sol";
import "./interface/INonLockStaking.sol";
import "./interface/IRoleControl.sol";
import "./interface/IBlast.sol";
import "./lib/TokenTransfer.sol";

interface IBlastPoints {
  function configurePointsOperator(address operator) external;
}

contract NonLockStakingPools is Initializable, INonLockStaking {
  using SafeERC20 for IERC20;

  uint256 public constant YIELD_DENOM = 100000;
  bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

  IRoleControl roleControl;
  address public treasury;
  uint256 nextPoolId;
  mapping(address => address) public yieldTokens;
  mapping(uint256 => PoolInfo) public poolInfo;
  mapping(uint256 => mapping(address => StakePosition)) userStakes;
  mapping(uint256 => address[]) listUsers;

  IERC20Rebasing public USDB;
  IBlast public blast;

  constructor() {
    _disableInitializers();
  }

  function init(address roleControl_, address treasury_) external initializer {
    roleControl = IRoleControl(roleControl_);
    if (treasury_ != address(0)) {
      treasury = treasury_;
    }
  }

  modifier onlyPoolAdmin() {
    if (!roleControl.hasRole(POOL_ADMIN_ROLE, msg.sender))
      revert NotPoolAdmin(msg.sender);
    _;
  }

  /**
   * set USDB token address
   *
   * @param usdb USDB token address
   */
  function setUSDBRebasing(address usdb) external onlyPoolAdmin {
    USDB = IERC20Rebasing(usdb);
    USDB.configure(RebaseYieldMode.CLAIMABLE);
  }

  /**
   * set native blast contract
   *
   * @param _blast blast address
   */
  function setBlast(address _blast) external onlyPoolAdmin {
    blast = IBlast(_blast);
    blast.configureClaimableYield();
  }

  function configurePointsOperator(
    address operator,
    address blastPointAddress
  ) external onlyPoolAdmin {
    IBlastPoints(address(blastPointAddress)).configurePointsOperator(operator);
  }

  function setTreasury(address _treasury) external onlyPoolAdmin {
    treasury = _treasury;
  }

  function claimNativeYield() external onlyPoolAdmin {
    IBlast(blast).claimAllYield(address(this), treasury);
  }

  /**
   * Admin claims native USDB yield and send to treasury address
   */
  function claimUSDBYield() external onlyPoolAdmin {
    uint256 amount = USDB.getClaimableAmount(address(this));
    USDB.claim(treasury, amount);
  }

  function addSupportYieldTokens(
    address stakeToken,
    address yieldToken
  ) external onlyPoolAdmin {
    yieldTokens[stakeToken] = yieldToken;
  }

  function addPool(
    uint256 yieldAPY,
    address stakeToken
  ) external onlyPoolAdmin returns (uint256 poolId) {
    if (yieldAPY == 0) revert InvalidArguments();
    address yieldToken = yieldTokens[stakeToken];
    if (yieldToken == address(0)) revert InvalidArguments();

    poolId = nextPoolId;
    poolInfo[poolId] = PoolInfo(yieldAPY, yieldToken, stakeToken, 0, true);

    nextPoolId = poolId + 1;

    emit PoolCreated(poolId, yieldAPY, yieldToken, stakeToken);
  }

  function closePool(uint256 poolId) external onlyPoolAdmin {
    poolInfo[poolId].enabled = false;
    poolInfo[poolId].yieldAPY = 0;
  }

  function setPoolYield(uint256 poolId, uint256 yield) external onlyPoolAdmin {
    if (poolId == 0 || yield == 0) revert InvalidArguments();
    if (poolInfo[poolId].enabled == false) revert PoolNotExisted(poolId);

    poolInfo[poolId].yieldAPY = yield;
  }

  function getUserStakePosition(
    uint256 poolId,
    address account
  ) external view returns (StakePosition memory) {
    return userStakes[poolId][account];
  }

  function stake(uint256 poolId, uint256 amount) external payable override {
    PoolInfo memory pool = poolInfo[poolId];
    if (pool.enabled == false) revert PoolNotExisted(poolId);

    StakePosition storage position = userStakes[poolId][msg.sender];

    if (position.amount == 0) {
      userStakes[poolId][msg.sender] = StakePosition(
        amount,
        block.timestamp,
        0
      );
    } else {
      uint256 accuReward = ((block.timestamp - position.lastCalcTs) *
        position.amount *
        pool.yieldAPY) /
        YIELD_DENOM /
        365 /
        86400;

      position.lastCalcTs = block.timestamp;
      position.pendingReward += accuReward;
      position.amount += amount;
    }

    poolInfo[poolId].totalStaked += amount;

    TokenTransfer._depositToken(pool.stakeToken, msg.sender, amount);

    emit Stake(poolId, pool.yieldAPY, pool.yieldToken, pool.stakeToken, amount);
  }

  function unstake(uint256 poolId) external override {
    PoolInfo memory pool = poolInfo[poolId];
    // don't use enabled for user to unstake from close pool
    if (pool.yieldToken == address(0)) revert PoolNotExisted(poolId);

    StakePosition memory position = userStakes[poolId][msg.sender];
    uint256 accuReward = ((block.timestamp - position.lastCalcTs) *
      position.amount *
      pool.yieldAPY) /
      YIELD_DENOM /
      365 /
      86400;

    uint256 rewardAmount = accuReward + position.pendingReward;
    uint256 stakeAmount = position.amount;
    delete userStakes[poolId][msg.sender];
    poolInfo[poolId].totalStaked -= stakeAmount;

    TokenTransfer._transferToken(pool.stakeToken, msg.sender, stakeAmount);
    TokenTransfer._mintToken(pool.yieldToken, msg.sender, rewardAmount);

    emit RewardClaim(poolId, pool.stakeToken, rewardAmount);
    emit Unstake(poolId, pool.stakeToken, position.amount, rewardAmount);
  }

  function claimPendingReward(uint256 poolId) external override {
    PoolInfo memory pool = poolInfo[poolId];
    // don't use enabled for user to unstake from close pool
    if (pool.yieldToken == address(0)) revert PoolNotExisted(poolId);

    StakePosition storage position = userStakes[poolId][msg.sender];
    if (position.amount == 0) revert NoStaking();

    uint256 stakedAmount = position.amount;
    uint256 accuReward = ((block.timestamp - position.lastCalcTs) *
      stakedAmount *
      pool.yieldAPY) /
      YIELD_DENOM /
      365 /
      86400;

    uint256 rewardAmount = accuReward + position.pendingReward;
    position.pendingReward = 0;
    position.lastCalcTs = block.timestamp;

    TokenTransfer._mintToken(pool.yieldToken, msg.sender, rewardAmount);

    emit RewardClaim(poolId, pool.stakeToken, rewardAmount);
  }
}

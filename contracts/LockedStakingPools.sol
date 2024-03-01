// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interface/IRoleControl.sol";
import "./interface/ILockedStaking.sol";
import "./interface/IBlast.sol";
import "./interface/IERC20Rebasing.sol";
import "./lib/TokenTransfer.sol";

interface IBlastPoints {
	function configurePointsOperator(address operator) external;
}

/**
 * @dev Lock staking pool contract
 *
 */
contract LockedStakingPools is Initializable, ILockedStaking {
  using SafeERC20 for IERC20;

  uint256 public constant YIELD_DENOM = 100000;
  bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

  IERC20Rebasing public USDB;
  IBlast public blast;

  IRoleControl roleControl;
  address public treasury;
  uint256 nextPoolId;
  mapping(uint256 => LockedPoolInfo) public poolInfo;
  mapping(uint256 => mapping(uint256 => StakingInfo)) stakeInfo;
  mapping(uint256 => mapping(address => uint256[])) userStakeIds;
  mapping(uint256 => uint256) public noUsersStaked;
  mapping(address => address) public yieldTokens;
  mapping(address => uint256) public tokenTotalStaked;
  mapping(address => uint256) public accYieldPerStaked;

  constructor() {
    _disableInitializers();
  }

  function init(address roleControl_, address treasury_) external initializer {
    roleControl = IRoleControl(roleControl_);
    treasury = treasury_;
  }

  modifier onlyPoolAdmin() {
    if (!roleControl.hasRole(POOL_ADMIN_ROLE, msg.sender))
      revert NotPoolAdmin(msg.sender);
    _;
  }

  function configurePointsOperator(address operator, address blastPointAddress) external onlyPoolAdmin {
    IBlastPoints(address(blastPointAddress)).configurePointsOperator(operator);
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

  /**
   *
   * set treasury address
   * Treasury is the wallet used to receive all native yield
   *
   * @param _treasury treasury wallet address
   */
  function setTreasury(address _treasury) external onlyPoolAdmin {
    treasury = _treasury;
  }

  /**
   * Admin claims native yield and send to treasury address
   */
  function claimNativeYield() external onlyPoolAdmin {
    blast.claimAllYield(address(this), treasury);
  }

  /**
   * Admin claims native USDB yield and send to treasury address
   */
  function claimUSDBYield() external onlyPoolAdmin {
    uint256 amount = USDB.getClaimableAmount(address(this));
    USDB.claim(treasury, amount);
  }

  /**
   * @dev Admin only - add stake and future yield token pair
   *
   * @param stakeToken address of token used to stake, `address(0)` for ETH
   * @param yieldToken address of fyETH or fyUSDB token
   */
  function addSupportYieldTokens(
    address stakeToken,
    address yieldToken
  ) external onlyPoolAdmin {
    if (stakeToken != address(0) && stakeToken != address(USDB)) revert();
    yieldTokens[stakeToken] = yieldToken;
  }

  /**
   * @dev Admin only - add new staking pool
   *
   * @param timelock staking lock time in seconds
   * @param yieldAPY yieldAPY
   * @param stakeToken token address use for staking
   */
  function addLockedPools(
    uint256 timelock,
    uint256 yieldAPY,
    address stakeToken
  ) external onlyPoolAdmin returns (uint256 poolId) {
    if (timelock == 0 || yieldAPY == 0) revert InvalidArguments();
    address yieldToken = yieldTokens[stakeToken];
    if (yieldToken == address(0)) revert InvalidArguments();

    poolId = nextPoolId;
    poolInfo[poolId] = LockedPoolInfo(
      timelock,
      yieldAPY,
      yieldToken,
      stakeToken,
      0,
      0,
      true
    );

    nextPoolId = poolId + 1;

    emit PoolCreated(poolId, timelock, yieldAPY, yieldToken, stakeToken);
  }

  /**
   * @dev Admin only - close staking pools
   * Closed pool will not accept new staking
   *
   * @param poolId poolId
   */
  function closePool(uint256 poolId) external onlyPoolAdmin {
    poolInfo[poolId].enabled = false;
  }

  /**
   * @dev Admin only - set pool yield APY
   * @notice do not change pool APY after user start staking in the pool
   *
   * @param poolId poolId
   * @param yield  yieldAPY
   */
  function setPoolYield(uint256 poolId, uint256 yield) external onlyPoolAdmin {
    if (poolId == 0 || yield == 0) revert InvalidArguments();
    if (poolInfo[poolId].timelock == 0) revert PoolNotExisted(poolId);

    poolInfo[poolId].yieldAPY = yield;
  }

  /**
   * @dev get total yield generated corresponding to staking tokens
   *
   * @param token staking token
   */
  function getYieldAmount(address token) internal view returns (uint256) {
    if (token == address(0)) return blast.readClaimableYield(address(this));
    else if (token == address(USDB))
      return USDB.getClaimableAmount(address(this));
    else return 0;
  }

  /**
   * @dev claim yield token to treasury
   *
   * @param token staking token
   */
  function claimYield(address token) internal {
    if (token == address(0)) {
      blast.claimAllYield(address(this), treasury);
    } else if (token == address(USDB)) {
      uint256 amount = USDB.getClaimableAmount(address(this));
      USDB.claim(treasury, amount);
    }
  }

  /**
   * @dev get amount of yield token generated by staking position
   *
   * @param poolId poolId
   * @param stakeId staking Id
   */
  function getGeneratedYield(
    uint256 poolId,
    uint256 stakeId
  ) external view override returns (uint256) {
    StakingInfo memory staked = stakeInfo[poolId][stakeId];
    LockedPoolInfo memory pool = poolInfo[poolId];
    uint256 yield = getYieldAmount(pool.stakeToken);
    uint256 yieldPerStaked = accYieldPerStaked[pool.stakeToken];
    yieldPerStaked += (yield * 1e25) / tokenTotalStaked[pool.stakeToken];
    return (staked.amount * yieldPerStaked) / 1e24 - staked.yieldDebt;
  }

  /**
   * @dev get staking position info
   *
   * @param poolId poolId
   * @param stakeId stakeId
   */
  function getStakeInfo(
    uint256 poolId,
    uint256 stakeId
  ) external view returns (StakingInfo memory) {
    return stakeInfo[poolId][stakeId];
  }

  /**
   * @dev get user stake ids
   * 
   * @param poolId poolId
   * @param account account address
   */
  function getUserStakesIds(uint256 poolId, address account) external view returns (uint256[] memory) {
    return userStakeIds[poolId][account];
  }

  function getUserStakeIdByIndex(uint256 poolId, address account, uint256 index) external view returns (uint256) {
    return userStakeIds[poolId][account][index];
  }

  /**
   * @dev get number of staking times of an account in a pool
   *
   * @param poolId poolId
   * @param account account address
   */
  function stakeTimes(
    uint256 poolId,
    address account
  ) external view returns (uint256) {
    return userStakeIds[poolId][account].length;
  }

  function _updateAccYield(address stakeToken) internal {
    uint256 totalStaked = tokenTotalStaked[stakeToken];
    if (totalStaked != 0) {
      uint256 yield = getYieldAmount(stakeToken);
      accYieldPerStaked[stakeToken] += (yield * 1e24) / totalStaked;
    }

    claimYield(stakeToken);
  }

  function _deleteStakingInfo(uint256 poolId, uint256 stakeId) internal {
    delete stakeInfo[poolId][stakeId];
    uint256[] storage stakeIds = userStakeIds[poolId][msg.sender];
    // remove stakeId from list
    for (uint i; i < stakeIds.length; i++) {
      if (stakeIds[i] == stakeId) {
        stakeIds[i] = stakeIds[stakeIds.length - 1];
        stakeIds.pop();
        break;
      }
    }
  }

  /**
   * @dev stake token into an pool with `poolId`
   * @notice if staking ETH, amount of wei send to contract must be equal to `amount` param
   *
   * @param poolId poolId
   * @param amount staking amount
   */
  function stake(uint256 poolId, uint256 amount) external payable {
    if (amount == 0) revert InvalidArguments();
    // revert if stake over 100 times in a pool to prevent out of gas when unstake
    if (userStakeIds[poolId][msg.sender].length > 100) revert TooManyStake();

    LockedPoolInfo memory pool = poolInfo[poolId];
    if (pool.timelock == 0 || pool.enabled == false) revert PoolClosed(poolId);
    _updateAccYield(pool.stakeToken);

    uint256 yieldAmount = (amount * pool.yieldAPY * pool.timelock) /
      YIELD_DENOM /
      365 /
      86400;

    uint256 yieldDebt = (amount * accYieldPerStaked[pool.stakeToken]) / 1e24;

    StakingInfo memory staking = StakingInfo(
      msg.sender,
      amount,
      block.timestamp,
      block.timestamp + pool.timelock,
      yieldAmount,
      yieldDebt
    );

    // --------------------- save stats data ---------------------------
    uint256 stakeId = poolInfo[poolId].nextStakeId;
    poolInfo[poolId].nextStakeId += 1;
    stakeInfo[poolId][stakeId] = staking;

    poolInfo[poolId].totalStaked += amount;
    if (userStakeIds[poolId][msg.sender].length == 0) {
      noUsersStaked[poolId] += 1;
    }
    userStakeIds[poolId][msg.sender].push(stakeId);
    tokenTotalStaked[pool.stakeToken] += amount;

    TokenTransfer._depositToken(pool.stakeToken, msg.sender, amount);
    TokenTransfer._mintToken(pool.yieldToken, msg.sender, yieldAmount);

    emit Stake(
      poolId,
      stakeId,
      pool.timelock,
      pool.yieldAPY,
      pool.yieldToken,
      pool.stakeToken,
      amount
    );
  }

  function extendsPosition(uint256 poolId, uint256 stakeId, uint256 extraDuration) external {
    LockedPoolInfo memory pool = poolInfo[poolId];
    if (pool.timelock == 0) revert PoolNotExisted(poolId);
    _updateAccYield(pool.stakeToken);

    StakingInfo storage staked = stakeInfo[poolId][stakeId];
    if (staked.amount == 0) revert NoStaking();
    if (staked.user != msg.sender) revert NotStaker(msg.sender);

    uint256 yieldedAmnt = (staked.amount *
      accYieldPerStaked[pool.stakeToken]) /
      1e24 -
      staked.yieldDebt;

    staked.unlockTime += extraDuration;
    if (staked.unlockTime - staked.stakeTime > (365 * 86400 * 10)) revert ExceededMaxDuration();

    uint256 extraYield = (staked.amount * pool.yieldAPY * extraDuration) /
      YIELD_DENOM /
      365 /
      86400;

    staked.yieldAmount += extraYield;
    staked.yieldDebt = (staked.amount * accYieldPerStaked[pool.stakeToken]) / 1e24 - yieldedAmnt;

    TokenTransfer._mintToken(pool.yieldToken, msg.sender, extraYield);

    emit Extend(
      poolId,
      stakeId,
      extraDuration
    );
  }

  /**
   * @dev unstake postion when locked time is passed
   *
   * @param poolId poolId
   * @param stakeId stake position id
   */
  function unstake(uint256 poolId, uint256 stakeId) external {
    LockedPoolInfo memory pool = poolInfo[poolId];
    if (pool.timelock == 0) revert PoolNotExisted(poolId);
    _updateAccYield(pool.stakeToken);

    StakingInfo memory staked = stakeInfo[poolId][stakeId];
    if (staked.amount == 0) revert NoStaking();
    if (staked.unlockTime > block.timestamp) revert Locked(staked.unlockTime);
    if (staked.user != msg.sender) revert NotStaker(msg.sender);

    poolInfo[poolId].totalStaked -= staked.amount;
    tokenTotalStaked[pool.stakeToken] -= staked.amount;
    _deleteStakingInfo(poolId, stakeId);

    if (userStakeIds[poolId][msg.sender].length == 0) {
      noUsersStaked[poolId] -= 1;
    }

    TokenTransfer._transferToken(pool.stakeToken, msg.sender, staked.amount);

    emit Unstake(poolId, stakeId, pool.stakeToken, staked.amount);
  }

  /**
   * @dev repay to unlock position prematurely by staking token
   * the amount of token need to be repay will be:
   *
   * stakeInfo.yieldAmount - yieldGeneratedByStakePosition
   *
   * if repay using ETH, any spares amount will be returned to `msg.sender`
   *
   * @param poolId pool id
   * @param stakeId position id
   */
  function repayWithStakeToken(
    uint256 poolId,
    uint256 stakeId
  ) external payable override {
    LockedPoolInfo memory pool = poolInfo[poolId];
    if (pool.timelock == 0) revert PoolNotExisted(poolId);
    StakingInfo memory staking = stakeInfo[poolId][stakeId];
    if (staking.amount == 0) revert NoStaking();
    _updateAccYield(pool.stakeToken);

    uint256 yieldedAmnt = (staking.amount *
      accYieldPerStaked[pool.stakeToken]) /
      1e24 -
      staking.yieldDebt;
    uint256 requireAmnt = 0;
    if (staking.yieldAmount > yieldedAmnt) {
      requireAmnt = staking.yieldAmount - yieldedAmnt;
    }

    if (pool.stakeToken == address(0) && msg.value < requireAmnt)
      revert InsufficientAmount(requireAmnt);
    if (requireAmnt > staking.yieldAmount) requireAmnt = staking.yieldAmount;

    poolInfo[poolId].totalStaked -= requireAmnt;
    tokenTotalStaked[pool.stakeToken] -= requireAmnt;
    if (userStakeIds[poolId][msg.sender].length == 0) {
      noUsersStaked[poolId] -= 1;
    }
    _deleteStakingInfo(poolId, stakeId);

    TokenTransfer._depositAndReturnSpare(
      pool.stakeToken,
      msg.sender,
      treasury,
      requireAmnt
    );
    // return stake
    TokenTransfer._transferToken(pool.stakeToken, msg.sender, staking.amount);

    emit Repay(poolId, stakeId, pool.stakeToken, staking.amount, requireAmnt);
  }

  /**
   * @dev repay to unlock position prematurely by future yield token
   * the amount of token need to be repay will be:
   *
   * stakeInfo.yieldAmount - yieldGeneratedByStakePosition
   *
   * @param poolId pool id
   * @param stakeId position id
   */
  function repayWithYieldToken(
    uint256 poolId,
    uint256 stakeId
  ) external override {
    LockedPoolInfo memory pool = poolInfo[poolId];
    if (pool.timelock == 0) revert PoolNotExisted(poolId);
    StakingInfo memory staking = stakeInfo[poolId][stakeId];
    if (staking.amount == 0) revert NoStaking();
    if (staking.user != msg.sender) revert NotStaker(staking.user);
    _updateAccYield(pool.stakeToken);

    uint256 yieldedAmnt = (staking.amount *
      accYieldPerStaked[pool.stakeToken]) /
      1e24 -
      staking.yieldDebt;
    uint256 requireAmnt = 0;
    if (staking.yieldAmount > yieldedAmnt) {
      requireAmnt = staking.yieldAmount - yieldedAmnt;
    }

    poolInfo[poolId].totalStaked -= requireAmnt;
    tokenTotalStaked[pool.stakeToken] -= requireAmnt;
    if (userStakeIds[poolId][msg.sender].length == 0) {
      noUsersStaked[poolId] -= 1;
    }
    _deleteStakingInfo(poolId, stakeId);

    TokenTransfer._depositAndReturnSpare(
      pool.yieldToken,
      msg.sender,
      treasury,
      requireAmnt
    );
    // return stake
    TokenTransfer._transferToken(pool.stakeToken, msg.sender, staking.amount);

    emit Repay(poolId, stakeId, pool.stakeToken, staking.amount, requireAmnt);
  }
}

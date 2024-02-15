# Future yield staking contracts

Staking ETH or USDB to receive future yield tokens

## Smart contracts

### NonLockStakingPool

Non-locking staking pools, user can use this contract to stake ETH and USDB to receive fyETH and fyUSDB.
User staking will not be locked and can be unstaked at anytime, yield token will be paid when users unstake or claim reward.

### LockStakingPool

ETH and USDB staking pool will be locked for a certain period. Future yield will be paid at the moment of staking.
User can unlock their staked positions prematurely by repaying the expected yield in future yield tokens (fyETH or fyUSD) or their staked token.

### RoleControl

Governance contract to store user credentials on all other contracts.

### YieldToken

This is the ERC20 contract for fyETH and fyUSD.

### IDOPool

IDO staking pools to stake fyETH and fyUSD

### TokenTransfer

helper library to handling ERC20 and ETH transfer
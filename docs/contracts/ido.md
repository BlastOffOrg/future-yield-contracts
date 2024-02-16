# IDO Pool using Future Yield (YIDO)

IDO Pools using both native token (USDB/ETH) and future yield token (fyUSD/fyETH) to fund IDO projects.

IDO process is work as follow:

1. New IDO pool is deployed with set IDO size in USD value.
2. Users deposit tokens (both native and future yield can be accepted) into IDO pool
3. At the moment IDO ends, IDO contracts took a snapshot of ETH price to calculate total USD value deposited into the pools
  - If total USD value is under IDO size, user can claim the amount of IDO token according to their value deposited into the pool.
  - If total USD value exceeds IDO size, amount of IDO token claimable by user is calculated as following:

$$userClaimableAmount = \frac{userUSDValueDeposited \times IDOAmount}{totalUSDValueDeposit}$$

if this happens, user will be refunded amount of ETH/USDB exceeded USD value of the IDO token they received.

## Contracts

### IDOPoolAbsctract

Abstract contract for IDO pools without the pricing snapshot logic at the end of the IDO.
Function `_getTokenUSDPrice()` need to be implemented to return value of staking token in USD value.

See on [Github](https://github.com/BlastOffOrg/future-yield-contracts/blob/main/contracts/ido/IDOPoolAbstract.sol)

### ETHPriceOracle

abstract contract to get ETH/USD price using [Redstone Oracle](https://redstone.finance/).

See on [Github](https://github.com/BlastOffOrg/future-yield-contracts/blob/main/contracts/oracle/ETHPriceOracle.sol)

### USDIDOPool

IDO pool for USDB and fyUSD tokens.

See on [Github](https://github.com/BlastOffOrg/future-yield-contracts/blob/main/contracts/ido/USDIDOPool.sol)

### ETHIDOPool

IDO pool for ETH and fyETH tokens. Token price at IDO end is snapshotted using `ETHPriceOracle`.

See on [Github](https://github.com/BlastOffOrg/future-yield-contracts/blob/main/contracts/ido/ETHIDOPool.sol)

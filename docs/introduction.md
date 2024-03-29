# Introduction

BlastOff project includes 3 main components at the time this documemt was written: 

* Future yield minting vault.
* Staking vault.
* IDO pools using future yield.

All these component revolving around the concept of future yield token (fyUSD and fyETH).
These future yield token is collateralized 1:1 by native yield of staking USD/ETH.
Future yield can be paid even before native yield is generated and can be used on other DeFi on Blast 
for capital mobility.

### Future yield minting vault

This vault allows you to stake ETH/USDB and immediately minting future yield tokens (fyETH/fyUSD).
As user's staking position is locked inside the vault, these future yield tokens can be considered debt statements for the native yield generated.
As Native yield accrue from the locked tokens, these debt will also gradually reduced. To unlock staked token, user can either wait through
maturity or can repay the debt using either ETH/USDB or corresponding future yield token.

More info on how this vault works can be found on [minting vault contract](./contracts/mint-vault.md).

### Staking vault

Staking vault will generate future yield token as it is generated by the staked ETH/USDB.
In the future, this vault will acted as a yield aggregator with corresponding investment strategy.

### IDO pool using future yield (YIDO)

IDO platform using both future yield tokens (fyUSD/fyETH) and native Blast token (ETH/USDB) to fund IDO projects.
At the time of writing. More information of how this IDO pools work can be found on [IDP pool contract](./contract.md).

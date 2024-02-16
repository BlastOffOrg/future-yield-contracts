# Yield Token

## YieldToken

ERC20 contract for fyETH and fyUSD.
At the time of writting of this documents, this token can only be transfer to or from whitlelisted address.
Address with `WHITELIST_ADMIN` role in [`RoleControl`](./governance.md#rolecontrol) can whitelist address.
Only address with `MINTER_ROLE` can mint new token.
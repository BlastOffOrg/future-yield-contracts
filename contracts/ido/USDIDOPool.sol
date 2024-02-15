// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IDOPoolAbstract.sol";

contract USDIDOPool is Initializable, IDOPoolAbstract {
  function init(
    address usdb_,
    address fyUSD_,
    address idoToken_,
    uint256 idoDecimals_,
    address treasury_
  ) external initializer {
    __IDOPoolAbstract_init(usdb_, fyUSD_, idoToken_, idoDecimals_, treasury_);
  }

  function _getTokenUSDPrice()
    internal
    view
    virtual
    override
    returns (uint256, uint256)
  {
    return (1, 1);
  }
}

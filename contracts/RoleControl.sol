// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

contract RoleControl is AccessControlEnumerableUpgradeable {

  function init() external initializer {
    __AccessControlEnumerable_init();
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }
}
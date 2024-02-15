// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interface/IERC20Mintable.sol";
import "./interface/IRoleControl.sol";

contract YieldToken is IERC20Mintable, ERC20 {
  error NotWhitelisted();
  error NotAuthorized(address acc);
  bytes32 public constant MINTING_ROLE = keccak256("MINTING_ROLE");
  bytes32 public constant WHITELIST_ADMIN = keccak256("WHITELIST_ADMIN");

  mapping(address => bool) public whitelist;
  bool public whitelistEnabled = true;
  IRoleControl roleControl;

  modifier hasMintingRole() {
    if (!roleControl.hasRole(MINTING_ROLE, _msgSender()))
      revert NotAuthorized(_msgSender());
    _;
  }

  modifier hasWhitelistAdminRole() {
    if (!roleControl.hasRole(WHITELIST_ADMIN, _msgSender()))
      revert NotAuthorized(_msgSender());
    _;
  }

  constructor(
    string memory name_,
    string memory symbol_,
    address roleControl_
  ) ERC20(name_, symbol_) {
    roleControl = IRoleControl(roleControl_);
  }

  function mint(
    address receipient,
    uint256 amount
  ) external override hasMintingRole {
    _mint(receipient, amount);
  }

  function whitelistAddress(address target) external hasWhitelistAdminRole {
    whitelist[target] = true;
  }

  function unwhitelistAddress(address target) external hasWhitelistAdminRole {
    delete whitelist[target];
  }

  function setEnableWhitelist(bool enable) external hasWhitelistAdminRole {
    whitelistEnabled = enable;
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 value
  ) internal virtual override {
    if (
      (from != address(0) && to != address(0)) &&
      whitelistEnabled &&
      (!(whitelist[from] || whitelist[to]))
    ) revert NotWhitelisted();
    super._beforeTokenTransfer(from, to, value);
  }
}

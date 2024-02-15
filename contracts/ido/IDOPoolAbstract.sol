// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interface/IIDOPool.sol";
import "../lib/TokenTransfer.sol";
import "hardhat/console.sol";

abstract contract IDOPoolAbstract is IIDOPool, OwnableUpgradeable {
  address public buyToken;
  address public fyToken;
  address public treasury;

  address public idoToken;
  bool public isFinalized;

  uint256 public idoPrice; // expected price of ido
  uint256 public idoSize; // total amount of ido token
  uint256 public snapshotTokenPrice;
  uint256 public snapshotPriceDecimals;
  uint256 private fundedUSDValue;
  uint256 private idoDecimals;
  mapping(address => uint256) private totalFunded;
  mapping(address => Position) public accountPosition;

  modifier notFinalized() {
    if (isFinalized) revert AlreadyFinalized();
    _;
  }
  modifier finalized() {
    if (!isFinalized) revert NotFinalized();
    _;
  }

  function __IDOPoolAbstract_init(
    address buyToken_,
    address fyToken_,
    address idoToken_,
    uint256 idoDecimals_,
    address treasury_
  ) internal onlyInitializing {
    __IDOPoolAbstract_init_unchained(
      buyToken_,
      fyToken_,
      idoToken_,
      idoDecimals_,
      treasury_
    );
    __Ownable_init();
  }

  function __IDOPoolAbstract_init_unchained(
    address buyToken_,
    address fyToken_,
    address idoToken_,
    uint256 idoDecimals_,
    address treasury_
  ) internal onlyInitializing {
    buyToken = buyToken_;
    fyToken = fyToken_;
    idoToken = idoToken_;
    idoDecimals = idoDecimals_;
    treasury = treasury_;
  }

  function setIDOToken(
    address _token,
    uint256 _idoDecimals
  ) external onlyOwner {
    idoToken = _token;
    idoDecimals = _idoDecimals;
  }

  function _getTokenUSDPrice()
    internal
    view
    virtual
    returns (uint256 price, uint256 decimals);

  /**
   *
   * @param price usd price of 10 ** decimals of IDO token
   */
  function setTokenPriceInUSD(uint256 price) external onlyOwner {
    idoPrice = price;
  }

  function finalize() external onlyOwner notFinalized {
    idoSize = IERC20(idoToken).balanceOf(address(this));
    (snapshotTokenPrice, snapshotPriceDecimals) = _getTokenUSDPrice();
    fundedUSDValue =
      ((totalFunded[buyToken] + totalFunded[fyToken]) * snapshotTokenPrice) /
      snapshotPriceDecimals;
    idoSize = IERC20(idoToken).balanceOf(address(this));
    isFinalized = true;
  }

  function getPostionValue(
    Position memory pos
  ) internal view returns (uint256 allocated, uint256 excessive) {
    uint256 posInUSD = (pos.amount * snapshotTokenPrice) /
      snapshotPriceDecimals; // position value in USD

    uint256 idoExp = (10 ** idoDecimals);
    // amount of ido received if exceeded funding goal
    uint256 exceedAlloc = (idoSize * posInUSD) / fundedUSDValue;
    // amount of ido token received if not exceeded goal
    uint256 buyAlloc = (posInUSD * idoExp) / idoPrice;
    if (((idoSize * idoPrice) / idoExp) >= fundedUSDValue) {
      return (buyAlloc, 0);
    } else {
      uint256 excessiveInUSD = posInUSD - ((exceedAlloc * idoExp) / idoPrice);
      return (
        exceedAlloc,
        (excessiveInUSD * snapshotPriceDecimals) / snapshotTokenPrice
      );
    }
  }

  function participate(
    address receipient,
    address token,
    uint256 amount
  ) external payable notFinalized {
    if (token != buyToken && token != fyToken)
      revert InvalidParticipateToken(token);
    Position storage position = accountPosition[receipient];
    if (position.amount != 0 && token != position.token)
      revert ParticipateWithDifferentToken(token);

    position.token = token;
    position.amount += amount;
    totalFunded[token] += amount;

    TokenTransfer._depositToken(token, receipient, amount);
    emit Participation(receipient, token, amount);
  }

  function claim(address staker) external finalized {
    Position memory pos = accountPosition[staker];
    if (pos.amount == 0) revert NoStaking();

    (uint256 alloc, uint256 excessive) = getPostionValue(pos);

    delete accountPosition[staker];
    if (excessive > 0)
      TokenTransfer._transferToken(pos.token, staker, excessive);
    TokenTransfer._transferToken(pos.token, treasury, pos.amount - excessive);
    TokenTransfer._transferToken(idoToken, staker, alloc);

    emit Claim(staker, alloc, excessive);
  }

  function withdrawSpareIDO() external finalized onlyOwner {
    uint256 totalValueBought = (idoSize * idoPrice) / (10 ** idoDecimals);
    if (totalValueBought >= fundedUSDValue) return;

    uint256 totalBought = (fundedUSDValue * snapshotPriceDecimals) /
      snapshotTokenPrice;
    uint256 spare = idoSize - totalBought;
    TokenTransfer._transferToken(idoToken, msg.sender, spare);
  }
}

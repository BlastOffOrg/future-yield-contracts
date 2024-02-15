import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ethers } from 'hardhat';
import { MockERC20, USDIDOPool } from '../typechain';
import { deployMockERC20, deployUSDIDOPool } from './helpers/deploy';
use(chaiAsPromised);

let DECIMAL = 10n ** 18n;

describe('USD IDO pools test', () => {
  let deployer: SignerWithAddress,
    treasury: SignerWithAddress,
    users: SignerWithAddress[];
  let idoPool: USDIDOPool;
  let fyUSD: MockERC20, usdb: MockERC20, idoToken: MockERC20;

  beforeEach(async () => {
    [deployer, treasury, ...users] = await ethers.getSigners();
    fyUSD = await deployMockERC20(deployer);
    idoToken = await deployMockERC20(deployer);
    usdb = await deployMockERC20(deployer);

    idoPool = await deployUSDIDOPool(
      deployer,
      usdb.address,
      fyUSD.address,
      idoToken.address,
      await idoToken.decimals(),
      treasury.address
    );
  });

  it('can set ido price', async () => {
    const tx = idoPool.connect(users[0]).setTokenPriceInUSD(DECIMAL);
    await expect(tx).rejectedWith('Ownable: caller is not the owner');

    await idoPool.setTokenPriceInUSD(DECIMAL);
  });

  it('user can participate', async () => {
    await idoPool.setTokenPriceInUSD(DECIMAL);

    await fyUSD.mint(users[0].address, 1000n * DECIMAL);
    await fyUSD.connect(users[0]).approve(idoPool.address, 1000n * DECIMAL);
    await usdb.mint(users[1].address, 1000n * DECIMAL);
    await usdb.connect(users[1]).approve(idoPool.address, 1000n * DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyUSD.address, 1000n * DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, usdb.address, 1000n * DECIMAL);
  });

  it('cannot claim before finalized', async () => {
    await idoPool.setTokenPriceInUSD(DECIMAL);
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyUSD.mint(users[0].address, 1000n * DECIMAL);
    await fyUSD.connect(users[0]).approve(idoPool.address, 1000n * DECIMAL);
    await usdb.mint(users[1].address, 1000n * DECIMAL);
    await usdb.connect(users[1]).approve(idoPool.address, 1000n * DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyUSD.address, 1000n * DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, usdb.address, 1000n * DECIMAL);

    const tx = idoPool.connect(users[0]).claim(users[0].address);
    await expect(tx).rejectedWith('NotFinalized()');
  });

  it('can finalized', async () => {
    await idoPool.setTokenPriceInUSD(DECIMAL);
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyUSD.mint(users[0].address, 1000n * DECIMAL);
    await fyUSD.connect(users[0]).approve(idoPool.address, 1000n * DECIMAL);
    await usdb.mint(users[1].address, 1000n * DECIMAL);
    await usdb.connect(users[1]).approve(idoPool.address, 1000n * DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyUSD.address, 1000n * DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, usdb.address, 1000n * DECIMAL);

    const wrapIdoPool = WrapperBuilder.wrap(idoPool).usingSimpleNumericMock({
      mockSignersCount: 10,
      timestampMilliseconds: Date.now(),
      dataPoints: [{ dataFeedId: 'ETH', value: 1000 }],
    });

    await wrapIdoPool.finalize();
    await idoPool.connect(users[0]).claim(users[0].address);
    expect((await idoToken.balanceOf(users[0].address)).toBigInt()).deep.eq(
      1000n * DECIMAL
    );
    await idoPool.connect(users[1]).claim(users[1].address);
    expect((await idoToken.balanceOf(users[1].address)).toBigInt()).deep.eq(
      1000n * DECIMAL
    );
  });

  it('withdraw spare not effect token claim', async () => {
    await idoPool.setTokenPriceInUSD(DECIMAL);
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyUSD.mint(users[0].address, 1000n * DECIMAL);
    await fyUSD.connect(users[0]).approve(idoPool.address, 1000n * DECIMAL);
    await usdb.mint(users[1].address, 1000n * DECIMAL);
    await usdb.connect(users[1]).approve(idoPool.address, 1000n * DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyUSD.address, 1000n * DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, usdb.address, 1000n * DECIMAL - 12n);

    const wrapIdoPool = WrapperBuilder.wrap(idoPool).usingSimpleNumericMock({
      mockSignersCount: 10,
      timestampMilliseconds: Date.now(),
      dataPoints: [{ dataFeedId: 'ETH', value: 1000 }],
    });

    await wrapIdoPool.finalize();
    await idoPool.connect(users[0]).claim(users[0].address);
    expect((await idoToken.balanceOf(users[0].address)).toBigInt()).deep.eq(
      1000n * DECIMAL
    );
    await idoPool.withdrawSpareIDO();
    await idoPool.connect(users[1]).claim(users[1].address);
    expect((await idoToken.balanceOf(users[1].address)).toBigInt()).deep.eq(
      1000n * DECIMAL - 12n
    );
  });

  it('cannot participate after finalized', async () => {
    await idoPool.setTokenPriceInUSD(DECIMAL);
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyUSD.mint(users[0].address, 1000n * DECIMAL);
    await fyUSD.connect(users[0]).approve(idoPool.address, 1000n * DECIMAL);
    await usdb.mint(users[1].address, 1000n * DECIMAL);
    await usdb.connect(users[1]).approve(idoPool.address, 1000n * DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyUSD.address, 1000n * DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, usdb.address, 1000n * DECIMAL);

    const wrapIdoPool = WrapperBuilder.wrap(idoPool).usingSimpleNumericMock({
      mockSignersCount: 10,
      timestampMilliseconds: Date.now(),
      dataPoints: [{ dataFeedId: 'ETH', value: 1000 }],
    });

    await wrapIdoPool.finalize();

    const tx = idoPool
      .connect(users[1])
      .participate(users[1].address, ethers.constants.AddressZero, DECIMAL, {
        value: DECIMAL,
      });
    expect(tx).rejectedWith('AlreadyFinalized()');
  });

  it('refund correct amount after finalized', async () => {
    await idoPool.setTokenPriceInUSD(DECIMAL);
    await idoToken.mint(idoPool.address, DECIMAL * 1000n);

    await fyUSD.mint(users[0].address, 1000n * DECIMAL);
    await fyUSD.connect(users[0]).approve(idoPool.address, 1000n * DECIMAL);
    await usdb.mint(users[1].address, 1000n * DECIMAL);
    await usdb.connect(users[1]).approve(idoPool.address, 1000n * DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyUSD.address, 1000n * DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, usdb.address, 1000n * DECIMAL);
    const wrapIdoPool = WrapperBuilder.wrap(idoPool).usingSimpleNumericMock({
      mockSignersCount: 10,
      timestampMilliseconds: Date.now(),
      dataPoints: [{ dataFeedId: 'ETH', value: 1000 }],
    });

    const stakers = users.slice(0, 2);

    await wrapIdoPool.finalize();

    await Promise.all(
      stakers.map(async (staker) =>
        idoPool.connect(staker).claim(staker.address)
      )
    );
    const bal = await Promise.all(
      stakers.map(async (user) => {
        const b = await idoToken.balanceOf(user.address);
        return b.toBigInt();
      })
    );
    const afterBal = await Promise.all(
      stakers.map(async (staker) => ethers.provider.getBalance(staker.address))
    );
    expect(bal).deep.equal(Array(2).fill(500n * DECIMAL));
    expect((await fyUSD.balanceOf(stakers[0].address)).toBigInt()).eq(
      DECIMAL * 1000n / 2n
    );
    expect((await usdb.balanceOf(stakers[1].address)).toBigInt()).eq(
      (DECIMAL * 1000n) / 2n
    );
  });
});

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { WrapperBuilder } from '@redstone-finance/evm-connector';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { ETHIDOPool, MockERC20 } from '../typechain';
import { deployETHIDOPool, deployMockERC20 } from './helpers/deploy';
import { getFee } from './helpers/tx';
use(chaiAsPromised);

let DECIMAL = 10n ** 18n;

describe('ETH IDO pools test', () => {
  let deployer: SignerWithAddress,
    treasury: SignerWithAddress,
    users: SignerWithAddress[];
  let idoPool: ETHIDOPool;
  let fyETH: MockERC20, idoToken: MockERC20;

  beforeEach(async () => {
    [deployer, treasury, ...users] = await ethers.getSigners();
    fyETH = await deployMockERC20(deployer);
    idoToken = await deployMockERC20(deployer);

    idoPool = await deployETHIDOPool(
      deployer,
      fyETH.address,
      idoToken.address,
      await idoToken.decimals(),
      treasury.address,
      0,
      0,
      0,
      DECIMAL
    );
  });

  it('user can participate', async () => {
    await fyETH.mint(users[0].address, DECIMAL);

    await fyETH.connect(users[0]).approve(idoPool.address, DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyETH.address, DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, ethers.constants.AddressZero, DECIMAL, {
        value: DECIMAL,
      });
  });

  it('cannot claim before finalized', async () => {
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyETH.mint(users[0].address, DECIMAL);

    await fyETH.connect(users[0]).approve(idoPool.address, DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyETH.address, DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, ethers.constants.AddressZero, DECIMAL, {
        value: DECIMAL,
      });

    const tx = idoPool.connect(users[0]).claim(users[0].address);
    await expect(tx).rejectedWith('NotFinalized()');
  });

  it('can finalized', async () => {
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyETH.mint(users[0].address, DECIMAL);

    await fyETH.connect(users[0]).approve(idoPool.address, DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyETH.address, DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, ethers.constants.AddressZero, DECIMAL, {
        value: DECIMAL,
      });

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
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyETH.mint(users[0].address, DECIMAL);

    await fyETH.connect(users[0]).approve(idoPool.address, DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyETH.address, DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(
        users[1].address,
        ethers.constants.AddressZero,
        DECIMAL - 12n,
        {
          value: DECIMAL - 12n,
        }
      );

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
      1000n * (DECIMAL - 12n)
    );
  });

  it('cannot participate after finalized', async () => {
    await idoToken.mint(idoPool.address, DECIMAL * 4000n);

    await fyETH.mint(users[0].address, DECIMAL);

    await fyETH.connect(users[0]).approve(idoPool.address, DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyETH.address, DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, ethers.constants.AddressZero, DECIMAL, {
        value: DECIMAL,
      });

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
    await idoToken.mint(idoPool.address, DECIMAL * 1000n);

    await fyETH.mint(users[0].address, DECIMAL);

    await fyETH.connect(users[0]).approve(idoPool.address, DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyETH.address, DECIMAL);
    await idoPool
      .connect(users[1])
      .participate(users[1].address, ethers.constants.AddressZero, DECIMAL, {
        value: DECIMAL,
      });

    const wrapIdoPool = WrapperBuilder.wrap(idoPool).usingSimpleNumericMock({
      mockSignersCount: 10,
      timestampMilliseconds: Date.now(),
      dataPoints: [{ dataFeedId: 'ETH', value: 1000 }],
    });

    const stakers = users.slice(0, 2);

    await wrapIdoPool.finalize();
    const etherBal = await Promise.all(
      stakers.map(async (staker) => ethers.provider.getBalance(staker.address))
    );
    const txs = await Promise.all(
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
    expect((await fyETH.balanceOf(stakers[0].address)).toBigInt()).eq(
      DECIMAL / 2n
    );
    const fee = getFee(await txs[1].wait());
    expect(afterBal[1].toBigInt()).eq(
      etherBal[1]
        .sub(fee)
        .add(BigNumber.from(DECIMAL / 2n))
        .toBigInt()
    );
  });

  it('refund correct amount after finalized when stake both type', async () => {
    await idoToken.mint(idoPool.address, DECIMAL * 1000n);

    await fyETH.mint(users[0].address, DECIMAL);
    await fyETH.mint(users[1].address, DECIMAL);

    await fyETH.connect(users[0]).approve(idoPool.address, DECIMAL);
    await fyETH.connect(users[1]).approve(idoPool.address, DECIMAL);

    await idoPool
      .connect(users[0])
      .participate(users[0].address, fyETH.address, DECIMAL / 4n);
    await idoPool
      .connect(users[0])
      .participate(
        users[0].address,
        ethers.constants.AddressZero,
        (3n * DECIMAL) / 4n,
        {
          value: (3n * DECIMAL) / 4n,
        }
      );
    await idoPool
      .connect(users[1])
      .participate(users[1].address, fyETH.address, (3n * DECIMAL) / 4n);
    await idoPool
      .connect(users[1])
      .participate(
        users[1].address,
        ethers.constants.AddressZero,
        DECIMAL / 4n,
        {
          value: DECIMAL / 4n,
        }
      );

    const wrapIdoPool = WrapperBuilder.wrap(idoPool).usingSimpleNumericMock({
      mockSignersCount: 10,
      timestampMilliseconds: Date.now(),
      dataPoints: [{ dataFeedId: 'ETH', value: 1000 }],
    });

    const stakers = users.slice(0, 2);

    await wrapIdoPool.finalize();
    const etherBal = (await Promise.all(
      stakers.map(async (staker) => ethers.provider.getBalance(staker.address))
    )).map((b) => b.toBigInt());
    const txs = await Promise.all(
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
    const fees = await Promise.all(
      txs.map(async (tx) => getFee(await tx.wait()).toBigInt())
    );
    expect(afterBal[0].toBigInt()).eq(etherBal[0] - fees[0] + DECIMAL / 4n);
    expect(afterBal[1].toBigInt()).eq(etherBal[1] - fees[1]);
  });
});

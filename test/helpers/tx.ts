import { BigNumber, ContractReceipt } from "ethers"

export const getFee = (tx: ContractReceipt): BigNumber => {
  return tx.effectiveGasPrice.mul(tx.gasUsed);
}
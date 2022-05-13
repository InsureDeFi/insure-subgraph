import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Deposit, Insured, PolicyPaid, Unlocked, Withdraw, WithdrawRequested } from '../generated/RiskPool/RiskPool';
import { Transfer } from '../generated/Vault/Vault';
import { PolicyInfo } from './../generated/schema';
import {
  getOrCreatePool,
  getOrCreateUser,
  getOrCreatePolicy,
  getUtilRateAndPoolPrice,
  RISK_POOL_ADDRESS,
  getTotalLiquidity,
  getOrCreateInsureDayData,
} from './helpers';

export function handleDeposit(event: Deposit): void {
  let pool = getOrCreatePool();
  pool.totalLiquidity = pool.totalLiquidity.plus(event.params.amount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate.reverted ? pool.utilizationRate : poolData.utilizationRate.value;
  pool.poolPrice = poolData.poolPrice.reverted ? pool.poolPrice : poolData.poolPrice.value;
  pool.save();

  let depositor = getOrCreateUser(event.params.depositor);
  depositor.liquidityProvided = depositor.liquidityProvided.plus(event.params.amount);
  depositor.save();
}

export function handleWithdrawRequested(event: WithdrawRequested): void {
  const withdrawer = getOrCreateUser(event.params.withdrawer);
  withdrawer.unlockAmount = event.params.amount;
  withdrawer.unlockTimestamp = event.params.unlockTime;
  withdrawer.save();
}

export function handleWithdraw(event: Withdraw): void {
  const pool = getOrCreatePool();
  pool.totalLiquidity = pool.totalLiquidity.minus(event.params.amount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate.reverted ? pool.utilizationRate : poolData.utilizationRate.value;
  pool.poolPrice = poolData.poolPrice.reverted ? pool.poolPrice : poolData.poolPrice.value;
  pool.save();
}

export function handleInsured(event: Insured): void {
  const pool = getOrCreatePool();
  const totalLiquidity = getTotalLiquidity(Address.fromString(RISK_POOL_ADDRESS));
  pool.totalLiquidity = totalLiquidity.reverted ? pool.totalLiquidity : totalLiquidity.value;
  pool.lockedAmount = pool.lockedAmount.plus(event.params.payOutAmount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate.reverted ? pool.utilizationRate : poolData.utilizationRate.value;
  pool.poolPrice = poolData.poolPrice.reverted ? pool.poolPrice : poolData.poolPrice.value;
  pool.policyCount = pool.policyCount + 1;
  pool.save();

  let insured = getOrCreateUser(event.params.insured);
  insured.policyCount = insured.policyCount + 1;
  insured.save();

  const policy = new PolicyInfo(event.params.policyId.toHex());
  policy.policyId = event.params.policyId;
  policy.asset = event.params.asset;
  policy.owner = insured.id;
  policy.payOutAmount = event.params.payOutAmount;
  policy.premium = event.params.premium.plus(event.params.settelmentFee);
  policy.endTime = event.params.endTime;
  policy.threshold = event.params.threshold.toI32();
  policy.startTime = event.block.timestamp;
  policy.utilized = false;
  policy.save();

  const insureDayData = getOrCreateInsureDayData(event);
  insureDayData.dailyVolume = insureDayData.dailyVolume.plus(event.params.premium);
  insureDayData.save();
}

export function handlePolicyPaid(event: PolicyPaid): void {
  const policy = getOrCreatePolicy(event.params.policyId);
  policy.utilized = true;
  policy.save();

  const pool = getOrCreatePool();
  pool.totalLiquidity = pool.totalLiquidity.minus(policy.payOutAmount);
  pool.lockedAmount = pool.lockedAmount.minus(policy.payOutAmount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate.reverted ? pool.utilizationRate : poolData.utilizationRate.value;
  pool.poolPrice = poolData.poolPrice.reverted ? pool.poolPrice : poolData.poolPrice.value;
  pool.save();
}

export function handleUnlocked(event: Unlocked): void {
  const pool = getOrCreatePool();
  pool.totalLiquidity = pool.totalLiquidity.minus(event.params.amountUnlocked);
  pool.lockedAmount = pool.lockedAmount.minus(event.params.amountUnlocked);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate.reverted ? pool.utilizationRate : poolData.utilizationRate.value;
  pool.poolPrice = poolData.poolPrice.reverted ? pool.poolPrice : poolData.poolPrice.value;
  pool.save();
}

export function handlePaused(): void {
  const pool = getOrCreatePool();
  pool.paused = true;
}

export function handleUnpaused(): void {
  const pool = getOrCreatePool();
  pool.paused = false;
}

export function handleTransfer(event: Transfer): void {
  if (event.params.from == Address.zero()) {
    return;
  }
  const pool = getOrCreatePool();
  const amountUSDC = event.params.value.times(pool.poolPrice).div(BigInt.fromString('1000000000000000000'));
  const fromUser = getOrCreateUser(event.params.from);
  fromUser.liquidityProvided = fromUser.liquidityProvided.minus(amountUSDC);
  fromUser.save();
  const toUser = getOrCreateUser(event.params.to);
  toUser.liquidityProvided = toUser.liquidityProvided.plus(amountUSDC);
  toUser.save();
}

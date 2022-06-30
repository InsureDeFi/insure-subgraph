import { Address } from '@graphprotocol/graph-ts';
import { Deposit, Insured, PolicyPaid, Unlocked, Withdraw, WithdrawRequested } from '../generated/RiskPool/RiskPool';
import { Transfer } from '../generated/Vault/Vault';
import {
  createPool,
  createUser,
  createPolicy,
  getUtilRateAndPoolPrice,
  RISK_POOL_ADDRESS,
  getTotalLiquidity,
  createInsureDayData,
  ZERO_BI,
  bigIntExp18,
} from './helpers';

export function handleDeposit(event: Deposit): void {
  let pool = createPool();
  pool.totalLiquidity = pool.totalLiquidity.plus(event.params.amount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate;
  pool.poolPrice = poolData.poolPrice;
  pool.save();

  let depositor = createUser(event.params.depositor);
  depositor.liquidityProvided = depositor.liquidityProvided.plus(event.params.amount);
  depositor.save();
}

export function handleWithdrawRequested(event: WithdrawRequested): void {
  const withdrawer = createUser(event.params.withdrawer);
  withdrawer.unlockAmount = event.params.amount;
  withdrawer.unlockTimestamp = event.params.unlockTime;
  withdrawer.save();
}

export function handleWithdraw(event: Withdraw): void {
  const pool = createPool();
  pool.totalLiquidity = pool.totalLiquidity.minus(event.params.amount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate;
  pool.poolPrice = poolData.poolPrice;
  pool.save();
}

export function handleInsured(event: Insured): void {
  const pool = createPool();
  const totalLiquidity = getTotalLiquidity(Address.fromString(RISK_POOL_ADDRESS));
  pool.totalLiquidity = totalLiquidity;
  pool.lockedAmount = pool.lockedAmount.plus(event.params.payOutAmount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate;
  pool.poolPrice = poolData.poolPrice;
  pool.policyCount = pool.policyCount + 1;
  pool.save();

  let insured = createUser(event.params.insured);
  insured.policyCount = insured.policyCount + 1;
  insured.save();

  const policy = createPolicy(event.params.policyId);
  policy.policyId = event.params.policyId;
  policy.asset = event.params.asset;
  policy.assetPrice = event.params.currentAssetPrice;
  policy.owner = insured.id;
  policy.payOutAmount = event.params.payOutAmount;
  policy.premium = event.params.premium.plus(event.params.settelmentFee);
  policy.endTime = event.params.endTime;
  policy.startTime = event.block.timestamp;
  policy.utilized = false;
  policy.save();

  const insureDayData = createInsureDayData(event);
  insureDayData.dailyVolume = insureDayData.dailyVolume.plus(event.params.premium);
  insureDayData.save();
}

export function handlePolicyPaid(event: PolicyPaid): void {
  const policy = createPolicy(event.params.policyId);
  policy.utilized = true;
  policy.save();

  const pool = createPool();
  pool.totalLiquidity = pool.totalLiquidity.minus(policy.payOutAmount);
  pool.lockedAmount = pool.lockedAmount.minus(policy.payOutAmount);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate;
  pool.poolPrice = poolData.poolPrice;
  pool.save();
}

export function handleUnlocked(event: Unlocked): void {
  const pool = createPool();
  pool.totalLiquidity = pool.totalLiquidity.minus(event.params.amountUnlocked);
  pool.lockedAmount = pool.lockedAmount.minus(event.params.amountUnlocked);
  pool.availableLiquidity = pool.totalLiquidity.minus(pool.lockedAmount);
  const poolData = getUtilRateAndPoolPrice(Address.fromString(RISK_POOL_ADDRESS));
  pool.utilizationRate = poolData.utilizationRate;
  pool.poolPrice = poolData.poolPrice;
  pool.save();
}

export function handlePaused(): void {
  const pool = createPool();
  pool.paused = true;
}

export function handleUnpaused(): void {
  const pool = createPool();
  pool.paused = false;
}

export function handleTransfer(event: Transfer): void {
  if (event.params.from == Address.zero()) {
    return;
  }
  const pool = createPool();
  const amountUSDC = event.params.value.times(pool.poolPrice).div(bigIntExp18());
  const fromUser = createUser(event.params.from);
  fromUser.liquidityProvided = fromUser.liquidityProvided.minus(amountUSDC).lt(ZERO_BI)
    ? ZERO_BI
    : fromUser.liquidityProvided.minus(amountUSDC);
  fromUser.save();

  if (event.params.to != Address.zero()) {
    const toUser = createUser(event.params.to);
    toUser.liquidityProvided = toUser.liquidityProvided.plus(amountUSDC);
    toUser.save();
  }
}

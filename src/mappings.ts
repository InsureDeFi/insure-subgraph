import { BigInt } from '@graphprotocol/graph-ts';
import { integer, ZERO_ADDRESS } from '@protofire/subgraph-toolkit';
import {
  AssetInitialized,
  Deposit,
  Insured,
  PolicyPaid,
  Transfer,
  Unlocked,
  Withdraw,
} from '../generated/RiskPool/RiskPool';
import { Deposit as DepositEvent, Withdraw as WithdrawEvent, Policy as PolicyEvent } from '../generated/schema';
import { updateAssetDayData, updatePoolDayData, updatePoolHourData } from './dayUpdates';
import {
  createPool,
  createUser,
  createAsset,
  getTotalAssets,
  convertTokenToDecimal,
  BI_6,
  createTransaction,
  createLiquidityPosition,
  createLiquiditySnapshot,
  BI_18,
  createPolicy,
} from './helpers';

export function handleAssetInitialized(event: AssetInitialized): void {
  let pool = createPool();

  let asset = createAsset(event.params.asset);
  asset.assetId = event.params.assetId;
  asset.addedAtTimestamp = event.block.timestamp;
  asset.addedAtBlockNumber = event.block.number;
  asset.save();

  pool.assets = pool.assets.concat([asset.id]);
  pool.save();
}

export function handleTransfer(event: Transfer): void {
  let from = createUser(event.params.from);
  let to = createUser(event.params.to);
  let shares = convertTokenToDecimal(event.params.value, BI_6);

  if (from.id != ZERO_ADDRESS) {
    let fromUserLiquidityPosition = createLiquidityPosition(event.params.from);
    fromUserLiquidityPosition.shares = fromUserLiquidityPosition.shares.minus(shares);
    fromUserLiquidityPosition.save();
    createLiquiditySnapshot(fromUserLiquidityPosition, event);
  }

  if (to.id != ZERO_ADDRESS) {
    let toUserLiquidityPosition = createLiquidityPosition(event.params.to);
    toUserLiquidityPosition.shares = toUserLiquidityPosition.shares.plus(shares);
    toUserLiquidityPosition.save();
    createLiquiditySnapshot(toUserLiquidityPosition, event);
  }
}

export function handleDeposit(event: Deposit): void {
  let pool = createPool();
  let transaction = createTransaction(event.transaction.hash.toHexString(), event);

  let deposits = transaction.deposits;
  let deposit = new DepositEvent(
    event.transaction.hash.toHexString().concat('-').concat(BigInt.fromI32(deposits.length).toString())
  );
  deposit.transaction = transaction.id;
  deposit.timestamp = transaction.timestamp;
  deposit.to = event.params.owner.toHexString();
  deposit.liquidityTokens = convertTokenToDecimal(event.params.shares, BI_6);
  deposit.caller = event.params.caller.toHexString();
  deposit.assets = convertTokenToDecimal(event.params.assets, BI_6);
  deposit.save();

  transaction.deposits = deposits.concat([deposit.id]);
  transaction.save();

  pool.sharesTotalSupply = pool.sharesTotalSupply.plus(convertTokenToDecimal(event.params.shares, BI_6));
  pool.txCount = pool.txCount.plus(integer.ONE);
  pool.totalAssets = getTotalAssets();
  pool.availableAssets = pool.totalAssets.minus(pool.lockedAssets);
  pool.utilizationRate = pool.lockedAssets.div(pool.totalAssets);
  pool.depositHistory = pool.depositHistory.concat([deposit.id]);
  pool.save();

  let liquidityPosition = createLiquidityPosition(event.params.owner);
  createLiquiditySnapshot(liquidityPosition, event);

  updatePoolDayData(event);
  updatePoolHourData(event);
}

export function handleWithdraw(event: Withdraw): void {
  let pool = createPool();
  let transaction = createTransaction(event.transaction.hash.toHexString(), event);

  let withdrawals = transaction.withdrawals;
  let withdrawal = new WithdrawEvent(
    event.transaction.hash.toHexString().concat('-').concat(BigInt.fromI32(withdrawals.length).toString())
  );
  withdrawal.transaction = transaction.id;
  withdrawal.timestamp = transaction.timestamp;
  withdrawal.to = event.params.receiver.toHexString();
  withdrawal.liquidityTokens = convertTokenToDecimal(event.params.shares, BI_6);
  withdrawal.owner = event.params.owner.toHexString();
  withdrawal.caller = event.params.caller.toHexString();
  withdrawal.assets = convertTokenToDecimal(event.params.assets, BI_6);
  withdrawal.save();

  transaction.withdrawals = withdrawals.concat([withdrawal.id]);
  transaction.save();

  pool.sharesTotalSupply = pool.sharesTotalSupply.minus(convertTokenToDecimal(event.params.shares, BI_6));
  pool.txCount = pool.txCount.plus(integer.ONE);
  pool.totalAssets = getTotalAssets();
  pool.availableAssets = pool.totalAssets.minus(pool.lockedAssets);
  pool.utilizationRate = pool.lockedAssets.div(pool.totalAssets);
  pool.withdrawalHistory = pool.withdrawalHistory.concat([withdrawal.id]);
  pool.save();

  let liquidityPosition = createLiquidityPosition(event.params.owner);
  createLiquiditySnapshot(liquidityPosition, event);

  updatePoolDayData(event);
  updatePoolHourData(event);
}

export function handleInsured(event: Insured): void {
  let pool = createPool();
  let asset = createAsset(event.params.asset);

  asset.volume = asset.volume.plus(convertTokenToDecimal(event.params.payOutAmount, BI_6));
  asset.txCount = asset.txCount.plus(integer.ONE);
  asset.save();

  let insured = createUser(event.params.insured);
  insured.policyCount = insured.policyCount.plus(integer.ONE);
  insured.save();

  let transaction = createTransaction(event.transaction.hash.toHexString(), event);
  let policies = transaction.policies;
  let policy = new PolicyEvent(event.params.policyId.toString());
  policy.transaction = transaction.id;
  policy.asset = event.params.asset;
  policy.assetPrice = convertTokenToDecimal(event.params.currentAssetPrice, BI_18);
  policy.insured = createUser(event.params.insured).id;
  policy.payOutAmount = convertTokenToDecimal(event.params.payOutAmount, BI_6);
  policy.premium = convertTokenToDecimal(event.params.premium.plus(event.params.protocolFee), BI_6);
  policy.startTime = event.block.timestamp;
  policy.endTime = event.params.endTime;
  policy.threshold = event.params.threshold;
  policy.utilized = false;
  policy.save();

  transaction.policies = policies.concat([policy.id]);
  transaction.save();

  let volume = convertTokenToDecimal(
    event.params.payOutAmount.plus(event.params.premium).plus(event.params.protocolFee),
    BI_6
  );
  pool.totalVolume = pool.totalVolume.plus(volume);
  pool.policyCount = pool.policyCount.plus(integer.ONE);
  pool.txCount = pool.txCount.plus(integer.ONE);
  pool.totalAssets = getTotalAssets();
  pool.lockedAssets = pool.lockedAssets.plus(convertTokenToDecimal(event.params.payOutAmount, BI_6));
  pool.availableAssets = pool.totalAssets.minus(pool.lockedAssets);
  pool.utilizationRate = pool.lockedAssets.div(pool.totalAssets);
  pool.policyHistory = pool.policyHistory.concat([policy.id]);
  pool.save();

  let poolDayData = updatePoolDayData(event);
  let poolHourData = updatePoolHourData(event);
  let assetDayData = updateAssetDayData(asset, event);

  poolDayData.dailyVolume = poolDayData.dailyVolume.plus(volume);
  poolDayData.protocolFee = poolDayData.protocolFee.plus(convertTokenToDecimal(event.params.protocolFee, BI_6));
  poolDayData.save();

  poolHourData.hourlyVolume = poolHourData.hourlyVolume.plus(volume);
  poolHourData.save();

  assetDayData.dailyVolume = assetDayData.dailyVolume.plus(volume);
  assetDayData.save();
}

export function handlePolicyPaid(event: PolicyPaid): void {
  let policy = createPolicy(event.params.policyId);
  policy.utilized = true;
  policy.save();

  let pool = createPool();
  pool.totalAssets = getTotalAssets();
  pool.lockedAssets = pool.lockedAssets.minus(policy.payOutAmount);
  pool.availableAssets = pool.totalAssets.minus(pool.lockedAssets);
  pool.utilizationRate = pool.lockedAssets.div(pool.totalAssets);
  pool.save();
}

export function handleUnlocked(event: Unlocked): void {
  let pool = createPool();
  pool.totalAssets = getTotalAssets();
  pool.lockedAssets = pool.lockedAssets.minus(convertTokenToDecimal(event.params.assetsUnlocked, BI_6));
  pool.availableAssets = pool.totalAssets.minus(pool.lockedAssets);
  pool.utilizationRate = pool.lockedAssets.div(pool.totalAssets);
  pool.save();
}

export function handlePaused(): void {
  let pool = createPool();
  pool.paused = true;
  pool.save();
}

export function handleUnpaused(): void {
  let pool = createPool();
  pool.paused = false;
  pool.save();
}

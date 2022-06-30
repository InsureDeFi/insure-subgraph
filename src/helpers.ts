import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { RiskPool } from '../generated/RiskPool/RiskPool';
import { InsureDayData, Owner, PolicyInfo, PoolInfo } from '../generated/schema';

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
export const RISK_POOL_ADDRESS = '0xFd153eB5B484b5c304c2E004dF82f07f48d884aE';
export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');

class PoolData {
  utilizationRate: BigDecimal;
  poolPrice: BigInt;
}

export function bigIntExp18(): BigInt {
  return BigInt.fromString('1000000000000000000');
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString('1000000000000000000');
}

export function createPool(): PoolInfo {
  let pool = PoolInfo.load(RISK_POOL_ADDRESS);
  if (pool === null) {
    pool = new PoolInfo(RISK_POOL_ADDRESS);
    pool.totalLiquidity = ZERO_BI;
    pool.availableLiquidity = ZERO_BI;
    pool.lockedAmount = ZERO_BI;
    pool.utilizationRate = ZERO_BD;
    pool.poolPrice = ZERO_BI;
    pool.policyCount = 0;
    pool.paused = false;
  }
  return pool;
}

export function createUser(address: Address): Owner {
  let user = Owner.load(address.toHexString());
  if (user === null) {
    user = new Owner(address.toHexString());
    user.policyCount = 0;
    user.liquidityProvided = ZERO_BI;
    user.unlockTimestamp = ZERO_BI;
    user.unlockAmount = ZERO_BI;
  }
  return user;
}

export function createPolicy(policyId: BigInt): PolicyInfo {
  let policy = PolicyInfo.load(policyId.toHex());
  if (policy === null) {
    policy = new PolicyInfo(policyId.toHex());
    policy.policyId = policyId;
    policy.asset = '';
    policy.assetPrice = ZERO_BI;
    policy.owner = ADDRESS_ZERO;
    policy.payOutAmount = ZERO_BI;
    policy.premium = ZERO_BI;
    policy.endTime = ZERO_BI;
    policy.startTime = ZERO_BI;
    policy.utilized = false;
  }
  return policy;
}

export function getUtilRateAndPoolPrice(poolAddress: Address): PoolData {
  const pool = RiskPool.bind(poolAddress);
  const utilizationRate = pool.utilizationRate().divDecimal(bigDecimalExp18());
  const poolPrice = pool.poolPrice();
  return { utilizationRate, poolPrice };
}

export function getTotalLiquidity(poolAddress: Address): BigInt {
  const pool = RiskPool.bind(poolAddress);
  return pool.totalLiquidity();
}

export function createInsureDayData(event: ethereum.Event): InsureDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let insureDayData = InsureDayData.load(dayID.toString());
  if (insureDayData === null) {
    insureDayData = new InsureDayData(dayID.toString());
    insureDayData.date = dayStartTimestamp;
    insureDayData.dailyVolume = ZERO_BI;
  }
  insureDayData.save();

  return insureDayData;
}

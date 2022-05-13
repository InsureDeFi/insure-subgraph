import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { RiskPool } from '../generated/RiskPool/RiskPool';
import { InsureDayData, Owner, PolicyInfo, PoolInfo } from '../generated/schema';

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
export const RISK_POOL_ADDRESS = '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0';
export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');

class PoolData {
  utilizationRate: ethereum.CallResult<BigInt>;
  poolPrice: ethereum.CallResult<BigInt>;
}

export function getOrCreatePool(): PoolInfo {
  let pool = PoolInfo.load(RISK_POOL_ADDRESS);
  if (pool === null) {
    pool = new PoolInfo(RISK_POOL_ADDRESS);
    pool.totalLiquidity = ZERO_BI;
    pool.availableLiquidity = ZERO_BI;
    pool.lockedAmount = ZERO_BI;
    pool.utilizationRate = ZERO_BI;
    pool.poolPrice = ZERO_BI;
    pool.policyCount = 0;
    pool.paused = false;
  }
  return pool;
}

export function getOrCreateUser(address: Address): Owner {
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

export function getOrCreatePolicy(policyId: BigInt): PolicyInfo {
  let policy = PolicyInfo.load(policyId.toHex());
  if (policy === null) {
    policy = new PolicyInfo(policyId.toHex());
    policy.policyId = policyId;
    policy.asset = '';
    policy.owner = ADDRESS_ZERO;
    policy.payOutAmount = ZERO_BI;
    policy.premium = ZERO_BI;
    policy.endTime = ZERO_BI;
    policy.threshold = ZERO_BI.toI32();
    policy.startTime = ZERO_BI;
    policy.utilized = false;
  }
  return policy;
}

export function getUtilRateAndPoolPrice(poolAddress: Address): PoolData {
  const pool = RiskPool.bind(poolAddress);
  const utilizationRate = pool.try_utilizationRate();
  const poolPrice = pool.try_poolPrice();
  return { utilizationRate, poolPrice };
}

export function getTotalLiquidity(poolAddress: Address): ethereum.CallResult<BigInt> {
  const pool = RiskPool.bind(poolAddress);
  return pool.try_totalLiquidity();
}

export function getOrCreateInsureDayData(event: ethereum.Event): InsureDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let insureDayData = InsureDayData.load(dayID.toString());
  if (InsureDayData === null) {
    insureDayData = new InsureDayData(dayID.toString());
    insureDayData.date = dayStartTimestamp;
    insureDayData.dailyVolume = ZERO_BI;
  }
  insureDayData.save();

  return insureDayData;
}

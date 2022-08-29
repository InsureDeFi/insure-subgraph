import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { decimal, integer } from '@protofire/subgraph-toolkit';
import { RiskPool } from '../generated/RiskPool/RiskPool';
import {
  Asset,
  LiquidityPosition,
  LiquidityPositionSnapshot,
  Policy,
  Pool,
  Transaction,
  User,
} from '../generated/schema';

export const RISK_POOL_ADDRESS = '0x268fFA81C5668E8c918c7CFf2796edf8eBff7bFe';
export let BI_18 = BigInt.fromI32(18);
export let BI_6 = BigInt.fromI32(6);

export function bigIntExp18(): BigInt {
  return BigInt.fromString('1000000000000000000');
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString('1000000000000000000');
}

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1');
  for (let i = integer.ZERO; i.lt(decimals as BigInt); i = i.plus(integer.ONE)) {
    bd = bd.times(BigDecimal.fromString('10'));
  }
  return bd;
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == integer.ZERO) {
    return tokenAmount.toBigDecimal();
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function createAsset(assetSymbol: string): Asset {
  let asset = Asset.load(assetSymbol);
  if (asset == null) {
    asset = new Asset(assetSymbol);
    asset.symbol = assetSymbol;
    asset.volume = decimal.ZERO;
    asset.txCount = integer.ZERO;
  }
  return asset;
}

export function createPool(): Pool {
  let pool = Pool.load(RISK_POOL_ADDRESS);
  if (pool === null) {
    pool = new Pool(RISK_POOL_ADDRESS);
    pool.totalVolume = decimal.ZERO;
    pool.utilizationRate = decimal.ZERO;
    pool.policyCount = integer.ZERO;
    pool.txCount = integer.ZERO;
    pool.totalAssets = decimal.ZERO;
    pool.availableAssets = decimal.ZERO;
    pool.lockedAssets = decimal.ZERO;
    pool.sharesTotalSupply = decimal.ZERO;
    pool.liquidityProviderCount = integer.ZERO;
    pool.save();
  }
  return pool;
}

export function createUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (user === null) {
    user = new User(address.toHexString());
    user.policyCount = integer.ZERO;
    user.premiumPaid = decimal.ZERO;
    user.save();
  }
  return user;
}

export function createTransaction(transactionHash: string, event: ethereum.Event): Transaction {
  let transaction = Transaction.load(transactionHash);
  if (transaction === null) {
    transaction = new Transaction(transactionHash);
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.deposits = [];
    transaction.withdrawals = [];
    transaction.policies = [];
    transaction.save();
  }
  return transaction;
}

export function createLiquidityPosition(user: Address): LiquidityPosition {
  let id = user.toHexString();
  let userLiquidityPosition = LiquidityPosition.load(id);
  let pool = createPool();
  if (userLiquidityPosition === null) {
    pool.liquidityProviderCount = pool.liquidityProviderCount.plus(integer.ONE);
    userLiquidityPosition = new LiquidityPosition(id);
    userLiquidityPosition.user = user.toHexString();
    userLiquidityPosition.shares = decimal.ZERO;
    userLiquidityPosition.save();
  }
  pool.save();

  return userLiquidityPosition;
}

export function createLiquiditySnapshot(position: LiquidityPosition, event: ethereum.Event): void {
  let pool = createPool();
  let timestamp = event.block.timestamp.toI32();

  let snapshot = new LiquidityPositionSnapshot(position.id.concat(timestamp.toString()));
  snapshot.liquidityPosition = position.id;
  snapshot.timestamp = timestamp;
  snapshot.block = event.block.number.toI32();
  snapshot.user = position.user;
  snapshot.totalAssets = pool.totalAssets;
  snapshot.availableAssets = pool.availableAssets;
  snapshot.lockedAssets = pool.lockedAssets;
  snapshot.sharesTotalSupply = pool.sharesTotalSupply;
  snapshot.shares = position.shares;
  snapshot.save();

  pool.save();
}

export function createPolicy(policyId: BigInt): Policy {
  let policy = Policy.load(policyId.toHex());
  if (policy === null) {
    policy = new Policy(policyId.toHex());
    policy.utilized = false;
  }
  return policy;
}

export function getTotalAssets(): BigDecimal {
  const pool = RiskPool.bind(Address.fromString(RISK_POOL_ADDRESS));
  const totalAssets = pool.totalAssets();
  return convertTokenToDecimal(totalAssets, BI_6);
}

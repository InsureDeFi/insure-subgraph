import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { decimal, integer } from '@protofire/subgraph-toolkit';
import { Asset, AssetDayData, PoolDayData, PoolHourData } from '../generated/schema';
import { createPool } from './helpers';

export function updatePoolDayData(event: ethereum.Event): PoolDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let pool = createPool();
  let poolDayData = PoolDayData.load(dayID.toString());
  if (poolDayData === null) {
    poolDayData = new PoolDayData(dayID.toString());
    poolDayData.date = dayStartTimestamp;
    poolDayData.dailyVolume = decimal.ZERO;
    poolDayData.protocolFee = decimal.ZERO;
    poolDayData.txCount = integer.ZERO;
  }

  poolDayData.totalVolume = pool.totalVolume;
  poolDayData.sharesTotalSupply = pool.sharesTotalSupply;
  poolDayData.totalAssets = pool.totalAssets;
  poolDayData.availableAssets = pool.availableAssets;
  poolDayData.lockedAssets = pool.lockedAssets;
  poolDayData.txCount = poolDayData.txCount.plus(integer.ONE);
  poolDayData.save();

  return poolDayData;
}

export function updatePoolHourData(event: ethereum.Event): PoolHourData {
  let timestamp = event.block.timestamp.toI32();
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let pool = createPool();
  let poolHourData = PoolHourData.load(hourIndex.toString());
  if (poolHourData === null) {
    poolHourData = new PoolHourData(hourIndex.toString());
    poolHourData.hourStartUnix = hourStartUnix;
    poolHourData.hourlyVolume = decimal.ZERO;
    poolHourData.hourlyTxns = integer.ZERO;
  }

  poolHourData.sharesTotalSupply = pool.sharesTotalSupply;
  poolHourData.totalAssets = pool.totalAssets;
  poolHourData.availableAssets = pool.availableAssets;
  poolHourData.lockedAssets = pool.lockedAssets;
  poolHourData.hourlyTxns = poolHourData.hourlyTxns.plus(integer.ONE);
  poolHourData.save();

  pool.save();

  return poolHourData;
}

export function updateAssetDayData(asset: Asset, event: ethereum.Event): AssetDayData {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let tokenDayID = asset.id.toString().concat('-').concat(BigInt.fromI32(dayID).toString());

  let assetDayData = AssetDayData.load(tokenDayID);
  if (assetDayData === null) {
    assetDayData = new AssetDayData(tokenDayID);
    assetDayData.date = dayStartTimestamp;
    assetDayData.asset = asset.id;
    assetDayData.dailyVolume = decimal.ZERO;
    assetDayData.dailyTxns = integer.ZERO;
  }
  assetDayData.dailyTxns = assetDayData.dailyTxns.plus(integer.ONE);
  assetDayData.save();

  return assetDayData;
}

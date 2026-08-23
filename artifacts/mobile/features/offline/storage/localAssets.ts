import { offlineStorage } from './offlineStorage';
import type { LocalAsset } from '../types/offline.types';

export async function saveLocalAsset(asset: LocalAsset) {
  const assets = await offlineStorage.loadAssets(asset.userId);
  const next = assets.some(item => item.id === asset.id) ? assets.map(item => item.id === asset.id ? asset : item) : [...assets, asset];
  await offlineStorage.saveAssets(asset.userId, next);
  return asset;
}

export async function updateLocalAsset(userId: string, id: string, patch: Partial<LocalAsset>) {
  const assets = await offlineStorage.loadAssets(userId);
  const next = assets.map(asset => asset.id === id ? { ...asset, ...patch, updatedAt: new Date().toISOString() } : asset);
  await offlineStorage.saveAssets(userId, next);
  return next.find(asset => asset.id === id) ?? null;
}

export async function cleanupLocalAssets(userId: string, keepStatuses: LocalAsset['status'][] = ['local', 'waiting', 'uploading', 'failed']) {
  const assets = await offlineStorage.loadAssets(userId);
  const retained = assets.filter(asset => keepStatuses.includes(asset.status));
  await offlineStorage.saveAssets(userId, retained);
  return retained;
}
import { AdMob } from '@capacitor-community/admob';

const listeners = new Map();
let rewardEarned = false;

AdMob.addListener('onRewardedVideoAdReward', () => {
  rewardEarned = true;
  listeners.get('onRewardedVideoAdReward')?.();
});
AdMob.addListener('onRewardedVideoAdDismissed', () => {
  listeners.get('onRewardedVideoAdDismissed')?.();
});
AdMob.addListener('onRewardedVideoAdFailedToLoad', () => {
  listeners.get('onRewardedVideoAdFailedToLoad')?.();
});

window.BlockRushAdMob = {
  initialize: (options) => AdMob.initialize(options),
  addListener: (name, callback) => {
    listeners.set(name, callback);
    return { remove: () => listeners.delete(name) };
  },
  showBanner: (options) => AdMob.showBanner(options),
  prepareRewardVideoAd: (options) => {
    rewardEarned = false;
    return AdMob.prepareRewardVideoAd(options);
  },
  showRewardVideoAd: () => AdMob.showRewardVideoAd()
};

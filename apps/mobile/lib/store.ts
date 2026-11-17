import * as Updates from 'expo-updates';

/**
 * True in the Google Play version (built with the "production" profile).
 * Google doesn't allow Play apps in Uganda to show prices or send people to pay
 * elsewhere, so this version is "watch-only": people subscribe on glemovies.com.
 * The app downloaded from glemovies.com (preview channel) keeps everything.
 */
export const PLAY_STORE = Updates.channel === 'production';

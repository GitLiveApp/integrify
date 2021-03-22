import { integrify } from '../../src/index';
import { firestore } from 'firebase-admin';
import * as functions from 'firebase-functions';

integrify({ config: { db: firestore(), functions, verbose: true } });

export const maintainFavoritesCount = integrify({
  rule: 'MAINTAIN_COUNT',
  source: {
    collection: 'favorites',
  },
  target: {
    collection: 'articles/$source.articleId',
    attribute: 'favoritesCount',
  },
});

export const maintainFavoritesCountWithPreHook = integrify({
  rule: 'MAINTAIN_COUNT',
  source: {
    collection: 'favorites',
  },
  target: {
    collection: 'articles/$source.articleId',
    attribute: 'formattedFavoritesCount',
  },
  hooks: {
    pre: key => `updated_${key}`,
  },
});

export const maintainFavoritesCountWithDeepPreHook = integrify({
  rule: 'MAINTAIN_COUNT',
  source: {
    collection: 'favorites',
  },
  target: {
    collection: 'articles/$source.articleId/private/counts',
    attribute: 'deepFavoritesCount',
  },
  hooks: {
    pre: key => `updated_${key}`,
  },
});

export const maintainUpdateFavorite = integrify({
  rule: 'MAINTAIN_COUNT',
  source: {
    collection: 'favorites',
  },
  target: {
    collection: 'articles/$source.articleId',
    attribute: 'favoritesCount',
  },
});

export const maintainUpdateFavoriteWithNoTarget = integrify({
  rule: 'MAINTAIN_COUNT',
  source: {
    collection: 'favorites',
  },
  target: {
    collection: 'articles/$source.articleId',
    attribute: 'favoritesCount',
  },
});
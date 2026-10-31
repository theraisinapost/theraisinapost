import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observations, purchasingPower, oilWindow } from '../site/components/finance-model.mjs';

test('purchasing power uses the ratio of published index levels, including deflation and equal years', () => {
  const rows = [{period:'2000',value:100},{period:'2010',value:120},{period:'2020',value:90}];
  const increase=purchasingPower(rows,1000,'2000','2010');
  assert.equal(increase.equivalent,1200);
  assert.ok(Math.abs(increase.change-20)<1e-9);
  assert.equal(purchasingPower(rows,1000,'2010','2020').equivalent,750);
  assert.deepEqual(purchasingPower(rows,1000,'2000','2000'),{equivalent:1000,change:0});
});

test('missing years, zero index values, reversed dates and invalid amounts cannot produce estimates', () => {
  const rows = [{period:'2000',value:100},{period:'2010',value:0}];
  for (const args of [[1000,'2000','2005'],[1000,'2010','2000'],[1000,'2000','2010'],[0,'2000','2000'],[Infinity,'2000','2000'],[NaN,'2000','2000']]) {
    assert.throws(() => purchasingPower(rows,...args));
  }
});

test('observations omit nulls and numeric strings while retaining negative oil spot prices', () => {
  assert.deepEqual(observations([{period:'2020-04-20',value:-36.98},{period:'2020-04-21',value:'8'},{period:'2020-04-22',value:null}], 'daily'),[{period:'2020-04-20',value:-36.98}]);
  assert.throws(() => observations([{period:'2000',value:100},{period:'2000',value:200}]));
});

test('oil ranges end at the available observation, rather than inventing values through today', () => {
  const rows=[{period:'2018-01-01',value:60},{period:'2020-01-01',value:70},{period:'2024-01-01',value:80}];
  assert.deepEqual(oilWindow(rows,1),[rows[2]]);
  assert.deepEqual(oilWindow(rows,5),rows.slice(1));
});

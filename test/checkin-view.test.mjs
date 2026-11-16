// 签到页的纯逻辑：固定积分口径（商汤小浣熊每号 400）与账号行/汇总的一致性。
// view.js 是经典脚本，import 后挂在 globalThis.CheckinView 上。
import test from 'node:test';
import assert from 'node:assert/strict';

await import('../page/checkin/view.js');
const V = globalThis.CheckinView;

function account(id, user, on = true) {
  return {key: `${id}|${user}`, user, on, by: id};
}

function claimedState(id, users, hostCredit) {
  const accounts = users.map((user) => account(id, user));
  const today = {};
  const dailyCredits = {};
  const creditEstimate = {};
  for (const user of users) {
    const key = `${id}|${user}`;
    today[key] = {outcome: 'claimed', credit: hostCredit};
    dailyCredits[key] = hostCredit;
    creditEstimate[key] = hostCredit;
  }
  return {
    providers: [{id, name: id === 'raccoon' ? '商汤小浣熊' : '讯飞', on: true}],
    accounts,
    today,
    dailyCredits,
    creditEstimate,
  };
}

test('小浣熊每个账号按 400 计，卡片汇总与头部总额都跟着走', () => {
  const state = claimedState('raccoon', ['a', 'b', 'c', 'd'], 150);
  const groups = V.vendorGroups(state, 'zh');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].credit, 1600);
  assert.equal(groups[0].done, 4);
  assert.equal(groups[0].unknown, 0);
  for (const acc of groups[0].accounts) {
    assert.equal(acc.credit, 400);
    assert.equal(acc.status.credit, 400);
    assert.equal(acc.status.estimate, null, '固定口径下不再显示估算标记');
  }
  assert.equal(V.totals(groups).credit, 1600);
});

test('小浣熊今天没签到：不补 400，仍按「尚未签到」显示', () => {
  const state = {
    providers: [{id: 'raccoon', name: '商汤小浣熊', on: true}],
    accounts: [account('raccoon', 'a')],
    today: {},
  };
  const groups = V.vendorGroups(state, 'zh');
  assert.equal(groups[0].credit, 0);
  assert.equal(groups[0].accounts[0].credit, null);
  assert.equal(groups[0].accounts[0].status.key, 'pending');
});

test('小浣熊签发失败（ineligible）不套 400', () => {
  const state = {
    providers: [{id: 'raccoon', name: '商汤小浣熊', on: true}],
    accounts: [account('raccoon', 'a')],
    today: {'raccoon|a': {outcome: 'ineligible', credit: 150}},
    dailyCredits: {'raccoon|a': 150},
  };
  const groups = V.vendorGroups(state, 'zh');
  assert.equal(groups[0].accounts[0].status.key, 'ineligible');
  assert.equal(groups[0].accounts[0].credit, 150, '失败时保留宿主报的数字，不覆盖成 400');
});

test('其它厂商不受固定口径影响，仍用宿主报告的数', () => {
  const state = claimedState('loomy', ['a', 'b'], 400);
  const groups = V.vendorGroups(state, 'zh');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].credit, 800);
  for (const acc of groups[0].accounts) assert.equal(acc.credit, 400);
});

test('done（厂商侧已完成）同样按 400 计', () => {
  const state = {
    providers: [{id: 'raccoon', name: '商汤小浣熊', on: true}],
    accounts: [account('raccoon', 'a')],
    today: {'raccoon|a': {outcome: 'done'}},
    dailyCredits: {'raccoon|a': 120},
  };
  const groups = V.vendorGroups(state, 'zh');
  assert.equal(groups[0].accounts[0].credit, 400);
});

test('厂商或账号开关关掉时不套口径', () => {
  const state = claimedState('raccoon', ['a'], 150);
  state.providers[0].on = false;
  const groups = V.vendorGroups(state, 'zh');
  assert.equal(groups[0].accounts[0].credit, null);
  assert.equal(groups[0].credit, 0);

  const off = claimedState('raccoon', ['a'], 150);
  off.accounts[0].on = false;
  const groups2 = V.vendorGroups(off, 'zh');
  assert.equal(groups2[0].accounts[0].credit, null);
});

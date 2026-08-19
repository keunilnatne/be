const test = require('node:test');
const assert = require('node:assert/strict');

const { DataTypes } = require('sequelize');
const { User } = require('../src/models');
const { requireAdmin } = require('../src/middlewares/authorize');

test('users.admin is a non-null boolean that defaults to false', () => {
  const admin = User.rawAttributes.admin;

  assert.equal(admin.type instanceof DataTypes.BOOLEAN, true);
  assert.equal(admin.allowNull, false);
  assert.equal(admin.defaultValue, false);
});

test('requireAdmin only allows users whose admin flag is true', () => {
  let called = false;
  requireAdmin({ user: { admin: true } }, {}, () => {
    called = true;
  });
  assert.equal(called, true);

  assert.throws(
    () => requireAdmin({ user: { admin: false } }, {}, () => {}),
    (error) => error.statusCode === 403
  );
});

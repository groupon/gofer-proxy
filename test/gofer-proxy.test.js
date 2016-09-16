'use strict';
var assert = require('assertive');

var goferProxy = require('../');

describe('gofer-proxy', function () {
  it('is empty', function () {
    assert.deepEqual({}, goferProxy);
  });
});

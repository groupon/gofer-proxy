'use strict';
var assert = require('assertive');

var goferProxy = require('../');

describe('gofer-proxy', function () {
  it('is a function', function () {
    assert.hasType(Function, goferProxy);
  });
});

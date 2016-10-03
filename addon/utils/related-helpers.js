/**
  @module ember-jsonapi-resources
  @submodule utils
  @main related-helpers
**/

import Ember from 'ember';
import { isDasherized } from 'ember-jsonapi-resources/utils/is';

export function extractMeta(relation) {
  let type = relation;
  let inverse;
  if (typeof relation === 'object') {
    assertResourceAndTypeProps(relation);
    type = relation.type;
    inverse = relation.inverse;
    relation = relation.resource;
  }

  assertDasherizedRelation(relation);

  return {
    type: type,
    relation: relation,
    inverse: inverse
  };
}

export function assertResourceAndTypeProps(relation) {
  try {
    let msg = 'Options must include properties: resource, type';
    Ember.assert(msg, relation && relation.resource && relation.type);
  } catch(e) {
    Ember.Logger.warn(e.message);
  }
}

export function assertDasherizedRelation(name) {
  try {
    let relationName = Ember.String.dasherize(name);
    let msg = " are recommended to use dasherized names, e.g `hasMany('"+ relationName +"')`";
    msg += ", instead of `hasMany('"+ name +"')`";
    Ember.assert(msg, isDasherized(name));
  } catch(e) {
    Ember.Logger.warn(e.message);
  }
}

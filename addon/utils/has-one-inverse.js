/**
  @module ember-jsonapi-resources
  @submodule utils
  @main hasOne
**/

import Ember from 'ember';
import RelatedProxyUtil from 'ember-jsonapi-resources/utils/related-proxy';
import { linksPath } from 'ember-jsonapi-resources/utils/related-proxy';
import { extractMeta } from 'ember-jsonapi-resources/utils/related-helpers';

/**
  Helper to setup a has one relationship to another resource with support
  for automatically adding inverse relationship.


  ```js
  let Person = Resource.extend({
    type: 'people',
    name: attr(),
    supervisor: hasOne({
      resource: 'supervisor',
      type: 'people',
      inverse: 'directReports'
      })
  });

  let Supervisor = Person.extend({
    type: 'supervisors',
    directReports: hasMany({
      resource: 'employees',
      type: 'people',
      inverse: 'supervisor'
    })
  });
  ```

  @method hasOne
  @for Resource
  @final
  @param {String|Object} relation the name of the relationship
  @param {String} relation.resource the name of the relationship
  @param {String} relation.type the name of the type or service to use
  @param {String} relation.inverse the property name of the inverse relationship
  @return {Object} computed property
*/
export default function hasOne(relation) {
  const meta = extractMeta(relation);
  let util = RelatedProxyUtil.create({
    relationship: meta.relation,
    type: meta.type,
    kind: meta.kind
  });
  return Ember.computed(linksPath(meta.relation), function () {
    return util.createProxy(this, meta.kind);
  }).meta(meta);
}

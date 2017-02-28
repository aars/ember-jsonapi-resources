/**
  @module ember-jsonapi-resources
  @submodule utils
  @main toOne
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
    supervisor: toOne({
      resource: 'supervisor',
      type: 'people',
      inverse: 'directReports'
      })
  });

  let Supervisor = Person.extend({
    type: 'supervisors',
    directReports: toMany({
      resource: 'employees',
      type: 'people',
      inverse: 'supervisor'
    })
  });
  ```

  @method toOne
  @for Resource
  @final
  @param {String|Object} relation the name of the relationship
  @param {String} relation.resource the name of the relationship
  @param {String} relation.type the name of the type or service to use
  @param {String} relation.inverse the property name of the inverse relationship
  @return {Object} computed property
*/
export default function toOne(relation) {
  const meta = extractMeta(relation);
  meta.kind = 'toOne';

  let util = RelatedProxyUtil.create({
    relationship: meta.relation,
    type: meta.type,
    kind: meta.kind
  });
  return Ember.computed(linksPath(meta.relation), {
    get() {
      return util.createProxy(this, meta.kind);
    },
    set(k, v) {
      this.addRelationship(k, v);
    }
  }).meta(meta);
}

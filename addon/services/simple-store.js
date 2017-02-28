import Ember from 'ember';
import { pluralize } from 'ember-inflector';

/*
 * create:    Create and cache (but don't persist) new Resource.
 * find:      Query server for Resource(s) with options.
 * peek(All): Find (all) Resource(s) of `type` in cache.
 */
export default Ember.Service.extend({
  find(type, options) {
    return this._service(type).find(options);
  },
  peek(type, id) {
    return this._service(type).cacheLookup(id);
  },
  peekAll(type) {
    return this._service(type).cachePeekAll();
  },

  // I wish we could inspect the Resource before initialization so we can
  // pluck the relationships from the `attributes` arg, allowing for a simpler
  // create method. Since we can't (I think), accept relationships as third
  // arg.
  create(type, attributes, relationships) {
    let resource = this._modelFactory(type).create({attributes: attributes});

    for (let relation in relationships || {}) {
      let ids = relationships[relation];
      let addMethod = Ember.isArray(ids) ? 'addRelationships' : 'addRelationship';
      resource[addMethod](relation, ids);
    }

    return resource;
  },

  _modelFactory(type) {
    const _factory = Ember.getOwner(this).lookup(`model:${type}`);
    if (!_factory) {
      throw new Error(`${type} model factory not found`);
    }
    return _factory;
  },
  _service(type) {
    const _type = pluralize(type);
    if (!this[_type]) {
      throw new Error(`${_type} service not initialized`);
    }

    return this[_type];
  }
});
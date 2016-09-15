import Ember from 'ember';
import { pluralize } from 'ember-inflector';
import { isType } from 'ember-jsonapi-resources/utils/is';

export default Ember.Mixin.create({
  store: Ember.inject.service(),

  addRelationship(related, resourceOrId) {
    let resource, identifier;
    let id = resourceOrId;

    // collect data on this relationship.
    let meta = this.constructor.metaForProperty(related);
    let key  = ['relationships', meta.relation, 'data'].join('.');
    let data = this.get(key);
    let type = pluralize(meta.type);

    // Are we adding a resource or by id?
    if (Ember.typeOf(resourceOrId) === 'instance') {
      resource = resourceOrId;
      id = resource.get('id');
    } else {
      // Ensure ids are strings.
      if (Ember.typeOf(id) === 'number') { id = id.toString(); }
      resource = Ember.getOwner(this).lookup(`service:${type}`).cacheLookup(id);
    }

    // Only if we have an id can we store the it as data. Otherwise we're
    // only storing the resource.
    identifier = {type: type, id: id};

    // Add relationship to our self.
    if (Array.isArray(data)) {
      data.push(identifier);
      if (resource) {
        this.get(related).then(resources => {
          if (!resources.contains(resource)) {
            resources.pushObject(resource);
          }
        });
      }
    } else {
      data = identifier;
      if (resource) {
        this.set(`${meta.relation}.content`, resource);
      }
    }

    // Add inverse relationship if defined (and resource available, cached)
    if (meta.inverse && resource) {
      resource.addRelationship(meta.inverse, this);
    }

    return this.set(key, data);
   },

  _updateRelationshipsData(relation, ids) {
    let relationshipData = 'relationships.' + relation + '.data';
    let existing;
    if (!Array.isArray(ids)) {
      existing = this.get(relationshipData).id;
      this.removeRelationship(relation, existing);
      if (isType('string', ids)) {
        this.addRelationship(relation, ids);
      }
    } else {
      // Skip modification on non-persisted (null id) relationships.
      existing = this.get(relationshipData).mapBy('id').without(null);
      if (!existing.length) {
        this.addRelationships(relation, ids);
      } else if (ids.length > existing.length) {
        this.addRelationships(relation, unique(ids, existing));
      } else if (existing.length > ids.length) {
        this.removeRelationships(relation, unique(existing, ids));
      }
    }
  },
});

function unique(superSet, subSet) {
  let intersection = superSet.filter(function (item) {
    return subSet.indexOf(item) !== -1;
  });
  let _unique = superSet.filter(function (item) {
    return intersection.indexOf(item) === -1;
  });
  return (unique.length) ? _unique : subSet;
}


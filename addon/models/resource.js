/**
  @module ember-jsonapi-resources
  @submodule resource
**/

import Ember from 'ember';
import { pluralize, singularize } from 'ember-inflector';
import attr from 'ember-jsonapi-resources/utils/attr';
import { toOne, hasOne } from 'ember-jsonapi-resources/utils/to-one';
import { toMany, hasMany } from 'ember-jsonapi-resources/utils/to-many';
import ResourceOperationsMixin from '../mixins/resource-operations';

const { getOwner, computed, Logger } = Ember;

/**
  A Resource class to create JSON API resource objects. This is abstract, first
  define a prototype using `Resource.extend({ type: entity })`. Model prototypes
  are registered in the container as factories, they use the options:
  `{ instantiate: false, singleton: false }`. So, to create a model instance
  use the owner API method `_lookupFactory('model:name')`† then `create()`:

  ```js
  let model = Ember.getOwner(this)._lookupFactory('model:entity').create({ attributes: { key: value } });
  ```

  † **Note:** eventually `factoryFor` will replace `_lookupFactory`

  See <http://jsonapi.org/format/#document-resource-objects>

  @class Resource
  @requires Ember.Inflector
  @static
*/
const Resource = Ember.Object.extend(ResourceOperationsMixin, {
  service: null,

  /**
    Extending Prototypes Must define a `type` value for the entity, e.g. `posts`

    @property type
    @type String
    @required
  */
  type: null,

  /**
    Persisted resource ID value

    @property id
    @type String
    @required
  */
  id: null,

  /**
    An optional `attributes` property of for a JSON API Resource object, setup in create()

    This object will keep the values from the response object and may be mutable
    Use this as a refence for creating computed properties

    For example the `attr()` helper sets up a properties based on this content

    @protected
    @property attributes
    @type Object
  */
  attributes: null,

  /**
    An optional `relationships` property of for a JSON API Resource object, setup in create()

    @protected
    @property relationships
    @type Object
  */
  relationships: null,

  /**
    An optional `links` property of for a JSON API Resource object, setup in create()

    @protected
    @property links
    @type Object
  */
  links: null,

  /**
    An optional property of for a JSON API Resource object, setup in create()

    @protected
    @property meta
    @type Object
  */
  meta: null,

  /**
    Hash of attributes for changed/previous values

    @private
    @property _attributes
    @type Object
  */
  _attributes: null,

  /**
    Array of changed attribute keys.

    The Actual changed values (previous, changed) are stored on _attributes,
    but we can not use that object or it's keys to create computed properties
    that respond to changes (i.e. no live isDirty property).
    This array is a simple list of attributes that are not in their original
    state, and can be used to track the (dirty-)state of the resource.

    @protected
    @property _changedAttributes
    @type Array
  */
  _changedAttributes: null,

  /**
    Hash of relationships that were changed

    @private
    @property _relationships
    @type Object
  */
  _relationships: null,

  /**
   Array of changed relationship keys. Same use as _changedAttributes.

   @protected
   @property _changedRelationships
   @type Array
  */
  _changedRelationships: null,

  /**
    Flag for new instance, e.g. not persisted

    @property isNew
    @type Boolean
  */
  isNew: false,

  /**
    Custom `toString` method used for clarity that the instance is a JSON API Resource kind of object

    @method toString
  */
  toString() {
    let type = singularize(this.get('type')) || 'null';
    let id = this.get('id') || 'null';
    return `[JSONAPIResource|${type}:${id}]`;
  },

  /**
    @private
    @method _updateRelationshipsData
    @param {String} relation
    @param {Array|String|null} ids
  */
  _updateRelationshipsData(relation, ids) {
    if (!Array.isArray(ids)) {
      this._updateToOneRelationshipData(relation, ids);
    } else {
      let existing = this._existingRelationshipData(relation);
      if (!existing.length) {
        this._addRelationships(relation, ids);
      } else if (ids.length > existing.length) {
        this._addRelationships(relation, unique(ids, existing));
      } else if (existing.length > ids.length) {
        this.removeRelationships(relation, unique(existing, ids));
      }
    }
  },

  /**
    @private
    @method _updateToOneRelationshipData
    @param {String} relation
    @param {String|null} id
  */
  _updateToOneRelationshipData(relation, id) {
    if (id !== undefined) { id = id.toString(); } // ensure String id.

    let relationshipData = 'relationships.' + relation + '.data';
    let existing = this.get(relationshipData);
    existing = (existing) ? existing.id : null;

    // Nothing to remove or add, stop.
    if ((!existing && id === null) || existing === id) { return; }

    // Remove old relationship.
    if (existing) {
      this.removeRelationship(relation, existing);
    }
    // Add new relationship?
    if (id !== null) {
      this._addRelationship(relation, id);
    }
  },

  /**
    @private
    @method _replaceRelationshipsData
    @param {String} relation
    @param {Array|String|null} ids
  */
  _replaceRelationshipsData(relation, ids) {
    if (!Array.isArray(ids)) {
      this._updateToOneRelationshipData(relation, ids);
    } else {
      let existing = this._existingRelationshipData(relation);
      if (!existing.length) {
        this._addRelationships(relation, ids);
      } else {
        this.removeRelationships(relation, existing);
        this._addRelationships(relation, ids);
      }
    }
  },

  /**
    @private
    @method _existingRelationshipData
    @param {String} relation
  */
  _existingRelationshipData(relation) {
    let relationshipData = 'relationships.' + relation + '.data';
    return this.get(relationshipData).map(function(rel) { return rel.id; });
  },

  /**
    @method addRelationships
    @param {String} related - resource name
    @param {Array} ids
  */
  addRelationships(related, ids) {
    for (let i = 0; i < ids.length; i++) {
      this.addRelationship(related, ids[i]);
    }
  },

  _addRelationships(related, ids) {
    for (let i = 0; i < ids.length; i++) {
      this._addRelationship(related, ids[i]);
    }
  },

  /**
    @method removeRelationships
    @param {String} related - resource name
    @param {Array} ids
  */
  removeRelationships(related, ids) {
    for (let i = 0; i < ids.length; i++) {
      this.removeRelationship(related, ids[i]);
    }
  },

  /**
   Public method for adding relationships, with dirty/change tracking.

   @method addRelationship
   @param {String} related - resource name
   @param {String} id
   */
  addRelationship(related, id) {
    if (id !== undefined) { id = id.toString(); } // ensure String id.

    let meta = this.relationMetadata(related);
    let type = pluralize(meta.type);
    let identifier = { type: type, id: id };
    let previous;

    // toOne could have a previous relation.
    if (meta.kind === 'toOne') {
      previous = this.get(`relationships.${meta.relation}.data.id`);
    }

    this._relationAdded(
      related,
      identifier,
      (previous) ? { type: type, id: previous } : null
    );

    this._addRelationship(related, id);
  },

  /**
    Adds related resource identifier object to the relationship data.

    Also sets or adds to the `content` of the related proxy object.

    - For to-many relations the related identifier object is added to
      the resource linkage data array.
    - For to-one relations the resource identifier object is assigned,
      so the relation may be replaced.

    See:
    - http://jsonapi.org/format/#document-resource-object-linkage
    - http://jsonapi.org/format/#document-resource-identifier-objects

    @method _addRelationship
    @param {String} related - resource name
    @param {String} id
  */

  _addRelationship(related, id) {
    if (id !== undefined) { id = id.toString(); } // ensure String id.

    // actual resource type of this relationship is found in related-proxy's meta.
    let meta = this.relationMetadata(related);
    let key = ['relationships', meta.relation, 'data'].join('.');
    let data = this.get(key);
    let type = pluralize(meta.type);
    let identifier = { type: type, id: id };
    let resource = getOwner(this).lookup(`service:${type}`).cacheLookup(id);

    if (Array.isArray(data)) {
      data.push(identifier);
      if (resource) {
        let resources = this.get(related);
        if (!resources.includes(resource)) {
          resources.pushObject(resource);
        }
      }
    } else {
      data = identifier;
      if (resource) {
        this.set(`${meta.relation}.content`, resource);
      }
    }
    return this.set(key, data);
  },

  /**
    Track additions of relationships using a resource identifier objects:

    ```js
    { relation {String}, type {String}, kind {String} }`
    ```

    @private
    @method _relationAdded
    @param {String} relation name of a related resource
    @param {Object} identifier, a resource identifier object `{type: String, id: String}`
    @param {Object|Array} previous, resource identifier object or array of identifiers
  */
  _relationAdded(relation, identifier, previous) {
    let meta = this.relationMetadata(relation);
    let ref  = this._relationships[relation];

    // FIXME: Why setup tracking here each time? I've moved the call
    // to this._resetRelationships.
    // setupRelationshipTracking.call(this, relation, meta.kind);

    // FIXME: why look up data when we get passed `previous`?
    // let relationshipData = this.get(`relationships.${relation}.data`);
    if (meta && meta.kind === 'toOne') {
      ref.changed = identifier;
      ref.previous = ref.previous || previous;
    } else if (meta && meta.kind === 'toMany') {
      let id = identifier.id;
      ref.removals = Ember.A(ref.removals.rejectBy('id', id));
      if (!ref.added.findBy('id', id)) {
        ref.added.push({type: pluralize(relation), id: id});
      }
    }

    // Track relationship changes
    if (!this.get('isNew')) {
      if (!this.get('_changedRelationships')) {
        this.set('_changedRelationships', Ember.A([]));
      }

      if (!Ember.isEmpty(ref.added) ||
          !Ember.isEmpty(ref.removals) ||
          !Ember.isEmpty(ref.changed)) {
        this.get('_changedRelationships').pushObject(relation);
      }
    }
  },

  /**
    Removes resource identifier object of the relationship data. Also, sets the
    `content` of the related (computed property's) proxy object to `null`.

    - For to-one relations the (resource linkage) data is set to `null`.
    - For to-many relations the resource identifier object is removed from
      the resource Linkage `data` array.

    See:
    - http://jsonapi.org/format/#document-resource-object-linkage
    - http://jsonapi.org/format/#document-resource-identifier-objects

    @method removeRelationship
    @param {String} related - resource name
    @param {String} id
  */
  removeRelationship(related, id) {
    // Debug: I want to know when relationship removals are tracked.
    Ember.Logger.debug('_relationRemoved', this.toString(), related, id);
    console.trace();

    if (id !== undefined) { id = id.toString(); } // ensure String ids.
    let relation = this.get('relationships.' + related);
    if (Array.isArray(relation.data)) {
      for (let i = 0; i < relation.data.length; i++) {
        if (relation.data[i].id === id) {
          relation.data.splice(i, 1);
          this._relationRemoved(related, id);
          break;
        }
      }
      let resources = this.get(related);
      let idx = resources.mapBy('id').indexOf(id);
      if (idx > -1) {
        resources.removeAt(idx);
      }
    } else if (typeof relation === 'object') {
      if (relation.data.type === pluralize(related) && relation.data.id === id) {
        this._relationRemoved(related, id);
      }
      relation.data = null;
      this.set(`${related}.content`, null);
    }
  },

  /**
    Track removals of relationships

    @private
    @method _relationRemoved
    @param {String} relation - resource name
    @param {String} id
  */
  _relationRemoved(relation, id) {
    // Debug: I want to know when relationship removals are tracked.
    Ember.Logger.debug('_relationRemoved', this.toString(), relation, id);

    let ref = this._relationships[relation] = this._relationships[relation] || {};
    let meta = this.relationMetadata(relation);
    // FIXME: This is probably unnecesarry, tracking is setup on _reset.
    // setupRelationshipTracking.call(this, relation, meta.kind);

    if (meta.kind === 'toOne') {
      ref.changed = null;
      ref.previous = ref.previous || this.get('relationships.' + relation).data;
    } else if (meta.kind === 'toMany') {
      ref.added = Ember.A(ref.added.rejectBy('id', id));
      if (!ref.removals.findBy('id', id)) {
        ref.removals.pushObject({ type: pluralize(relation), id: id });
      }
    }

    // Track relationship changes.
    if (!this.get('isNew')) {
      if (!this.get('_changedRelationships')) {
        this.set('_changedRelationships', Ember.A([]));
      }
      if (!Ember.isEmpty(ref.added) ||
          !Ember.isEmpty(ref.removals) ||
          !Ember.isEmpty(ref.previous)) {
        this.get('_changedRelationships').pushObject(relation);
      }
    }
  },

  /**
    @method changedAttributes
    @return {Object} the changed attributes
  */
  changedAttributes: computed('attributes', {
    get: function () {
      const attrs = {};
      for (let key in this._attributes) {
        if (this._attributes.hasOwnProperty(key)) {
          if (this._attributes[key].changed !== this._attributes[key].previous) {
            attrs[key] = this._attributes[key].changed;
          }
        }
      }
      return attrs;
    }
  }).volatile(),

  /**
    @method previousAttributes
    @return {Object} the previous attributes
  */
  previousAttributes: computed('attributes', {
    get: function () {
      const attrs = {};
      for (let key in this._attributes) {
        if (this._attributes.hasOwnProperty(key)) {
          if (this._attributes[key].changed !== this._attributes[key].previous) {
            attrs[key] = this._attributes[key].previous;
          }
        }
      }
      return attrs;
    }
  }).volatile(),

  /**
    @method previousAttributes
    @return {Object} the previous attributes
  */
  changedRelationships: computed('_relationships', {
    get() {
      let relationships = Object.keys(this._relationships).filter((relation) => {
        let ref = this._relationships[relation];
        // `changed` can be null when a relation is removed. Check for previous as well.
        return (ref.previous || ref.changed) ||
               (!Ember.isEmpty(ref.removals) || !Ember.isEmpty(ref.added));
      });
      return Ember.A(relationships);
    }
  }).volatile(),

  /**
    Rollback changes to attributes and relationships

    @method rollback
  */
  rollback() {
    this.rollbackAttributes();
    this.rollbackRelationships();
  },

  /**
    Revert to previous attributes

    @method rollbackAttributes
  */
  rollbackAttributes() {
    let attrs = this.get('previousAttributes');
    for (let prop in attrs) {
      if (attrs.hasOwnProperty(prop)) {
        this.set(`attributes.${prop}`, attrs[prop]);
        this.notifyPropertyChange(prop);
      }
    }
    this._resetAttributes();
  },

  /**
    Reset tracked changed/previous attrs

    @private
    @method _resetAttributes
  */
  _resetAttributes() {
    for (let attr in this._attributes) {
      if (this._attributes.hasOwnProperty(attr)) {
        delete this._attributes[attr];
      }
    }
    this.set('_changedAttributes', Ember.A([]));
  },

  /**
    Revert to previous relationships

    @method rollbackRelationships
  */
  rollbackRelationships() {
    let relations = this.get('changedRelationships');
    if (relations && relations.length > 0) {
      relations.forEach((relation) => {
        let ref = this._relationships[relation];
        let meta = this.relationMetadata(relation);
        if (meta && meta.kind === 'toOne') {
          if (ref.changed && ref.changed.id && ref.previous && ref.previous.id) {
            this._addRelationship(relation, ref.previous.id);
          }
        } else if (meta && meta.kind === 'toMany') {
          let added = ref.added.mapBy('id');
          let removed = ref.removals.mapBy('id');
          added.forEach( (id) => {
            this.removeRelationship(relation, id);
          });
          removed.forEach( (id) => {
            this._addRelationship(relation, id);
          });
        }
      });
    }
    this._resetRelationships();
  },

  /**
    Reset tracked relationship changes

    @private
    @method _resetRelationships
  */
  _resetRelationships() {
    for (let relation in this._relationships) {
      if (this._relationships.hasOwnProperty(relation)) {
        let meta = this.relationMetadata(relation);
        setupRelationshipTracking.call(this, relation, meta.kind);
      }
    }

    this.set('_changedRelationships', Ember.A([]));
  },

  /**
    @method relationMetadata
    @param {String} property name of a related resource
    @return {Object|undefined} `{ relation {String}, type {String}, kind {String} }`
  */
  relationMetadata(property) {
    let meta;
    try {
      meta = this.constructor.metaForProperty(property);
    } catch (e) {
      // Could be a Ember Proxy object. Try that, otherwise throw original error.
      // This could contain a very useful message ("could not find computed property
      // with key `property`" on undefined relationships for example)
      const content = this.get('content');
      if (content && content.constructor.metaForProperty) {
        meta = content.constructor.metaForProperty(property);
      } else {
        throw e;
      }
    }
    return meta;
  },

  /**
    Callback after Resource is updated client-side, or from server payload.

    @method didUpdateResource
    @param {Object} json the updated data for the resource
  */
  didUpdateResource(json) {
    // Debug: I want to know when this callback is triggered.
    Ember.Logger.debug('_relationRemoved', this.toString(), json);

    // Received payload does not have to represent the full resource as we know it
    // client-side. Specifically, relationship data can be safely omitted in payload,
    // but that does not invalidate the relationship data we have stored client-side.
    //
    if (json) {
      // If we receive a payload we can expect all attributes are present.
      // Replace attributes in full.
      if (json.attributes) {
        this.set('attributes', json.attributes);
      }
      // Only _update_ specific relationship, don't replace `relationships` in full.
      if (json.relationships) {
        for (let relation in json.relationships) {
          let key = `relationships.${relation}`;
          if (!this.get(key)) {
            this.set(key, json.relationships[relation]);
          } else {
            let links = json.relationships[relation].links;
            let data  = json.relationships[relation].data;

            if (links) { this.set(`${key}.links`, links); }
            if (data)  { this.set(`${key}.data`, data); }
          }
        }
      }
    }

    // reset tracking.
    this._resetAttributes();
    this._resetRelationships();
  },

  /**
    Sets the relationships data, used after the promise proxy resolves by
    toOne and toMany helpers

    @method didResolveProxyRelation
    @param {String} relation name
    @param {String} kind of relation toOne or toMany
    @param {Array|Object} related resource(s)
  */
  didResolveProxyRelation(relation, kind, related) {
    let ids;
    if (Array.isArray(related)) {
      ids = related.mapBy('id');
    } else if (related) {
      ids = related.get('id');
    } else {
      return;
    }
    let relationshipData = 'relationships.' + relation + '.data';
    let data = this.get(relationshipData);
    if (!data) {
      if (kind === 'toOne') {
        this.set(relationshipData, {});
      } else if (kind === 'toMany') {
        this.set(relationshipData, Ember.A([]));
      }
    }
    this._updateRelationshipsData(relation, ids);
  },

  /**
    A local cache duration, to minimize duplicate fetch requests

    @property cacheDuration
    @type Number
  */
  cacheDuration: /* minutes */ 7 * /* seconds */ 60 * /* milliseconds */ 1000,

  /**
    @property isCacheExpired
    @type Boolean
  */
  isCacheExpired: computed('meta.timeStamps.local', 'cacheDuration', function () {
    const localTime = this.get('meta.timeStamps.local');
    const expiresTime = localTime + this.get('cacheDuration');
    return (localTime) ? Date.now() >= expiresTime : false;
  })
});

Resource.reopenClass({
  /**
    To protect the JSON API Resource properties for attributes, links and
    relationships these objects are setup during create(). This has to be
    defined since the attr() helper needs to have new objects for each instance,
    to project from keeping a reference on the prototype.

    The create method should only be called after looking up a factory from the
    container, for example in a route's model hook:

    ```
    model() {
      let owner = Ember.getOwner(this);
      return owner._lookupFactory('model:post').create({
        attributes: {
          title: 'The JSON API 1.0 Spec Rocks!'
        }
      });
    }
    ```

    The create method uses the container to lookup the factory's prototype and
    find the computed properties used for relations to setup the relationships
    for the Resource instance you create. Calling Resource#create without using
    the factory lookup will result in an instance without a reference to the
    application's container and you will have to manually setup the relationships
    object prior to adding a relationship.

    @method create
    @static
    @return {Resource} instance with protected objects:
      `attributes`, `links` and `relationships`
  */
  create(properties) {
    properties = properties || {};
    const prototype = {};
    const attrs = Ember.String.w('_attributes attributes links meta relationships _relationships');
    for (let i = 0; i < attrs.length; i++) {
      prototype[attrs[i]] = {};
    }

    // JSONAPI ids MUST be strings.
    // Without an id we default isNew to true (unless otherwise specified)
    if (properties.hasOwnProperty('id')) {
      properties.id = properties.id.toString();
    } else if (typeof properties.isNew === 'undefined') {
      properties.isNew = true;
    }

    const instance = this._super(prototype);
    instance.setProperties(properties);

    let type = singularize(instance.get('type'));
    let msg = (type) ? Ember.String.capitalize(type) : 'Resource';
    let factory = 'model:' + type;
    if (!type) {
      Logger.warn(msg + '#create called, instead you should first use ' + msg + '.extend({type:"entity"})');
    } else {
      let owner = getOwner(instance);
      if (owner) {
        useComputedPropsMetaToSetupRelationships(owner, factory, instance);
      } else {
        msg += '#create should only be called from a container lookup (relationships not setup), instead use: \n';
        msg += "`let owner = Ember.getOwner(this); \n";
        msg += 'owner._lookupFactory("' + factory + '").create()`';
        Logger.warn(msg);
      }
    }
    return instance;
  }
});

export default Resource;

export { attr, toOne, toMany, hasOne, hasMany };

let _rp = 'service type id attributes relationships links meta _attributes isNew cacheDuration isCacheExpired';
const ignoredMetaProps = _rp.split(' ');

function useComputedPropsMetaToSetupRelationships(owner, factory, instance) {
  factory = owner.lookup(factory);
  factory.eachComputedProperty(function(prop) {
    if (ignoredMetaProps.indexOf(prop) > -1) { return; }
    try {
      let meta = factory.metaForProperty(prop);
      if (meta && meta.kind) {
        setupRelationship.call(instance, meta.relation, meta.kind);
        setupRelationshipTracking.call(instance, meta.relation, meta.kind);
      }
    } catch (e) {
      return; // metaForProperty has an assertion that may throw
    }
  });
}

function setupRelationship(relation, kind) {
  let ref = this.relationships[relation];
  if (!ref) {
    ref = this.relationships[relation] = { links: {}, data: null };
  }
  if (!ref.links) {
    ref.links = {};
  }
  if (!ref.data) {
    if (kind === 'toOne') {
      ref.data = null;
    } else if (kind === 'toMany') {
      ref.data = Ember.A([]);
    }
  }
}

function setupRelationshipTracking(relation, kind) {
  this._relationships[relation] = this._relationships[relation] || {};
  let ref = this._relationships[relation];
  if (kind === 'toOne') {
    ref.changed = ref.changed || null;
    ref.previous = ref.previous || null;
  } else if (kind === 'toMany') {
    ref.added = ref.added || Ember.A([]);
    ref.removals = ref.removals || Ember.A([]);
  }
}

function unique(superSet, subSet) {
  let intersection = superSet.filter(function (item) {
    return subSet.indexOf(item) !== -1;
  });
  let _unique = superSet.filter(function (item) {
    return intersection.indexOf(item) === -1;
  });
  return (unique.length) ? _unique : subSet;
}

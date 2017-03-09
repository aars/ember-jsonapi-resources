/**
  @module ember-jsonapi-resources
  @submodule utils
  @main attr
**/

import Ember from 'ember';
import { isBlank, isDasherized, isType } from 'ember-jsonapi-resources/utils/is';

/**
  Utility helper to setup a computed property for a resource attribute, imported and
  exported with the resource submodule.

  An `attr` of the resource is a computed property to the actual attribute in an
  `attributes` hash on the `resource` (model) instance. Using `attr()` supports
  any type, and an optional `type` (String) argument can be used to enforce
  setting and getting with a specific type. `'string'`, `'number'`, `'boolean'`,
  `'date'`, `'object'`, and `'array'` are all valid types for attributes.

  Use `attr()`, with optional type argument, to compose your model attributes, e.g:

  ```js
  import Ember from 'ember';
  import Resource from 'ember-jsonapi-resources/models/resource';
  import { attr, toOne, toMany } from 'ember-jsonapi-resources/models/resource';

  export default Resource.extend({
    type: 'articles',
    service: Ember.inject.service('articles'),

    title: attr('string'),
    published: attr('date'),
    tags: attr('array'),
    footnotes: attr('object'),
    revisions: attr()
    version: attr('number'),
    "is-approved": attr('boolean')
  });
  ```

  @method attr
  @for Resource
  @final
  @param {String} [type] an optional param for the type of property, i.e. `string`,
    `number`, `boolean`, `date`, `object`, or `array`
  @param {Boolean} [mutable=true] optional param, defaults to `true` if not passed
  @return {Object} computed property
*/
export default function attr(type = 'any', mutable = true) {
  const _mutable = mutable;
  if (type !== 'any' && !isBlank(type)) {
    assertValidTypeOption(type);
  }
  return Ember.computed('attributes', {
    get: function (key) {
      assertDasherizedAttr(key);
      let value = this.get('attributes.' + key);
      if (!isBlank(value)) {
        assertType.call(this, key, value);
      }
      return value;
    },

    set: function (key, value) {
      const lastValue = this.get('attributes.' + key);
      // Don't allow set on immutable values.
      if (!_mutable) {
        return immutableValue(key, value, lastValue);
      }
      // Don't do anything if same value is set.
      if (value === lastValue) { return value; }

      // Check value type.
      assertType.call(this, key, value);

      // Set value.
      this.set('attributes.' + key, value);

      // Track changes.
      // Only on non-isNew resources, which are 'dirty' be default
      if (!this.get('isNew')) {
        // Initialize tracking object and array for this attribute.
        this._attributes[key] = this._attributes[key] || {};
        if (!this.get('_changedAttributes')) {
          this.set('_changedAttributes', Ember.A([]));
        }

        // Track change(d key) and store previous/changed value.
        // We (Ember.)Copy values to `previous` and `changed` to prevent both
        // being a reference to the same object (and thus never showing up on
        // computed property 'changedAttributes')
        if (this._attributes[key].previous === undefined) {
          // Value changed for the first time.
          this._attributes[key].previous = Ember.copy(lastValue, true);
          this.get('_changedAttributes').pushObject(key);
        } else {
          // Value changed again.
          if (this._attributes[key].previous === value) {
            // Value reverted to previous. No longer dirty. Remove from tracking.
            this.get('_changedAttributes').removeObject(key);
          } else if (this.get('_changedAttributes').indexOf(key) === -1){
            // Value changed again, wasn't tracked anymore. Track it.
            this.get('_changedAttributes').pushObject(key);
          }
        }

        this._attributes[key].changed = Ember.copy(value, true);

        let service = this.get('service');
        if (service) {
          service.trigger('attributeChanged', this);
        }
      }
      return this.get('attributes.' + key);
    }
  }).meta({type: type, mutable: mutable});
}

function assertValidTypeOption(type) {
  if (type === 'any') { return; }
  let allowed = 'string number boolean date object array';
  let msg = 'Allowed types are: ' + allowed + ' however ' + type + ' was given instead.';
  Ember.assert(msg, allowed.split(' ').indexOf(type) > -1);
}

function assertDasherizedAttr(name) {
  try {
    let attrName = Ember.String.dasherize(name);
    let msg = "Attributes are recommended to use dasherized names, e.g `'"+ attrName +"': attr()`";
    msg += ", instead of `"+ name +": attr()`";
    Ember.assert(msg, isDasherized(name));
  } catch(e) {
    Ember.Logger.warn(e.message);
  }
}

function assertType(key, value) {
  let meta = this.constructor.metaForProperty(key);
  if (meta && meta.type && meta.type !== 'any') {
    let msg = this.toString() + '#' + key + ' is expected to be a ' + meta.type;
    Ember.assert(msg, isType(meta.type, value));
  }
}

function immutableValue(key, value, lastValue) {
  let msg = [
    this.toString(), '#', key, ' is not mutable set was called with ',
    '`', value, '`', ' but is previous set to `', lastValue, '`'
  ];
  Ember.Logger.warn(msg.join(''));
  return lastValue;
}

/**
  @module ember-jsonapi-resources
  @submodule resource-operations
**/
import Ember from 'ember';

/**
  Mixin to provide interations between a Resource instance and service/adapter.

  @class ResourceOperationsMixin
  @static
*/
export default Ember.Mixin.create({
  /**
    The service object for the entity (adapter with cache and serializer)

    @property service
    @type Object
    @required
  */
  service: Ember.required,

  save() {
    return this.get('isNew') ?
      this.get('service').createResource(this) :
      this.get('service').updateResource(this);
  },

  delete() {
    return this.get('isNew') ?
      true :
      this.get('service').deleteResource(this);
  }
});

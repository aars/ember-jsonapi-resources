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
   Default flag for 'includeRelationships' in update/create.
   */
  includeRelationships: Ember.computed.alias('changedRelationships'),

  /**
   Flag for deleted instances, not persisted.

    @property isDeleted
    @type Boolean
   */
  isDeleted: Ember.computed({
    get() {
      return this.get('isDestroying') || this.get('isDestroyed');
    }
  }).readOnly().volatile(),

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
      this.get('service').updateResource(this, this.get('includeRelationships'));
  },

  delete() {
    if (this.get('isDeleted')) {
      return Ember.Logger.error('Resource already deleted (isDeleted)');
    }
    // Unpersisted records only need to toggle isDeleted.
    if (this.get('isNew')) {
      return new Ember.RSVP.Promise((resolve) => {
        resolve(this.destroy());
      });
    } else {
      return this.get('service').deleteResource(this);
    }
  }
});

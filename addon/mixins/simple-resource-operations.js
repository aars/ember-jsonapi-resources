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
    Flag indicating changes. Combines changedAttributes, Relationships
    and _deleteOnSave.
    @property isDirty
    @type Boolean
   */
  isDirty: Ember.computed({
    get() {
      return !!this.get('_deleteOnSave') ||
             !!this.get('changedAttributes') ||
             !!this.get('changedRelationships');
    }
  }).readOnly().volatile(),

  /**
    The service object for the entity (adapter with cache and serializer)

    @property service
    @type Object
    @required
  */
  service: Ember.required,

  /**
   * Schedule deletion of this resource.
   *
   * By scheduling deletion instead of destroy() or delete() instantly we
   * keep all relationships and can fully rollback a parent resource.
   */
  _deleteOnSave: false,
  deleteOnSave() {
    this.set('_deleteOnSave', true);
  },

  save() {
    if (this.get('_deleteOnSave')) {
      return this.delete();
    } else {
      return this.get('isNew') ?
        this.get('service').createResource(this) :
        this.get('service').updateResource(this, this.get('includeRelationships'));
    }
  },

  rollback() {
    this.set('_deleteOnSave', false);
    return this._super();
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

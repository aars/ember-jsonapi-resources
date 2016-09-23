import Ember from 'ember';
import { pluralize } from 'ember-inflector';

export default Ember.Mixin.create({
  // I haven't found a good way to not fully duplicate this method
  addRelationship(related, resourceOrId) {
    console.log('this one!');
    let resource, id;
    const retval = this._super(related, resourceOrId);

    let meta = this.relationMetadata(related);
    let type = pluralize(meta.type);

    // Resource or Id?
    if (Ember.typeOf(resourceOrId) === 'instance') {
      resource = resourceOrId;
      id = resource.get('id');
    } else {
      id = resourceOrId;
      if (Ember.typeOf(id) === 'number') { id = id.toString(); } // Ensure string id.
      resource = Ember.getOwner(this).lookup(`service:${type}`).cacheLookup(id);
    }

    console.log(meta, resource);
    if (meta.inverse && resource) {
      console.log('JAHOOR. Ja.');
    }

    return retval;
  }
});
